use anchor_lang::prelude::*;

declare_id!("4wVrbfSHxmhevzPzNfdpmVkJ2jqNRy6RYt4TxcHsnfSo");

pub mod errors;
pub mod helpers;
pub mod instructions;
pub mod macros;
pub mod state;
pub mod utils;

use instructions::*;

#[program]
pub mod surf {
    use super::*;

    pub fn initialize_admin_config(ctx: Context<InitializeAdminConfig>) -> Result<()> {
        initialize_admin_config::handler(ctx)
    }

    pub fn initialize_vault_state(
        ctx: Context<InitializeVaultState>,
        full_tick_range: u32,
        vault_tick_range: u32,
        hedge_tick_range: u32,
    ) -> Result<()> {
        initialize_vault_state::handler(ctx, full_tick_range, vault_tick_range, hedge_tick_range)
    }

    pub fn open_whirlpool_position(
        ctx: Context<OpenWhirlpoolPosition>,
        position_bump: u8,
    ) -> Result<()> {
        open_whirlpool_position::handler(ctx, position_bump)
    }

    pub fn open_hedge_position(ctx: Context<OpenHedgePosition>) -> Result<()> {
        open_hedge_position::handler(ctx)
    }

    pub fn sync_whirlpool_position(ctx: Context<SyncWhirlpoolPosition>) -> Result<()> {
        sync_whirlpool_position::handler(ctx)
    }

    pub fn deposit_liquidity(
        ctx: Context<DepositLiquidity>,
        liquidity_input: u128,
        base_token_max: u64,
        quote_token_max: u64,
    ) -> Result<()> {
        deposit_liquidity::handler(ctx, liquidity_input, base_token_max, quote_token_max)
    }

    pub fn hedge_liquidity(ctx: Context<HedgeLiquidity>, borrow_amount: u64) -> Result<()> {
        hedge_liquidity::handler(ctx, borrow_amount)
    }

    /// Synchronizes user whirlpool position fees, rewards and liquidity to match current state
    ///
    /// As vault whirlpool position adjusts, liquidity provided changes and needs to be stored
    /// separately per each whirlpool position to be able to calculate fees and rewards for user
    ///
    /// **Requires** previous vault_whirlpool_positions which the user_position was not yet synced with
    /// up until the active one (no need to provide all at once) sorted by each whirlpool position id
    /// from the oldest to the newest in remaining accounts
    /// all the accounts are not signers, and not writable
    pub fn sync_user_whirlpool_position<'remaining, 'info>(
        ctx: Context<'_, '_, 'remaining, 'info, SyncUserWhirlpoolPosition<'info>>,
    ) -> Result<()> {
        sync_user_position::whirlpool::handler(ctx)
    }

    /// Synchronizes user hedge position interests and token amounts to match current state
    ///
    /// As vault hedge adjusts borrow amounts for each adjustment need to be stored separately
    /// in order to be able to compute user interest for each adjustment stage
    ///
    /// **Requires** previous hedge_positions which the user_position was not yet synced with
    /// up until the active one (no need to provide all at once) sorted by each hedge position id
    /// from the oldest to the newest in remaining accounts
    /// all the accounts are not signers, and not writable
    pub fn sync_user_hedge_position(ctx: Context<SyncUserHedgePosition>) -> Result<()> {
        sync_user_position::hedge::handler(ctx)
    }

    pub fn collect_user_fees_and_rewards(ctx: Context<CollectUserFeesAndRewards>) -> Result<()> {
        collect_user_fees_and_rewards::handler(ctx)
    }

    pub fn claim_user_borrow_interest(ctx: Context<ClaimUserBorrowInterest>) -> Result<()> {
        claim_user_interest::borrow::handler(ctx)
    }

    pub fn claim_user_collateral_interest(ctx: Context<ClaimUserCollateralInterest>) -> Result<()> {
        claim_user_interest::collateral::handler(ctx)
    }

    pub fn adjust_vault_hedge_above(ctx: Context<AdjustVaultHedgeAbove>) -> Result<()> {
        adjust_vault_hedge::above::handler(ctx)
    }

    pub fn adjust_vault_hedge_below(ctx: Context<AdjustVaultHedgeBelow>) -> Result<()> {
        adjust_vault_hedge::below::handler(ctx)
    }

    pub fn adjust_whirlpool_position(
        ctx: Context<AdjustWhirlpoolPosition>,
        next_position_bump: u8,
    ) -> Result<()> {
        adjust_whirlpool_position::handler(ctx, next_position_bump)
    }
}
