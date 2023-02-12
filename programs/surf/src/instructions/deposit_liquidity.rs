use anchor_lang::prelude::*;
use anchor_spl::token::{self as token_cpi, Token, TokenAccount, Transfer};
use whirlpools::{
    cpi::{
        self as whirlpool_cpi,
        accounts::{IncreaseLiquidity, Swap},
    },
    program::Whirlpool as WhirlpoolProgram,
    Position as WhirlpoolPosition, TickArray, Whirlpool,
};
use whirlpools_client::math::MAX_SQRT_PRICE_X64;

use crate::{
    errors::SurfError,
    state::{UserPosition, Vault, VaultPosition},
    utils::{
        constraints::{have_matching_mints, is_vault_position_open, is_vault_position_updated},
        orca::liquidity_math::{get_liquidity_from_base_token, get_whirlpool_tokens_deltas},
    },
};

pub fn handler(
    ctx: Context<DepositLiquidity>,
    estimated_liquidity_input: u128,
    // TODO: try to use better slippage checks
    deposit_quote_input_max: u64,
) -> Result<()> {
    let vault_position = &ctx.accounts.vault_position;

    let lower_sqrt_price = vault_position.lower_sqrt_price;
    let upper_sqrt_price = vault_position.upper_sqrt_price;
    let current_sqrt_price = ctx.accounts.whirlpool.sqrt_price;

    // PREPARE TOKEN AMOUNTS
    let (estimated_base_input, estimated_quote_input) = get_whirlpool_tokens_deltas(
        estimated_liquidity_input,
        current_sqrt_price,
        upper_sqrt_price,
        lower_sqrt_price,
        true,
    )?;

    whirlpool_cpi::swap(
        ctx.accounts.whirlpool_swap_context(),
        estimated_base_input,
        u64::MAX,
        MAX_SQRT_PRICE_X64,
        false,
        false,
    )?;

    // CHECK IF TOTAL DEPOSIT AMOUNT IS IN BOUNDS OF SLIPPAGE
    let pre_swap_payer_quote_token_amount = ctx.accounts.payer_quote_token_account.amount;
    ctx.accounts.payer_quote_token_account.reload()?;
    let post_swap_payer_quote_token_amount = ctx.accounts.payer_quote_token_account.amount;

    let total_quote_deposit_amount =
        pre_swap_payer_quote_token_amount - post_swap_payer_quote_token_amount;
    if total_quote_deposit_amount > deposit_quote_input_max {
        return Err(SurfError::SlippageExceeded.into());
    }

    // UPDATE INPUTS IF WHIRLPOOLS ARE THE SAME
    let mut real_liquidity_input = estimated_liquidity_input;
    let mut real_base_input = estimated_base_input;
    let mut real_quote_input = estimated_quote_input;

    if ctx.accounts.whirlpool.key() == ctx.accounts.swap_whirlpool.key() {
        let whirlpool = &mut ctx.accounts.whirlpool;
        whirlpool.reload()?;
        real_liquidity_input = get_liquidity_from_base_token(
            real_base_input,
            whirlpool.sqrt_price,
            upper_sqrt_price,
            false,
        )?;
        let (_real_base_input, _real_quote_input) = get_whirlpool_tokens_deltas(
            real_liquidity_input,
            whirlpool.sqrt_price,
            upper_sqrt_price,
            lower_sqrt_price,
            true,
        )?;
        real_base_input = _real_base_input;
        real_quote_input = _real_quote_input;
    }

    // TRANSFER TOKENS TO VAULT
    let payer = &ctx.accounts.payer;
    let payer_base_token_account = &ctx.accounts.payer_base_token_account;
    let payer_quote_token_account = &ctx.accounts.payer_quote_token_account;
    let vault_base_token_account = &ctx.accounts.vault_base_token_account;
    let vault_quote_token_account = &ctx.accounts.vault_quote_token_account;

    let token_program = &ctx.accounts.token_program;
    token_cpi::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: payer_base_token_account.to_account_info(),
                to: vault_base_token_account.to_account_info(),
                authority: payer.to_account_info(),
            },
        ),
        real_base_input,
    )?;
    token_cpi::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: payer_quote_token_account.to_account_info(),
                to: vault_quote_token_account.to_account_info(),
                authority: payer.to_account_info(),
            },
        ),
        real_quote_input,
    )?;

    // DEPOSIT LIQUIDITY
    whirlpool_cpi::increase_liquidity(
        ctx.accounts.whirlpool_deposit_context(),
        real_liquidity_input,
        real_base_input,
        real_quote_input,
    )?; // -> updates fees and rewards

    // UPDATE VAULT AND USER POSITION
    // happens after increase_liquidity cpi so no need to update fees and rewards manually
    // even if the swap whirlpool was the same as liquidity whirlpool
    let whirlpool = &mut ctx.accounts.whirlpool;
    whirlpool.reload()?;

    ctx.accounts
        .vault_position
        .deposit_liquidity(whirlpool, real_liquidity_input)?;

    if ctx.accounts.user_position.liquidity != 0 {
        ctx.accounts
            .user_position
            .update_fees_and_hedge_losses(&ctx.accounts.vault_position);
    }

    // UPDATE USER POSITION
    ctx.accounts
        .user_position
        .deposit_liquidity(real_liquidity_input, &ctx.accounts.vault_position)?;

    Ok(())
}

#[derive(Accounts)]
pub struct DepositLiquidity<'info> {
    pub payer: Signer<'info>,

    #[account(
        mut,
        token::mint = vault.base_token_account,
        token::authority = payer.key(),
    )]
    pub payer_base_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = vault.quote_token_account,
        token::authority = payer.key(),
    )]
    pub payer_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_position.vault_position_checkpoint == vault.vault_positions_count @SurfError::UserPositionNotSynced,
        seeds = [
            UserPosition::NAMESPACE.as_ref(),
            vault.key().as_ref(),
            payer.key().as_ref(),
        ],
        bump = user_position.bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(
        mut,
        constraint = vault_position.vault.eq(&vault.key()),
        constraint = vault_position.id == vault.vault_positions_count,
        constraint = is_vault_position_updated(&vault_position, &whirlpool) @SurfError::VaultPositionNotUpdated,
        constraint = is_vault_position_open(&vault_position) @SurfError::VaultPositionNotOpened,
        has_one = whirlpool_position,
    )]
    pub vault_position: Account<'info, VaultPosition>,

    #[account(
        has_one = whirlpool,
    )]
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

    // ----------------
    // DEPOSIT ACCOUNTS
    pub whirlpool_position: Box<Account<'info, WhirlpoolPosition>>,
    pub whirlpool_position_token_account: Box<Account<'info, TokenAccount>>,

    pub whirlpool: Account<'info, Whirlpool>,

    pub tick_array_lower: AccountLoader<'info, TickArray>,
    pub tick_array_upper: AccountLoader<'info, TickArray>,

    // ----------------
    // SWAP ACCOUNTS
    #[account(
        mut,
        constraint = have_matching_mints(&swap_whirlpool, &whirlpool) @SurfError::WhirlpoolMintsNotMatching,
    )]
    pub swap_whirlpool: Box<Account<'info, Whirlpool>>,
    #[account(
        mut,
        address = swap_whirlpool.token_vault_a,
    )]
    pub swap_whirlpool_base_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = swap_whirlpool.token_vault_b,
    )]
    pub swap_whirlpool_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = tick_array_0.load()?.whirlpool.eq(&swap_whirlpool.key()),
    )]
    pub tick_array_0: AccountLoader<'info, TickArray>,
    #[account(
        mut,
        constraint = tick_array_1.load()?.whirlpool.eq(&swap_whirlpool.key()),
    )]
    pub tick_array_1: AccountLoader<'info, TickArray>,
    #[account(
        mut,
        constraint = tick_array_2.load()?.whirlpool.eq(&swap_whirlpool.key()),
    )]
    pub tick_array_2: AccountLoader<'info, TickArray>,
    /// CHECK: Orca CPI checks if the account is correct
    pub swap_oracle: UncheckedAccount<'info>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub token_program: Program<'info, Token>,
}

impl<'info> DepositLiquidity<'info> {
    pub fn whirlpool_swap_context(&self) -> CpiContext<'_, '_, '_, 'info, Swap<'info>> {
        let program = &self.whirlpool_program;
        let accounts = Swap {
            whirlpool: self.swap_whirlpool.to_account_info(),
            token_vault_a: self.swap_whirlpool_base_token_account.to_account_info(),
            token_vault_b: self.swap_whirlpool_quote_token_account.to_account_info(),
            token_authority: self.payer.to_account_info(),
            token_owner_account_a: self.payer_base_token_account.to_account_info(),
            token_owner_account_b: self.payer_quote_token_account.to_account_info(),
            tick_array0: self.tick_array_0.to_account_info(),
            tick_array1: self.tick_array_1.to_account_info(),
            tick_array2: self.tick_array_2.to_account_info(),
            oracle: self.swap_oracle.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }

    pub fn whirlpool_deposit_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, IncreaseLiquidity<'info>> {
        let program = &self.whirlpool_program;
        let accounts = IncreaseLiquidity {
            whirlpool: self.whirlpool.to_account_info(),
            token_vault_a: self.swap_whirlpool_base_token_account.to_account_info(),
            token_vault_b: self.swap_whirlpool_quote_token_account.to_account_info(),
            position_authority: self.vault.to_account_info(),
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
