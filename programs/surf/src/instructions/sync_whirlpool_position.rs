use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use whirlpools::{
    cpi::{self as whirlpool_cpi, accounts::CollectFees},
    program::Whirlpool as WhirlpoolProgram,
    Position as WhirlpoolPosition, TickArray, Whirlpool,
};

use crate::{
    helpers::whirlpool::sync_vault_whirlpool_position,
    state::{VaultState, WhirlpoolPosition as VaultWhirlpoolPosition},
};

pub fn handler(ctx: Context<SyncWhirlpoolPosition>) -> Result<()> {
    sync_vault_whirlpool_position(
        &mut ctx.accounts.vault_whirlpool_position,
        &mut ctx.accounts.whirlpool,
        &ctx.accounts.whirlpool_position,
        &ctx.accounts.tick_array_lower,
        &ctx.accounts.tick_array_upper,
        &ctx.accounts.whirlpool_program,
    )?;

    // TODO
    // Fees need to be collected only when user wants to collect fees or when position is being close, which is at adjusting range
    whirlpool_cpi::collect_fees(ctx.accounts.collect_fees_context())?;

    // TODO: Collect rewards

    Ok(())
}

#[derive(Accounts)]
pub struct SyncWhirlpoolPosition<'info> {
    // TODO: can be removed (?)
    pub payer: Signer<'info>,

    pub vault_state: Account<'info, VaultState>,
    #[account(
        mut,
        address = vault_state.base_token_account,
    )]
    pub vault_base_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = vault_state.quote_token_account,
    )]
    pub vault_quote_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [
            VaultWhirlpoolPosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            vault_state.whirlpool_positions_count.to_le_bytes().as_ref(),
        ],
        bump = vault_whirlpool_position.bump,
    )]
    pub vault_whirlpool_position: Account<'info, VaultWhirlpoolPosition>,

    #[account(
        address = vault_state.whirlpool,
    )]
    pub whirlpool: Account<'info, Whirlpool>,
    #[account(
        mut,
        address = whirlpool.token_vault_a,
    )]
    pub whirlpool_base_token_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = whirlpool.token_vault_b,
    )]
    pub whirlpool_quote_token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = vault_whirlpool_position.whirlpool_position,
    )]
    pub whirlpool_position: Account<'info, WhirlpoolPosition>,

    pub whirlpool_position_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub tick_array_lower: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub tick_array_upper: AccountLoader<'info, TickArray>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub token_program: Program<'info, Token>,
}

impl<'info> SyncWhirlpoolPosition<'info> {
    pub fn collect_fees_context(&self) -> CpiContext<'_, '_, '_, 'info, CollectFees<'info>> {
        let program = &self.whirlpool_program;
        let accounts = CollectFees {
            whirlpool: self.whirlpool.to_account_info(),
            token_vault_a: self.whirlpool_base_token_vault.to_account_info(),
            token_vault_b: self.whirlpool_quote_token_vault.to_account_info(),
            position: self.whirlpool_position.to_account_info(),
            position_token_account: self.whirlpool_position_token_account.to_account_info(),
            position_authority: self.vault_state.to_account_info(),
            token_owner_account_a: self.vault_base_token_account.to_account_info(),
            token_owner_account_b: self.vault_quote_token_account.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }
}
