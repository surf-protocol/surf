use std::ops::Neg;

use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use drift::{
    cpi::{self as drift_cpi},
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
use whirlpools_client::math::MAX_SQRT_PRICE_X64;

use crate::{
    drift_deposit_borrow_context_impl,
    errors::SurfError,
    helpers::hedge::get_token_amount_diff,
    instructions::lib::{
        get_borrowed_amount_diff, update_program_accounts,
        update_spot_market_and_sync_borrow_interest_growth, validate_next_hedge_position,
    },
    state::{HedgePosition, VaultState, WhirlpoolAdjustmentState, WhirlpoolPosition},
};

pub fn handler(ctx: Context<AdjustVaultHedgeAbove>) -> Result<()> {
    let mut hedge_position = ctx.accounts.current_vault_hedge_position.load_mut()?;
    let next_hedge_position_ai = &ctx.accounts.next_vault_hedge_position;
    let vault_state = &ctx.accounts.vault_state;

    validate_next_hedge_position(&hedge_position, next_hedge_position_ai.key())?;
    require_neq!(hedge_position.get_current_position().borrowed_amount, 0);

    let whirlpool = &ctx.accounts.whirlpool;

    let current_tick = whirlpool.tick_current_index;
    let last_hedge_adjustment_tick = vault_state.last_hedge_adjustment_tick.unwrap();
    let hedge_tick_range = vault_state.hedge_tick_range as i32;
    let new_hedge_adjustment_tick = last_hedge_adjustment_tick + hedge_tick_range;

    if vault_state.whirlpool_adjustment_state == WhirlpoolAdjustmentState::None {
        require!(
            current_tick > new_hedge_adjustment_tick,
            SurfError::HedgePositionNotOutOfHedgeTickRange,
        );
    } else if vault_state.whirlpool_adjustment_state != WhirlpoolAdjustmentState::Below {
        return Err(SurfError::InvalidWhirlpoolAdjustmentState.into());
    }

    let drift_subaccount = ctx.accounts.drift_subaccount.load()?;

    update_spot_market_and_sync_borrow_interest_growth(
        &ctx.accounts.drift_state,
        &ctx.accounts.drift_borrow_spot_market,
        &ctx.accounts.drift_base_token_oracle,
        &ctx.accounts.drift_program,
        &mut hedge_position,
        &drift_subaccount,
    )?;

    let borrowed_amount_diff = get_borrowed_amount_diff(
        whirlpool,
        &ctx.accounts.vault_whirlpool_position,
        &hedge_position,
        true,
    )?;

    whirlpool_cpi::swap(
        ctx.accounts.swap_context(),
        borrowed_amount_diff,
        u64::MAX,
        MAX_SQRT_PRICE_X64,
        false,
        false,
    )?;

    drift_cpi::deposit(
        ctx.accounts.drift_deposit_borrow_context(),
        1_u16,
        borrowed_amount_diff,
        true,
    )?;

    let borrowed_amount_diff_notional =
        get_token_amount_diff(&mut ctx.accounts.vault_quote_token_account, false)?;

    update_program_accounts(
        (borrowed_amount_diff as i64).neg(),
        (borrowed_amount_diff_notional as i64).neg(),
        current_tick,
        &mut hedge_position,
        &mut ctx.accounts.vault_state,
        next_hedge_position_ai,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct AdjustVaultHedgeAbove<'info> {
    #[account(
        address = vault_state.whirlpool,
    )]
    pub whirlpool: Box<Account<'info, Whirlpool>>,

    #[account(
        mut,
        constraint = vault_state.whirlpool_positions_count > 0,
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
        seeds = [
            WhirlpoolPosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            vault_state.current_whirlpool_position_id.unwrap().to_le_bytes().as_ref(),
        ],
        bump = vault_whirlpool_position.bump,
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
    pub current_vault_hedge_position: AccountLoader<'info, HedgePosition>,
    /// CHECK: Checked inside of instruction handler
    /// If `next_vault_hedge_position` is not needed meaning not all borrow positions inside of
    /// `current_vault_hedge_position` are used, pass as Pubkey::default()
    pub next_vault_hedge_position: UncheckedAccount<'info>,

    // ------------
    // SWAP ACCOUNTS
    #[account(
        mut,
        constraint = swap_whirlpool.token_mint_a.eq(&whirlpool.token_mint_a),
        constraint = swap_whirlpool.token_mint_b.eq(&whirlpool.token_mint_b),
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
    #[account(mut)]
    pub swap_tick_array_0: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub swap_tick_array_1: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub swap_tick_array_2: AccountLoader<'info, TickArray>,
    /// CHECK: Whirlpool CPI
    pub swap_oracle: UncheckedAccount<'info>,

    // -------------
    // DRIFT ACCOUNTS
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
    /// CHECK: Drift CPI
    pub drift_base_token_oracle: UncheckedAccount<'info>,

    pub drift_program: Program<'info, Drift>,
    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub token_program: Program<'info, Token>,
}

impl<'info> AdjustVaultHedgeAbove<'info> {
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

drift_deposit_borrow_context_impl!(AdjustVaultHedgeAbove);
