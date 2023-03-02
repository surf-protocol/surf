use anchor_lang::prelude::*;
use anchor_spl::token::{self as token_cpi, Token, TokenAccount, Transfer};
use drift::{
    cpi as drift_cpi,
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

use crate::{
    drift_deposit_borrow_context_impl, drift_withdraw_collateral_context_impl,
    errors::SurfError,
    helpers::hedge::{
        decrease_vault_hedge_token_amounts, get_token_amount_diff, sync_vault_interest_growths,
        update_user_interests,
    },
    state::{HedgePosition, UserPosition, VaultState},
    update_borrow_spot_market_context_impl, update_collateral_spot_market_context_impl,
    utils::{
        constraints::validate_user_position_sync,
        orca::swap::{get_default_other_amount_threshold, get_default_sqrt_price_limit},
    },
};

pub fn handler(ctx: Context<DecreaseLiquidityHedge>, borrow_amount: u64) -> Result<()> {
    let hedge_position = ctx.accounts.hedge_position.load()?;

    require!(
        ctx.accounts.user_position.collateral_amount > 0,
        SurfError::ZeroCollateral,
    );
    require!(
        ctx.accounts.user_position.borrow_amount > 0,
        SurfError::ZeroBorrow,
    );
    require!(
        ctx.accounts.user_position.borrow_amount >= borrow_amount,
        SurfError::InvalidBorrowAmount,
    );

    validate_user_position_sync(&ctx.accounts.user_position, Some(&hedge_position), None)?;

    drift_cpi::update_spot_market_cumulative_interest(
        ctx.accounts.update_borrow_spot_market_context(),
    )?;
    drift_cpi::update_spot_market_cumulative_interest(
        ctx.accounts.update_collateral_spot_market_context(),
    )?;

    drop(hedge_position);

    let mut hedge_position = ctx.accounts.hedge_position.load_mut()?;
    let drift_subaccount = ctx.accounts.drift_subaccount.load()?;
    let collateral_spot_market = ctx.accounts.drift_collateral_spot_market.load()?;
    let borrow_spot_market = ctx.accounts.drift_borrow_spot_market.load()?;

    sync_vault_interest_growths(
        &mut ctx.accounts.vault_state,
        &mut hedge_position,
        &drift_subaccount,
        &collateral_spot_market,
        &borrow_spot_market,
    )?;
    update_user_interests(
        &mut ctx.accounts.user_position,
        &ctx.accounts.vault_state,
        &hedge_position.get_current_position(),
    )?;

    whirlpool_cpi::swap(
        ctx.accounts.swap_context(),
        borrow_amount,
        get_default_other_amount_threshold(false),
        get_default_sqrt_price_limit(false),
        false,
        false,
    )?;

    let user_position = &ctx.accounts.user_position;
    let notional_diff = get_token_amount_diff(&mut ctx.accounts.vault_quote_token_account, false)?;

    require!(
        notional_diff <= user_position.borrow_amount_notional,
        SurfError::InvalidBorrowAmount
    );

    token_cpi::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.owner_base_token_account.to_account_info(),
                to: ctx.accounts.vault_base_token_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        user_position.borrow_interest_unclaimed,
    )?;

    let user_borrow_claimable =
        user_position.borrow_amount + user_position.borrow_interest_unclaimed;
    let user_collateral_claimable =
        user_position.collateral_amount + user_position.collateral_interest_unclaimed;

    drift_cpi::deposit(
        ctx.accounts.drift_deposit_borrow_context(),
        1_u16,
        user_borrow_claimable,
        true,
    )?;

    drift_cpi::withdraw(
        ctx.accounts.drift_withdraw_collateral_context(),
        0_u16,
        user_collateral_claimable,
        true,
    )?;

    let collateral_amount = if user_position.borrow_amount == borrow_amount {
        token_cpi::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_quote_token_account.to_account_info(),
                    to: ctx.accounts.owner_quote_token_account.to_account_info(),
                    authority: ctx.accounts.vault_state.to_account_info(),
                },
            ),
            user_position.collateral_amount,
        )?;

        user_position.collateral_amount
    } else {
        // TODO: Calculate claimable collateral proportional to borrow
        0
    };

    decrease_vault_hedge_token_amounts(
        &mut ctx.accounts.vault_state,
        &mut hedge_position,
        collateral_amount,
        borrow_amount,
        notional_diff,
    )?;

    ctx.accounts
        .user_position
        .decrease_hedge(collateral_amount, borrow_amount, notional_diff)?;

    Ok(())
}

#[derive(Accounts)]
pub struct DecreaseLiquidityHedge<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        token::authority = owner,
        token::mint = vault_state.base_token_mint,
    )]
    pub owner_base_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        token::authority = owner,
        token::mint = vault_state.quote_token_mint,
    )]
    pub owner_quote_token_account: Box<Account<'info, TokenAccount>>,

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
        mut,
        seeds = [
            HedgePosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            vault_state.current_hedge_position_id.unwrap().to_le_bytes().as_ref(),
        ],
        bump = hedge_position.load()?.bump,
    )]
    pub hedge_position: AccountLoader<'info, HedgePosition>,

    /// CHECK: Drift CPI
    pub drift_signer: UncheckedAccount<'info>,
    pub drift_state: Box<Account<'info, DriftState>>,
    #[account(
        mut,
        address = vault_state.drift_subaccount,
    )]
    pub drift_subaccount: AccountLoader<'info, DriftSubaccount>,
    #[account(
        mut,
        address = vault_state.drift_stats,
    )]
    pub drift_stats: AccountLoader<'info, DriftStats>,

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

    /// CHECK: Drift CPI
    pub drift_base_token_oracle: UncheckedAccount<'info>,
    /// CHECK: Drift CPI
    pub drift_quote_token_oracle: UncheckedAccount<'info>,

    // ----------
    // SWAP ACCOUNTS
    #[account(
        mut,
        constraint = swap_whirlpool.token_mint_a.eq(&vault_state.base_token_mint),
        constraint = swap_whirlpool.token_mint_b.eq(&vault_state.quote_token_mint),
    )]
    pub swap_whirlpool: Box<Account<'info, Whirlpool>>,
    #[account(
        mut,
        address = swap_whirlpool.token_vault_a,
    )]
    pub swap_whirlpool_base_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = swap_whirlpool.token_vault_b,
    )]
    pub swap_whirlpool_quote_token_vault: Box<Account<'info, TokenAccount>>,
    /// CHECK: Whirlpool CPI
    pub swap_oracle: UncheckedAccount<'info>,
    #[account(mut)]
    pub swap_tick_array_0: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub swap_tick_array_1: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub swap_tick_array_2: AccountLoader<'info, TickArray>,

    pub drift_program: Program<'info, Drift>,
    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub token_program: Program<'info, Token>,
}

impl<'info> DecreaseLiquidityHedge<'info> {
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
}

update_borrow_spot_market_context_impl!(DecreaseLiquidityHedge);
update_collateral_spot_market_context_impl!(DecreaseLiquidityHedge);
drift_deposit_borrow_context_impl!(DecreaseLiquidityHedge);
drift_withdraw_collateral_context_impl!(DecreaseLiquidityHedge);
