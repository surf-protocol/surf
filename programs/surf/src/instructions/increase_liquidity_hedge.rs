use anchor_lang::prelude::*;
use anchor_spl::token::{self as token_cpi, Token, TokenAccount, Transfer};
use drift::{
    cpi::{self as drift_cpi, accounts::UpdateSpotMarketCumulativeInterest},
    program::Drift,
    state::{
        spot_market::SpotMarket,
        state::State as DriftState,
        user::{User as DriftSubaccount, UserStats as DriftStats},
    },
};
use whirlpools::{
    cpi::{self as whirlpool_cpi, accounts::Swap},
    program::Whirlpool as WhirlpoolProgram,
    TickArray, Whirlpool,
};
use whirlpools_client::math::sqrt_price_from_tick_index;

use crate::{
    drift_deposit_collateral_context_impl, drift_withdraw_borrow_context_impl,
    errors::SurfError,
    helpers::hedge::{
        get_token_amount_diff, increase_vault_hedge_token_amounts, sync_vault_interest_growths,
        update_user_interests,
    },
    state::{HedgePosition, UserPosition, VaultState, WhirlpoolPosition},
    utils::{
        constraints::validate_user_position_sync,
        orca::{
            liquidity_math::{get_amount_delta_a_wrapped, get_amount_delta_b_wrapped},
            swap::{get_default_other_amount_threshold, get_default_sqrt_price_limit},
        },
    },
};

pub fn handler(ctx: Context<IncreaseLiquidityHedge>, borrow_amount: u64) -> Result<()> {
    let whirlpool_position = &ctx.accounts.vault_whirlpool_position;
    let mut hedge_position = ctx.accounts.vault_hedge_position.load_mut()?;

    require!(
        ctx.accounts.user_position.liquidity > 0,
        SurfError::ZeroLiquidity
    );

    validate_user_position_sync(
        &ctx.accounts.user_position,
        Some(&hedge_position),
        Some(&whirlpool_position),
    )?;

    drift_cpi::update_spot_market_cumulative_interest(
        ctx.accounts.update_borrow_spot_market_context(),
    )?;
    drift_cpi::update_spot_market_cumulative_interest(
        ctx.accounts.update_collateral_spot_market_context(),
    )?;

    let drift_subaccount = ctx.accounts.drift_subaccount.load()?;
    let drift_collateral_spot_market = ctx.accounts.drift_collateral_spot_market.load()?;
    let drift_base_token_spot_market = ctx.accounts.drift_borrow_spot_market.load()?;

    sync_vault_interest_growths(
        &mut ctx.accounts.vault_state,
        &mut hedge_position,
        &drift_subaccount,
        &drift_collateral_spot_market,
        &drift_base_token_spot_market,
    )?;
    update_user_interests(
        &mut ctx.accounts.user_position,
        &ctx.accounts.vault_state,
        &hedge_position.get_current_position(),
    )?;

    let user_position = &ctx.accounts.user_position;
    let lower_sqrt_price = whirlpool_position.lower_sqrt_price;
    let middle_sqrt_price = whirlpool_position.middle_sqrt_price;

    // whirlpool quote token amount * 2 to always maintain at least 75% LTV
    let required_collateral_amount = get_amount_delta_b_wrapped(
        lower_sqrt_price,
        middle_sqrt_price,
        user_position.liquidity,
        true,
    )? * 2;
    let current_collateral_amount = user_position.collateral_amount;

    let mut collateral_amount = 0_u64;

    // Only deposit collateral if user does not have
    // enough collateral to cover the whole whirlpool position
    if required_collateral_amount > current_collateral_amount {
        collateral_amount = required_collateral_amount - current_collateral_amount;

        token_cpi::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.owner_quote_token_account.to_account_info(),
                    to: ctx.accounts.vault_quote_token_account.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            collateral_amount,
        )?;

        drift_cpi::deposit(
            ctx.accounts.drift_deposit_collateral_context(),
            0_u16,
            collateral_amount,
            false,
        )?;
    }

    if ctx.accounts.vault_state.last_hedge_adjustment_tick == None {
        let current_tick = ctx.accounts.whirlpool.tick_current_index;
        ctx.accounts
            .vault_state
            .update_hedge_adjustment_tick(current_tick);
    }

    let hedge_adjustment_tick = ctx.accounts.vault_state.last_hedge_adjustment_tick.unwrap();
    let hedge_adjustment_sqrt_price = sqrt_price_from_tick_index(hedge_adjustment_tick);
    let upper_sqrt_price = whirlpool_position.upper_sqrt_price;
    let base_token_whirlpool_amount = get_amount_delta_a_wrapped(
        hedge_adjustment_sqrt_price,
        upper_sqrt_price,
        user_position.liquidity,
        true,
    )?;

    // Should never happen
    if base_token_whirlpool_amount == 0 {
        return Err(SurfError::ZeroBaseTokenWhirlpoolAmount.into());
    }

    if base_token_whirlpool_amount < borrow_amount {
        return Err(SurfError::BorrowAmountTooHigh.into());
    }

    drift_cpi::withdraw(
        ctx.accounts.drift_withdraw_borrow_context(),
        1_u16,
        borrow_amount,
        false,
    )?;

    whirlpool_cpi::swap(
        ctx.accounts.swap_context(),
        borrow_amount,
        get_default_other_amount_threshold(true),
        get_default_sqrt_price_limit(true),
        true,
        true,
    )?;

    let borrow_amount_notional =
        get_token_amount_diff(&mut ctx.accounts.vault_quote_token_account, true)?;

    increase_vault_hedge_token_amounts(
        &mut ctx.accounts.vault_state,
        &mut hedge_position,
        collateral_amount,
        borrow_amount,
        borrow_amount_notional,
    )?;

    ctx.accounts.user_position.increase_hedge(
        collateral_amount,
        borrow_amount,
        borrow_amount_notional,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct IncreaseLiquidityHedge<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        token::mint = vault_state.quote_token_mint,
        token::authority = owner,
    )]
    pub owner_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [
            UserPosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            owner.key().as_ref(),
        ],
        bump = user_position.bump,
    )]
    pub user_position: Box<Account<'info, UserPosition>>,

    #[account(
        address = vault_state.whirlpool,
    )]
    pub whirlpool: Box<Account<'info, Whirlpool>>,

    #[account(
        mut,
        constraint = vault_state.hedge_positions_count > 0,
    )]
    pub vault_state: Box<Account<'info, VaultState>>,
    #[account(
        mut,
        address = vault_state.base_token_account,
    )]
    pub vault_base_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = vault_state.quote_token_account,
    )]
    pub vault_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        constraint = vault_whirlpool_position.vault_state.eq(&vault_state.key()),
        constraint = Some(vault_whirlpool_position.id) == vault_state.current_whirlpool_position_id,
    )]
    pub vault_whirlpool_position: Account<'info, WhirlpoolPosition>,

    #[account(
        mut,
        seeds = [
            HedgePosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            vault_state.current_hedge_position_id.unwrap().to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub vault_hedge_position: AccountLoader<'info, HedgePosition>,

    /// CHECK: Drift CPI checks
    pub drift_signer: UncheckedAccount<'info>,
    pub drift_state: Box<Account<'info, DriftState>>,
    #[account(
        mut,
        address = vault_state.drift_stats,
    )]
    pub drift_stats: AccountLoader<'info, DriftStats>,
    #[account(
        mut,
        address = vault_state.drift_subaccount,
    )]
    pub drift_subaccount: AccountLoader<'info, DriftSubaccount>,

    /// CHECK: Drift program checks these accounts
    pub drift_base_token_oracle: UncheckedAccount<'info>,
    /// CHECK: Drift program checks these accounts
    pub drift_quote_token_oracle: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [
            b"spot_market_vault".as_ref(),
            1_u16.to_le_bytes().as_ref(),
        ],
        bump,
        seeds::program = drift_program.key(),
    )]
    pub drift_borrow_vault: Box<Account<'info, TokenAccount>>,
    pub drift_borrow_spot_market: AccountLoader<'info, SpotMarket>,
    #[account(
        mut,
        seeds = [
            b"spot_market_vault".as_ref(),
            0_u16.to_le_bytes().as_ref(),
        ],
        bump,
        seeds::program = drift_program.key(),
    )]
    pub drift_collateral_vault: Box<Account<'info, TokenAccount>>,
    pub drift_collateral_spot_market: AccountLoader<'info, SpotMarket>,

    // -------------
    // SWAP ACCOUNTS
    #[account(
        mut,
        constraint = swap_whirlpool.token_mint_a.eq(&vault_state.base_token_mint),
        constraint = swap_whirlpool.token_mint_b.eq(&vault_state.quote_token_mint),
    )]
    pub swap_whirlpool: Box<Account<'info, Whirlpool>>,

    #[account(mut)]
    pub swap_whirlpool_base_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub swap_whirlpool_quote_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub swap_tick_array_0: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub swap_tick_array_1: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub swap_tick_array_2: AccountLoader<'info, TickArray>,

    /// CHECK: Whirlpool CPI checks
    pub swap_oracle: UncheckedAccount<'info>,

    pub drift_program: Program<'info, Drift>,
    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub token_program: Program<'info, Token>,
}

impl<'info> IncreaseLiquidityHedge<'info> {
    pub fn swap_context(&self) -> CpiContext<'_, '_, '_, 'info, Swap<'info>> {
        let program = &self.whirlpool_program;
        let accounts = Swap {
            whirlpool: self.swap_whirlpool.to_account_info(),
            token_vault_a: self.swap_whirlpool_base_token_vault.to_account_info(),
            token_vault_b: self.swap_whirlpool_quote_token_vault.to_account_info(),
            token_authority: self.vault_state.to_account_info(),
            token_owner_account_a: self.vault_base_token_account.to_account_info(),
            token_owner_account_b: self.vault_quote_token_account.to_account_info(),
            tick_array0: self.swap_tick_array_0.to_account_info(),
            tick_array1: self.swap_tick_array_1.to_account_info(),
            tick_array2: self.swap_tick_array_2.to_account_info(),
            oracle: self.swap_oracle.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }

    pub fn update_borrow_spot_market_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, UpdateSpotMarketCumulativeInterest<'info>> {
        let program = &self.drift_program;
        let accounts = UpdateSpotMarketCumulativeInterest {
            state: self.drift_state.to_account_info(),
            spot_market: self.drift_borrow_spot_market.to_account_info(),
            oracle: self.drift_base_token_oracle.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }

    pub fn update_collateral_spot_market_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, UpdateSpotMarketCumulativeInterest<'info>> {
        let program = &self.drift_program;
        let accounts = UpdateSpotMarketCumulativeInterest {
            state: self.drift_state.to_account_info(),
            spot_market: self.drift_collateral_spot_market.to_account_info(),
            oracle: self.drift_quote_token_oracle.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }
}

drift_deposit_collateral_context_impl!(IncreaseLiquidityHedge);
drift_withdraw_borrow_context_impl!(IncreaseLiquidityHedge);
