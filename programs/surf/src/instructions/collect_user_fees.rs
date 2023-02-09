use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::{UserPosition, Vault};

pub fn handler(ctx: Context<CollectUserFees>) -> Result<()> {
    let user_position = &mut ctx.accounts.user_position;
    let token_program = &ctx.accounts.token_program;

    token::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_base_token_account.to_account_info(),
                to: ctx.accounts.authority_base_token_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        user_position.fee_unclaimed_base_token,
    )?;

    token::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_quote_token_account.to_account_info(),
                to: ctx.accounts.authority_quote_token_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        user_position.fee_unclaimed_quote_token,
    )?;

    user_position.reset_fees();

    Ok(())
}

#[derive(Accounts)]
pub struct CollectUserFees<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        token::authority = authority,
        token::mint = vault.base_token_mint,
    )]
    pub authority_base_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = vault.quote_token_mint,
    )]
    pub authority_quote_token_account: Account<'info, TokenAccount>,

    pub vault: Account<'info, Vault>,

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
        has_one = vault,
    )]
    pub user_position: Account<'info, UserPosition>,

    pub token_program: Program<'info, Token>,
}
