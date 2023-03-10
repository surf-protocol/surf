use anchor_lang::prelude::*;
use anchor_spl::token::{self as token_cpi, Token, TokenAccount, Transfer};
use whirlpools::{
    cpi::{
        self as whirlpool_cpi,
        accounts::{CollectFees, DecreaseLiquidity as DecreaseWhirlpoolLiquidity},
    },
    program::Whirlpool as WhirlpoolProgram,
    Position, TickArray, Whirlpool,
};

use crate::{
    errors::SurfError,
    helpers::whirlpool::{
        sync_vault_whirlpool_position, transfer_whirlpool_fees_and_rewards_to_vault,
        update_user_fees_and_rewards, CollectWhirlpoolFeesAndRewardsContext,
    },
    state::{UserPosition, VaultState, WhirlpoolPosition as VaultWhirlpoolPosition},
    transfer_tokens_from_vault_to_user_context_impl,
    utils::{
        constraints::validate_user_position_sync, orca::liquidity_math::get_whirlpool_tokens_deltas,
    },
};

pub fn handler(ctx: Context<DecreaseLiquidity>, liquidity: u128) -> Result<()> {
    require!(
        ctx.accounts.user_position.liquidity > 0,
        SurfError::ZeroLiquidity
    );
    require!(
        ctx.accounts.user_position.liquidity >= liquidity,
        SurfError::InvalidLiquidity,
    );
    sync_vault_whirlpool_position(
        &mut ctx.accounts.vault_whirlpool_position,
        &mut ctx.accounts.whirlpool,
        &ctx.accounts.whirlpool_position,
        &ctx.accounts.tick_array_lower,
        &ctx.accounts.tick_array_upper,
        &ctx.accounts.whirlpool_program,
    )?;
    transfer_whirlpool_fees_and_rewards_to_vault(&ctx, &ctx.accounts.vault_state)?;

    let user_position = &mut ctx.accounts.user_position;
    let vault_whirlpool_position = &ctx.accounts.vault_whirlpool_position;

    validate_user_position_sync(user_position, None, Some(&vault_whirlpool_position))?;
    update_user_fees_and_rewards(user_position, &vault_whirlpool_position);

    let user_position = &ctx.accounts.user_position;
    let current_sqrt_price = ctx.accounts.whirlpool.sqrt_price;
    let upper_sqrt_price = vault_whirlpool_position.upper_sqrt_price;
    let lower_sqrt_price = vault_whirlpool_position.lower_sqrt_price;

    let (base_token_amount, quote_token_amount) = get_whirlpool_tokens_deltas(
        liquidity,
        current_sqrt_price,
        upper_sqrt_price,
        lower_sqrt_price,
        false,
    )?;

    whirlpool_cpi::decrease_liquidity(
        ctx.accounts
            .decrease_liquidity_context()
            .with_signer(&[&ctx.accounts.vault_state.get_signer_seeds()]),
        user_position.liquidity,
        base_token_amount,
        quote_token_amount,
    )?;

    token_cpi::transfer(
        ctx.accounts
            .transfer_base_token_from_vault_to_user()
            .with_signer(&[&ctx.accounts.vault_state.get_signer_seeds()]),
        base_token_amount + user_position.fee_unclaimed_base_token,
    )?;
    token_cpi::transfer(
        ctx.accounts
            .transfer_quote_token_from_vault_to_user()
            .with_signer(&[&ctx.accounts.vault_state.get_signer_seeds()]),
        quote_token_amount + user_position.fee_unclaimed_quote_token,
    )?;

    ctx.accounts.user_position.reset_fees_and_rewards();
    ctx.accounts.user_position.decrease_liquidity(liquidity);
    ctx.accounts
        .vault_whirlpool_position
        .decrease_liquidity(liquidity);

    Ok(())
}

#[derive(Accounts)]
pub struct DecreaseLiquidity<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        token::authority = owner,
        token::mint = vault_state.base_token_mint,
    )]
    pub owner_base_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        token::authority = owner,
        token::mint = vault_state.quote_token_mint,
    )]
    pub owner_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [
            UserPosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            owner.key().as_ref(),
        ],
        bump = user_position.bump,
    )]
    pub user_position: Box<Account<'info, UserPosition>>,

    #[account(
        constraint = vault_state.whirlpool_positions_count > 0,
    )]
    pub vault_state: Box<Account<'info, VaultState>>,

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
            VaultWhirlpoolPosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            vault_state.current_whirlpool_position_id.unwrap().to_le_bytes().as_ref(),
        ],
        bump = vault_whirlpool_position.bump,
    )]
    pub vault_whirlpool_position: Box<Account<'info, VaultWhirlpoolPosition>>,

    // ---------
    // WHIRLPOOL ACCOUNTS
    #[account(
        mut,
        address = vault_state.whirlpool,
    )]
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

    #[account(
        mut,
        address = vault_whirlpool_position.whirlpool_position,
    )]
    pub whirlpool_position: Box<Account<'info, Position>>,
    pub whirlpool_position_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub tick_array_lower: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub tick_array_upper: AccountLoader<'info, TickArray>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub token_program: Program<'info, Token>,
}

impl<'info> DecreaseLiquidity<'info> {
    pub fn decrease_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, DecreaseWhirlpoolLiquidity<'info>> {
        let program = &self.whirlpool_program;
        let accounts = DecreaseWhirlpoolLiquidity {
            whirlpool: self.whirlpool.to_account_info(),
            token_vault_a: self.whirlpool_base_token_vault.to_account_info(),
            token_vault_b: self.whirlpool_quote_token_vault.to_account_info(),
            position: self.whirlpool_position.to_account_info(),
            position_token_account: self.whirlpool_position_token_account.to_account_info(),
            position_authority: self.vault_state.to_account_info(),
            token_owner_account_a: self.vault_base_token_account.to_account_info(),
            token_owner_account_b: self.vault_quote_token_account.to_account_info(),
            tick_array_lower: self.tick_array_lower.to_account_info(),
            tick_array_upper: self.tick_array_upper.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }
}

impl<'info> CollectWhirlpoolFeesAndRewardsContext<'info> for DecreaseLiquidity<'info> {
    fn collect_whirlpool_fees_context(&self) -> CpiContext<'_, '_, '_, 'info, CollectFees<'info>> {
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

transfer_tokens_from_vault_to_user_context_impl!(DecreaseLiquidity);
