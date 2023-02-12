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

use crate::state::VaultPosition;

pub fn sync_vault<'info>(
    vault_position: &mut Account<'info, VaultPosition>,
    vault_base_token_account: &Account<'info, TokenAccount>,
    vault_quote_token_account: &Account<'info, TokenAccount>,
    whirlpool: &mut Account<'info, Whirlpool>,
    whirlpool_base_token_vault: &Account<'info, TokenAccount>,
    whirlpool_quote_token_vault: &Account<'info, TokenAccount>,
    whirlpool_position: &Account<'info, WhirlpoolPosition>,
    whirlpool_position_token_account: &Account<'info, TokenAccount>,
    tick_array_lower: &AccountLoader<'info, TickArray>,
    tick_array_upper: &AccountLoader<'info, TickArray>,
    whirlpool_program: &Program<'info, WhirlpoolProgram>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    whirlpool_cpi::update_fees_and_rewards(CpiContext::new(
        whirlpool_program.to_account_info(),
        UpdateFeesAndRewards {
            whirlpool: whirlpool.to_account_info(),
            position: whirlpool_position.to_account_info(),
            tick_array_lower: tick_array_lower.to_account_info(),
            tick_array_upper: tick_array_upper.to_account_info(),
        },
    ))?;

    // TODO: Collecting fees can be separated, has to happen when user collects fees
    whirlpool_cpi::collect_fees(CpiContext::new(
        whirlpool_program.to_account_info(),
        CollectFees {
            whirlpool: whirlpool.to_account_info(),
            token_vault_a: whirlpool_base_token_vault.to_account_info(),
            token_vault_b: whirlpool_quote_token_vault.to_account_info(),
            position_authority: vault_position.to_account_info(),
            token_owner_account_a: vault_base_token_account.to_account_info(),
            token_owner_account_b: vault_quote_token_account.to_account_info(),
            position: whirlpool_position.to_account_info(),
            position_token_account: whirlpool_position_token_account.to_account_info(),
            token_program: token_program.to_account_info(),
        },
    ))?;

    // TODO: Collect rewards

    whirlpool.reload()?;

    vault_position.fee_growth_base_token = whirlpool.fee_growth_global_a;
    vault_position.fee_growth_quote_token = whirlpool.fee_growth_global_b;

    Ok(())
}
