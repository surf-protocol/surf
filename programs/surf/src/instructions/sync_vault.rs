use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use whirlpools::{
    program::Whirlpool as WhirlpoolProgram, Position as WhirlpoolPosition, TickArray, Whirlpool,
};

use crate::{
    helpers::vault::sync_vault,
    state::{Vault, VaultPosition},
};

pub fn handler(ctx: Context<SyncVault>) -> Result<()> {
    sync_vault(
        &mut ctx.accounts.vault_position,
        &ctx.accounts.vault_base_token_account,
        &ctx.accounts.vault_quote_token_account,
        &mut ctx.accounts.whirlpool,
        &ctx.accounts.whirlpool_base_token_vault,
        &ctx.accounts.whirlpool_quote_token_vault,
        &ctx.accounts.whirlpool_position,
        &ctx.accounts.whirlpool_position_token_account,
        &ctx.accounts.tick_array_lower,
        &ctx.accounts.tick_array_upper,
        &ctx.accounts.whirlpool_program,
        &ctx.accounts.token_program,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct SyncVault<'info> {
    pub payer: Signer<'info>,

    #[account(mut)]
    pub whirlpool: Box<Account<'info, Whirlpool>>,
    #[account(
        mut,
        address = whirlpool.token_vault_a,
    )]
    pub whirlpool_base_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = whirlpool.token_vault_b,
    )]
    pub whirlpool_quote_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(has_one = whirlpool)]
    pub tick_array_lower: AccountLoader<'info, TickArray>,
    #[account(has_one = whirlpool)]
    pub tick_array_upper: AccountLoader<'info, TickArray>,

    #[account(
        mut,
        address = vault_position.whirlpool_position.key(),
    )]
    pub whirlpool_position: Box<Account<'info, WhirlpoolPosition>>,
    #[account(
        token::mint = whirlpool_position.position_mint,
        token::authority = vault.key(),
    )]
    pub whirlpool_position_token_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [
            Vault::NAMESPACE.as_ref(),
            whirlpool.key().as_ref(),
        ],
        bump = vault.bump,
    )]
    pub vault: Box<Account<'info, Vault>>,
    #[account(
        mut,
        address = vault.base_token_account,
    )]
    pub vault_base_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = vault.quote_token_account,
    )]
    pub vault_quote_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [
            VaultPosition::NAMESPACE.as_ref(),
            vault.key().as_ref(),
            vault.vault_positions_count.to_le_bytes().as_ref(),
        ],
        bump = vault_position.bump,
    )]
    pub vault_position: Box<Account<'info, VaultPosition>>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub token_program: Program<'info, Token>,
}