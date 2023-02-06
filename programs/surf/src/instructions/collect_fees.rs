use std::ops::Add;

use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use whirlpools::{
    program::Whirlpool as WhirlpoolProgram, Position as WhirlpoolPosition, TickArray, Whirlpool,
};

use crate::{
    manager::fees::update_and_transfer_fees_from_whirlpool,
    state::{UserPosition, Vault, VaultPosition},
};

/// If user has not collected fees from previous vault positions,
/// include previous vault positions sorted from oldest to the most recent excluding current
/// in remaining accounts
pub fn handler(ctx: Context<CollectFees>) -> Result<()> {
    // TODO: update fees on deposit
    update_and_transfer_fees_from_whirlpool(
        &ctx.accounts.whirlpool,
        &mut ctx.accounts.whirlpool_position,
        &ctx.accounts.whirlpool_position_token_account,
        &ctx.accounts.tick_array_lower,
        &ctx.accounts.tick_array_upper,
        &ctx.accounts.whirlpool_base_token_vault,
        &ctx.accounts.whirlpool_quote_token_vault,
        &mut ctx.accounts.vault,
        &ctx.accounts.vault_base_token_account,
        &ctx.accounts.vault_quote_token_account,
        &mut ctx.accounts.vault_position,
        &ctx.accounts.whirlpool_program,
        &ctx.accounts.token_program,
    )?;

    // ----------
    // SYNC USER POSITION
    // loop through uncollected vault position
    // calculate user liquidity for that vault position
    //      sub hedge adjustment losses for that vault position - checkpoints and current deltas
    //      add fees growths for that vault position - checkpoints and current deltas
    // calculate new user liquidity -> prev user liquidity - price range adjustment losses
    let current_vault_position_id = ctx.accounts.vault_position.id;
    let mut vault_position_id_checkpoint = ctx.accounts.user_position.vault_position_checkpoint;

    let prev_vault_positions_count =
        (current_vault_position_id - vault_position_id_checkpoint) as usize;
    let remaining_account_len = ctx.remaining_accounts.len();

    // Collect only from last one if previous are not needed
    if prev_vault_positions_count == 0 {
        return Ok(());
    }

    if remaining_account_len != prev_vault_positions_count {
        // TODO: Invalid remaining accounts provided
    }

    for vault_position_ai in ctx.remaining_accounts.iter() {
        let vault_position = Account::<VaultPosition>::try_from(vault_position_ai)?;

        // TODO: Some error
        // require_eq!(vault_position.id, vault_position_id_checkpoint)?;

        vault_position_id_checkpoint = vault_position_id_checkpoint.add(1);
    }

    Ok(())
}

#[derive(Accounts)]
pub struct CollectFees<'info> {
    pub position_authority: Signer<'info>,

    #[account(mut,
        seeds = [
            Vault::NAMESPACE.as_ref(),
            whirlpool.key().as_ref(),
        ],
        bump = vault.bump,
    )]
    pub vault: Box<Account<'info, Vault>>,
    #[account(mut,
        address = vault.base_token_account
    )]
    pub vault_base_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        address = vault.quote_token_account
    )]
    pub vault_quote_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = vault.current_vault_position_id.eq(&Some(vault_position.id)),
        seeds = [
            VaultPosition::NAMESPACE.as_ref(),
            vault.key().as_ref(),
            vault_position.id.to_le_bytes().as_ref(),
        ],
        bump = vault_position.bump,
    )]
    pub vault_position: Account<'info, VaultPosition>,
    #[account(mut,
        seeds = [
            UserPosition::NAMESPACE.as_ref(),
            vault.key().as_ref(),
            position_authority.key().as_ref(),
        ],
        bump = user_position.bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(mut)]
    pub whirlpool: Box<Account<'info, Whirlpool>>,
    #[account(mut,
        address = whirlpool.token_vault_a,
    )]
    pub whirlpool_base_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        address = whirlpool.token_vault_b,
    )]
    pub whirlpool_quote_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut,
        address = vault_position.whirlpool_position,
    )]
    pub whirlpool_position: Box<Account<'info, WhirlpoolPosition>>,
    #[account(
        associated_token::mint = whirlpool_position.position_mint,
        associated_token::authority = vault,
    )]
    pub whirlpool_position_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut, has_one = whirlpool)]
    pub tick_array_lower: AccountLoader<'info, TickArray>,
    #[account(mut, has_one = whirlpool)]
    pub tick_array_upper: AccountLoader<'info, TickArray>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub token_program: Program<'info, Token>,
}
