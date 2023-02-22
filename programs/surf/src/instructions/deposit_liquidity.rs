use anchor_lang::prelude::*;
use anchor_spl::token::{self as token_cpi, Token, TokenAccount, Transfer};
use whirlpools::{
    cpi::{self as whirlpool_cpi, accounts::IncreaseLiquidity},
    program::Whirlpool as WhirlpoolProgram,
    Position as WhirlpoolPosition, TickArray, Whirlpool,
};

use crate::{
    helpers::whirlpool::{sync_vault_whirlpool_position, update_user_fees_and_rewards},
    state::{UserPosition, VaultState, WhirlpoolPosition as VaultWhirlpoolPosition},
    utils::orca::liquidity_math::get_whirlpool_tokens_deltas,
};

pub fn handler(
    ctx: Context<DepositLiquidity>,
    liquidity_input: u128,
    base_token_max: u64,
    quote_token_max: u64,
) -> Result<()> {
    // 1. sync vault whirlpool position and user position
    let whirlpool = &mut ctx.accounts.whirlpool;
    let whirlpool_position = &ctx.accounts.whirlpool_position;
    let tick_array_lower = &ctx.accounts.tick_array_lower;
    let tick_array_upper = &ctx.accounts.tick_array_upper;
    let whirlpool_program = &ctx.accounts.whirlpool_program;

    sync_vault_whirlpool_position(
        &mut ctx.accounts.vault_whirlpool_position,
        whirlpool,
        whirlpool_position,
        tick_array_lower,
        tick_array_upper,
        whirlpool_program,
    )?;

    update_user_fees_and_rewards(
        &mut ctx.accounts.user_position,
        &ctx.accounts.vault_whirlpool_position,
    );

    // 2. transfer from owner to vault
    let vault_whirlpool_position = &ctx.accounts.vault_whirlpool_position;
    let upper_sqrt_price = vault_whirlpool_position.upper_sqrt_price;
    let lower_sqrt_price = vault_whirlpool_position.lower_sqrt_price;
    let current_sqrt_price = whirlpool.sqrt_price;

    let (base_token_amount, quote_token_amount) = get_whirlpool_tokens_deltas(
        liquidity_input,
        current_sqrt_price,
        upper_sqrt_price,
        lower_sqrt_price,
        true,
    )?;

    let token_program = &ctx.accounts.token_program;

    token_cpi::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.owner_base_token_account.to_account_info(),
                to: ctx.accounts.vault_base_token_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        base_token_amount,
    )?;

    token_cpi::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.owner_quote_token_account.to_account_info(),
                to: ctx.accounts.vault_quote_token_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        quote_token_amount,
    )?;

    // 3. transfer from vault to whirlpool
    whirlpool_cpi::increase_liquidity(
        ctx.accounts.deposit_liquidity_context(),
        liquidity_input,
        base_token_max,
        quote_token_max,
    )?;

    // 4. update program accounts
    ctx.accounts
        .user_position
        .deposit_liquidity(liquidity_input)?;

    ctx.accounts
        .vault_whirlpool_position
        .deposit_liquidity(liquidity_input)?;

    Ok(())
}

#[derive(Accounts)]
pub struct DepositLiquidity<'info> {
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

    #[account(
        mut,
        seeds = [
            UserPosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            owner.key().as_ref(),
        ],
        bump = user_position.bump,
        constraint = Some(user_position.whirlpool_position_id) == vault_state.current_whirlpool_position_id,
    )]
    pub user_position: Account<'info, UserPosition>,

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
        constraint = Some(vault_whirlpool_position.id) == vault_state.current_whirlpool_position_id,
        constraint = vault_whirlpool_position.key().eq(&vault_state.key()),
    )]
    pub vault_whirlpool_position: Account<'info, VaultWhirlpoolPosition>,
    #[account(
        mut,
        address = vault_whirlpool_position.whirlpool_position,
    )]
    pub whirlpool_position: Box<Account<'info, WhirlpoolPosition>>,
    pub whirlpool_position_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        address = vault_state.whirlpool,
    )]
    pub whirlpool: Box<Account<'info, Whirlpool>>,
    #[account(
        address = whirlpool.token_vault_a,
    )]
    pub whirlpool_base_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        address = whirlpool.token_vault_b,
    )]
    pub whirlpool_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub tick_array_lower: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub tick_array_upper: AccountLoader<'info, TickArray>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub token_program: Program<'info, Token>,
}

impl<'info> DepositLiquidity<'info> {
    pub fn deposit_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, IncreaseLiquidity<'info>> {
        let program = &self.whirlpool_program;
        let accounts = IncreaseLiquidity {
            whirlpool: self.whirlpool.to_account_info(),
            token_vault_a: self.whirlpool_base_token_account.to_account_info(),
            token_vault_b: self.whirlpool_quote_token_account.to_account_info(),
            position_authority: self.vault_state.to_account_info(),
            token_owner_account_a: self.vault_base_token_account.to_account_info(),
            token_owner_account_b: self.vault_quote_token_account.to_account_info(),
            position: self.whirlpool_position.to_account_info(),
            position_token_account: self.whirlpool_position_token_account.to_account_info(),
            tick_array_lower: self.tick_array_lower.to_account_info(),
            tick_array_upper: self.tick_array_upper.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }
}
