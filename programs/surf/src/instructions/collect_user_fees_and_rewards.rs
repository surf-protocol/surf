use anchor_lang::prelude::*;
use anchor_spl::token::{self as token_cpi, Token, TokenAccount, Transfer};
use whirlpools::Whirlpool;

use crate::{
    state::{UserPosition, VaultState},
    transfer_tokens_from_vault_to_user_context_impl,
};

pub fn handler(ctx: Context<CollectUserFeesAndRewards>) -> Result<()> {
    let user_position = &mut ctx.accounts.user_position;
    let base_token_fee = user_position.fee_unclaimed_base_token;
    let quote_token_fee = user_position.fee_unclaimed_quote_token;

    user_position.reset_fees_and_rewards();

    let whirlpool_key = ctx.accounts.whirlpool.key();
    let signer_seeds: &[&[&[u8]]] = &[&[
        VaultState::NAMESPACE.as_ref(),
        whirlpool_key.as_ref(),
        &[ctx.accounts.vault_state.bump],
    ]];

    token_cpi::transfer(
        ctx.accounts
            .transfer_base_token_from_vault_to_user()
            .with_signer(signer_seeds),
        base_token_fee,
    )?;

    token_cpi::transfer(
        ctx.accounts
            .transfer_quote_token_from_vault_to_user()
            .with_signer(signer_seeds),
        quote_token_fee,
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

transfer_tokens_from_vault_to_user_context_impl!(CollectUserFeesAndRewards);
