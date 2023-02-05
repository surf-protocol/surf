use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use whirlpools::{
    program::Whirlpool as WhirlpoolProgram, Position as WhirlpoolPosition, TickArray, Whirlpool,
};

use crate::{state::Vault, utils::fees::update_and_collect_global_fees};

pub fn handler(ctx: Context<CollectFees>) -> Result<()> {
    update_and_collect_global_fees(
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
        &ctx.accounts.whirlpool_program,
        &ctx.accounts.token_program,
    )?;

    // ----------
    // UPDATE USER POSITION FEES

    // ----------
    // COLLECT USER FEES

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
        address = vault.whirlpool_position
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
