use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use whirlpools::{
    cpi::{
        self as whirlpool_cpi,
        accounts::{CollectFees, UpdateFeesAndRewards},
    },
    program::Whirlpool as WhirlpoolProgram,
    Position as WhirlpoolPosition, TickArray, Whirlpool,
};

use crate::state::{Vault, VaultPosition};

pub fn update_and_transfer_fees_from_whirlpool<'info>(
    whirlpool: &Account<'info, Whirlpool>,
    whirlpool_position: &mut Account<'info, WhirlpoolPosition>,
    whirlpool_position_token_account: &Account<'info, TokenAccount>,
    tick_array_lower: &AccountLoader<'info, TickArray>,
    tick_array_upper: &AccountLoader<'info, TickArray>,
    whirlpool_base_token_vault: &Account<'info, TokenAccount>,
    whirlpool_quote_token_vault: &Account<'info, TokenAccount>,
    vault: &Account<'info, Vault>,
    vault_base_token_account: &Account<'info, TokenAccount>,
    vault_quote_token_account: &Account<'info, TokenAccount>,
    vault_position: &mut Account<'info, VaultPosition>,
    whirlpool_program: &Program<'info, WhirlpoolProgram>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    update_global_fees(
        whirlpool,
        whirlpool_position,
        tick_array_lower,
        tick_array_upper,
        whirlpool_program,
    )?;

    transfer_to_vault(
        whirlpool,
        whirlpool_base_token_vault,
        whirlpool_quote_token_vault,
        vault,
        vault_base_token_account,
        vault_quote_token_account,
        whirlpool_position,
        whirlpool_position_token_account,
        whirlpool_program,
        token_program,
    )?;

    whirlpool_position.reload()?;

    vault_position.update_fees(whirlpool.fee_growth_global_a, whirlpool.fee_growth_global_b);

    Ok(())
}

pub fn update_global_fees<'info>(
    whirlpool: &Account<'info, Whirlpool>,
    whirlpool_position: &Account<'info, WhirlpoolPosition>,
    tick_array_lower: &AccountLoader<'info, TickArray>,
    tick_array_upper: &AccountLoader<'info, TickArray>,
    whirlpool_program: &Program<'info, WhirlpoolProgram>,
) -> Result<()> {
    let accounts = UpdateFeesAndRewards {
        whirlpool: whirlpool.to_account_info(),
        position: whirlpool_position.to_account_info(),
        tick_array_lower: tick_array_lower.to_account_info(),
        tick_array_upper: tick_array_upper.to_account_info(),
    };
    let ctx = CpiContext::new(whirlpool_program.to_account_info(), accounts);

    whirlpool_cpi::update_fees_and_rewards(ctx)
}

pub fn transfer_to_vault<'info>(
    whirlpool: &Account<'info, Whirlpool>,
    whirlpool_base_token_vault: &Account<'info, TokenAccount>,
    whirlpool_quote_token_vault: &Account<'info, TokenAccount>,
    vault: &Account<'info, Vault>,
    vault_base_token_account: &Account<'info, TokenAccount>,
    vault_quote_token_account: &Account<'info, TokenAccount>,
    whirlpool_position: &Account<'info, WhirlpoolPosition>,
    whirlpool_position_token_account: &Account<'info, TokenAccount>,
    whirlpool_program: &Program<'info, WhirlpoolProgram>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    let accounts = CollectFees {
        whirlpool: whirlpool.to_account_info(),
        token_vault_a: whirlpool_base_token_vault.to_account_info(),
        token_vault_b: whirlpool_quote_token_vault.to_account_info(),
        position_authority: vault.to_account_info(),
        token_owner_account_a: vault_base_token_account.to_account_info(),
        token_owner_account_b: vault_quote_token_account.to_account_info(),
        position: whirlpool_position.to_account_info(),
        position_token_account: whirlpool_position_token_account.to_account_info(),
        token_program: token_program.to_account_info(),
    };
    let ctx = CpiContext::new(whirlpool_program.to_account_info(), accounts);

    whirlpool_cpi::collect_fees(ctx)
}
