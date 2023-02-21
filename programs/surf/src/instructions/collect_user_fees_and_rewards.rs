use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use whirlpools::Whirlpool;

use crate::state::{UserPosition, VaultState};

pub fn handler(ctx: Context<CollectUserFeesAndRewards>) -> Result<()> {
    let user_position = &ctx.accounts.user_position;
    let token_program = &ctx.accounts.token_program;

    let whirlpool_key = ctx.accounts.whirlpool.key();
    let vault_state_signer_seeds: &[&[&[u8]]] = &[&[
        VaultState::NAMESPACE.as_ref(),
        whirlpool_key.as_ref(),
        &[ctx.accounts.vault_state.bump],
    ]];

    token::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_base_token_account.to_account_info(),
                to: ctx.accounts.owner_base_token_account.to_account_info(),
                authority: ctx.accounts.vault_state.to_account_info(),
            },
        )
        .with_signer(vault_state_signer_seeds),
        user_position.fee_unclaimed_base_token,
    )?;

    token::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_quote_token_account.to_account_info(),
                to: ctx.accounts.owner_quote_token_account.to_account_info(),
                authority: ctx.accounts.vault_state.to_account_info(),
            },
        )
        .with_signer(vault_state_signer_seeds),
        user_position.fee_unclaimed_quote_token,
    )?;

    // TODO: Transfer rewards
    Ok(())
}

#[derive(Accounts)]
pub struct CollectUserFeesAndRewards<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        token::mint = vault_state.base_token_mint,
        token::authority = owner,
    )]
    pub owner_base_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = vault_state.quote_token_mint,
        token::authority = owner,
    )]
    pub owner_quote_token_account: Account<'info, TokenAccount>,

    pub vault_state: Box<Account<'info, VaultState>>,

    #[account(
        address = vault_state.whirlpool,
    )]
    pub whirlpool: Box<Account<'info, Whirlpool>>,

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
    pub user_position: Account<'info, UserPosition>,

    pub token_program: Program<'info, Token>,
}
