use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use drift::{
    cpi::{
        self as drift_cpi,
        accounts::{Deposit as DriftDeposit, Withdraw as DriftWithdraw},
    },
    program::Drift as DriftProgram,
    state::{
        spot_market::SpotMarket as DriftSpotMarket,
        state::State as DriftState,
        user::{User as DriftUser, UserStats as DriftUserStats},
    },
};
use whirlpools::{
    cpi::{self as whirlpool_cpi, accounts::Swap},
    program::Whirlpool as WhirlpoolProgram,
    Position as WhirlpoolPosition, TickArray, Whirlpool,
};
use whirlpools_client::math::{sqrt_price_from_tick_index, MIN_SQRT_PRICE_X64};

use crate::{
    errors::SurfError,
    state::{UserPosition, Vault},
    utils::{
        constraints::{have_matching_mints, is_position_open, is_valid_whirlpool},
        orca::liquidity_math::{get_amount_delta_a_wrapped, get_amount_delta_b_wrapped},
    },
};

pub fn handler(ctx: Context<HedgeLiquidity>) -> Result<()> {
    if ctx.accounts.user_position.is_hedged {
        return Err(SurfError::PositionAlreadyHedged.into());
    }

    let whirlpool_position = &ctx.accounts.whirlpool_position;
    let upper_tick_index = whirlpool_position.tick_upper_index;
    let lower_tick_index = whirlpool_position.tick_lower_index;
    let middle_tick_index = (lower_tick_index + upper_tick_index) / 2;

    let lower_sqrt_price = sqrt_price_from_tick_index(lower_tick_index);
    let middle_sqrt_price = sqrt_price_from_tick_index(middle_tick_index);

    let liquidity = whirlpool_position.liquidity;

    let quote_liquidity_denominated =
        get_amount_delta_b_wrapped(lower_sqrt_price, middle_sqrt_price, liquidity, true)?;
    let collateral_quote_amount = quote_liquidity_denominated * 2;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer_quote_token_account.to_account_info(),
                to: ctx.accounts.vault_quote_token_account.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        collateral_quote_amount,
    )?;

    let whirlpool_key = ctx.accounts.whirlpool.key();
    let vault_signer_seeds: &[&[&[u8]]] = &[&[
        Vault::NAMESPACE.as_ref(),
        whirlpool_key.as_ref(),
        &[ctx.accounts.vault.bump],
    ]];

    let drift_deposit_context = ctx.accounts.get_deposit_quote_context();
    drift_cpi::deposit(
        drift_deposit_context.with_signer(vault_signer_seeds),
        0,
        collateral_quote_amount,
        false,
    )?;

    let current_sqrt_price = ctx.accounts.whirlpool.sqrt_price;
    let upper_sqrt_price = sqrt_price_from_tick_index(upper_tick_index);
    let borrow_base_amount =
        get_amount_delta_a_wrapped(current_sqrt_price, upper_sqrt_price, liquidity, true)?;

    let drift_withdraw_context = ctx.accounts.get_withdraw_base_context();
    drift_cpi::withdraw(
        drift_withdraw_context.with_signer(vault_signer_seeds),
        1,
        borrow_base_amount,
        false,
    )?;

    let hedge_swap_context = ctx.accounts.get_hedge_swap_context();
    whirlpool_cpi::swap(
        hedge_swap_context.with_signer(vault_signer_seeds),
        borrow_base_amount,
        0,
        MIN_SQRT_PRICE_X64,
        true,
        true,
    )?;

    ctx.accounts
        .user_position
        .update_hedge(collateral_quote_amount, borrow_base_amount);

    // TODO: Update vault

    Ok(())
}

#[derive(Accounts)]
pub struct HedgeLiquidity<'info> {
    pub payer: Signer<'info>,
    #[account(mut,
        constraint = payer_base_token_account.mint.eq(&vault.base_token_mint)
    )]
    pub payer_base_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = payer_quote_token_account.mint.eq(&vault.quote_token_mint)
    )]
    pub payer_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut,
        seeds = [
            UserPosition::NAMESPACE.as_ref(),
            vault.key().as_ref(),
            payer.key().as_ref(),
        ],
        bump = user_position.bump
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(mut,
        seeds = [
            Vault::NAMESPACE.as_ref(),
            whirlpool.key().as_ref(),
        ],
        bump = vault.bump,
        constraint = is_position_open(&vault) @SurfError::PositionNotOpen
    )]
    pub vault: Box<Account<'info, Vault>>,
    #[account(mut,
        address = vault.base_token_account
    )]
    pub vault_base_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        address = vault.quote_token_account
    )]
    pub vault_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        constraint = is_valid_whirlpool(&whirlpool, &vault) @SurfError::InvalidWhirlpool,
    )]
    pub whirlpool: Box<Account<'info, Whirlpool>>,

    #[account(
        address = vault.whirlpool_position @SurfError::InvalidWhirlpoolPosition,
    )]
    pub whirlpool_position: Box<Account<'info, WhirlpoolPosition>>,

    // ----------------
    // DRIFT ACCOUNTS
    pub drift_state: Box<Account<'info, DriftState>>,
    /// CHECK: Drift program handles checks
    pub drift_signer: UncheckedAccount<'info>,
    #[account(mut,
        seeds = [b"spot_market_vault".as_ref(), 0_u16.to_le_bytes().as_ref()],
        bump,
        seeds::program = drift_program.key(),
    )]
    pub drift_quote_spot_market_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        seeds = [b"spot_market_vault".as_ref(), 1_u16.to_le_bytes().as_ref()],
        bump,
        seeds::program = drift_program.key(),
    )]
    pub drift_base_spot_market_vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: Drift program checks these accounts
    pub drift_base_token_oracle: UncheckedAccount<'info>,
    #[account(mut)]
    pub drift_base_spot_market: AccountLoader<'info, DriftSpotMarket>,
    #[account(mut)]
    pub drift_quote_spot_market: AccountLoader<'info, DriftSpotMarket>,

    #[account(mut,
        address = vault.drift_stats.key(),
    )]
    pub drift_stats: AccountLoader<'info, DriftUserStats>,
    #[account(mut,
        address = vault.drift_subaccount.key(),
    )]
    pub drift_subaccount: AccountLoader<'info, DriftUser>,

    // ----------------
    // HEDGE SWAP ACCOUNTS
    #[account(mut,
        constraint = have_matching_mints(&hedge_swap_whirlpool, &whirlpool) @SurfError::WhirlpoolMintsNotMatching
    )]
    pub hedge_swap_whirlpool: Box<Account<'info, Whirlpool>>,

    #[account(mut, address = hedge_swap_whirlpool.token_vault_a)]
    pub hedge_swap_whirlpool_base_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = hedge_swap_whirlpool.token_vault_b)]
    pub hedge_swap_whirlpool_quote_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut,
        constraint = hedge_swap_tick_array_0.load()?.whirlpool.key().eq(&hedge_swap_whirlpool.key())
    )]
    pub hedge_swap_tick_array_0: AccountLoader<'info, TickArray>,
    #[account(mut,
        constraint = hedge_swap_tick_array_1.load()?.whirlpool.key().eq(&hedge_swap_whirlpool.key())
    )]
    pub hedge_swap_tick_array_1: AccountLoader<'info, TickArray>,
    #[account(mut,
        constraint = hedge_swap_tick_array_2.load()?.whirlpool.key().eq(&hedge_swap_whirlpool.key())
    )]
    pub hedge_swap_tick_array_2: AccountLoader<'info, TickArray>,

    /// CHECK: Whirlpool program checks
    #[account(
        seeds = [
            b"oracle".as_ref(),
            hedge_swap_whirlpool.key().as_ref()
        ],
        bump,
        seeds::program = whirlpool_program.key()
    )]
    pub hedge_swap_oracle: UncheckedAccount<'info>,

    pub drift_program: Program<'info, DriftProgram>,
    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub token_program: Program<'info, Token>,
}

impl<'info> HedgeLiquidity<'info> {
    pub fn get_deposit_quote_context(&self) -> CpiContext<'_, '_, '_, 'info, DriftDeposit<'info>> {
        let accounts = DriftDeposit {
            state: self.drift_state.to_account_info(),
            user: self.drift_subaccount.to_account_info(),
            user_stats: self.drift_stats.to_account_info(),
            authority: self.vault.to_account_info(),
            spot_market_vault: self.drift_quote_spot_market_vault.to_account_info(),
            user_token_account: self.vault_quote_token_account.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(self.drift_program.to_account_info(), accounts)
            .with_remaining_accounts(vec![self.drift_quote_spot_market.to_account_info()])
    }

    pub fn get_withdraw_base_context(&self) -> CpiContext<'_, '_, '_, 'info, DriftWithdraw<'info>> {
        let accounts = DriftWithdraw {
            state: self.drift_state.to_account_info(),
            user: self.drift_subaccount.to_account_info(),
            user_stats: self.drift_stats.to_account_info(),
            authority: self.vault.to_account_info(),
            user_token_account: self.vault_base_token_account.to_account_info(),
            spot_market_vault: self.drift_base_spot_market_vault.to_account_info(),
            drift_signer: self.drift_signer.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(self.drift_program.to_account_info(), accounts).with_remaining_accounts(
            vec![
                self.drift_base_token_oracle.to_account_info(),
                self.drift_quote_spot_market.to_account_info(),
                self.drift_base_spot_market.to_account_info(),
            ],
        )
    }

    pub fn get_hedge_swap_context(&self) -> CpiContext<'_, '_, '_, 'info, Swap<'info>> {
        let accounts = Swap {
            token_authority: self.vault.to_account_info(),
            token_owner_account_a: self.vault_base_token_account.to_account_info(),
            token_owner_account_b: self.vault_quote_token_account.to_account_info(),
            whirlpool: self.hedge_swap_whirlpool.to_account_info(),
            token_vault_a: self.hedge_swap_whirlpool_base_token_vault.to_account_info(),
            token_vault_b: self
                .hedge_swap_whirlpool_quote_token_vault
                .to_account_info(),
            tick_array0: self.hedge_swap_tick_array_0.to_account_info(),
            tick_array1: self.hedge_swap_tick_array_1.to_account_info(),
            tick_array2: self.hedge_swap_tick_array_2.to_account_info(),
            oracle: self.hedge_swap_oracle.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(self.whirlpool_program.to_account_info(), accounts)
    }
}
