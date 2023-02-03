use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use whirlpools::{
    cpi::{
        self as whirlpool_cpi,
        accounts::{IncreaseLiquidity, Swap},
    },
    program::Whirlpool as WhirlpoolProgram,
    Position as WhirlpoolPosition, TickArray, Whirlpool,
};
use whirlpools_client::math::{sqrt_price_from_tick_index, MAX_SQRT_PRICE_X64};

use crate::{
    errors::SurfError,
    state::{UserPosition, Vault},
    utils::{
        constraints::have_matching_mints,
        orca::liquidity_math::{
            get_liquidity_from_base_token, get_liquidity_from_quote_token,
            get_whirlpool_input_tokens_deltas,
        },
    },
};

pub fn handler(
    ctx: Context<DepositLiquidity>,
    deposit_quote_amount: u64,
    // TODO: try to use better slippage checks
    deposit_quote_amount_max: u64,
) -> Result<()> {
    let lower_sqrt_price =
        sqrt_price_from_tick_index(ctx.accounts.whirlpool_position.tick_lower_index);
    let upper_sqrt_price =
        sqrt_price_from_tick_index(ctx.accounts.whirlpool_position.tick_upper_index);

    // -------
    // PREPARE INPUTS
    let estimated_liquidity_input = get_liquidity_from_quote_token(
        deposit_quote_amount,
        lower_sqrt_price,
        upper_sqrt_price,
        false,
    );
    let current_sqrt_price = ctx.accounts.whirlpool.sqrt_price;

    let (estimated_base_input, estimated_quote_input) = get_whirlpool_input_tokens_deltas(
        estimated_liquidity_input,
        current_sqrt_price,
        upper_sqrt_price,
        lower_sqrt_price,
    )?;

    let pre_swap_payer_quote_amount = ctx.accounts.payer_quote_token_account.amount;
    let whirlpool_prepare_swap_context = ctx.accounts.get_prepare_swap_context();
    whirlpool_cpi::swap(
        whirlpool_prepare_swap_context,
        estimated_base_input,
        u64::MAX,
        MAX_SQRT_PRICE_X64,
        false,
        false,
    )?;
    ctx.accounts.payer_quote_token_account.reload()?;
    let post_swap_payer_quote_amount = ctx.accounts.payer_quote_token_account.amount;
    let whirlpool_input_base_amount_denominated =
        pre_swap_payer_quote_amount - post_swap_payer_quote_amount;

    // -------
    // GET NEW DEPOSIT AMOUNTS
    let mut real_liquidity_input = estimated_liquidity_input;
    let mut real_base_input = estimated_base_input;
    let mut real_quote_input = estimated_quote_input;

    let deposit_whirlpool_key = ctx.accounts.whirlpool.key();
    let prepare_swap_whirlpool_key = ctx.accounts.prepare_swap_whirlpool.key();

    if deposit_whirlpool_key.eq(&prepare_swap_whirlpool_key) {
        let whirlpool = &mut ctx.accounts.whirlpool;
        whirlpool.reload()?;
        let updated_current_sqrt_price = whirlpool.sqrt_price;

        if current_sqrt_price != updated_current_sqrt_price {
            real_liquidity_input = get_liquidity_from_base_token(
                real_base_input,
                updated_current_sqrt_price,
                upper_sqrt_price,
                false,
            )?;
            let (_real_base_input, _real_quote_input) = get_whirlpool_input_tokens_deltas(
                real_liquidity_input,
                updated_current_sqrt_price,
                upper_sqrt_price,
                lower_sqrt_price,
            )?;
            real_base_input = _real_base_input;
            real_quote_input = _real_quote_input;
        }
    }

    let real_deposit_quote_amount = whirlpool_input_base_amount_denominated + real_quote_input;
    if real_deposit_quote_amount > deposit_quote_amount_max {
        return Err(SurfError::SlippageExceeded.into());
    }

    msg!("total quote {}", real_deposit_quote_amount);
    msg!("base {}", real_base_input);
    msg!("quote {}", real_quote_input);

    // -------
    // TRANSFER TO VAULT ACCOUNTS
    let token_program = &ctx.accounts.token_program;
    token::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer_base_token_account.to_account_info(),
                to: ctx.accounts.vault_base_token_account.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        real_base_input,
    )?;
    token::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer_quote_token_account.to_account_info(),
                to: ctx.accounts.vault_quote_token_account.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        real_quote_input,
    )?;

    // -------
    // DEPOSIT TO WHIRLPOOL
    let increase_liquidity_context = ctx.accounts.get_increase_liquidity_context();
    whirlpool_cpi::increase_liquidity(
        increase_liquidity_context.with_signer(&[&[
            Vault::NAMESPACE.as_ref(),
            ctx.accounts.whirlpool.key().as_ref(),
            &[ctx.accounts.vault.bump],
        ]]),
        real_liquidity_input,
        real_base_input,
        real_quote_input,
    )?;

    let vault = &ctx.accounts.vault;
    let user_position_bump = ctx.bumps.get("user_position").unwrap();
    ctx.accounts.user_position.initialize(
        *user_position_bump,
        vault.key(),
        real_liquidity_input,
        vault.base_token_total_fee_growth,
        vault.quote_token_total_fee_growth,
    );

    Ok(())
}

#[derive(Accounts)]
pub struct DepositLiquidity<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut,
        constraint = payer_base_token_account.mint.eq(&whirlpool.token_mint_a)
    )]
    pub payer_base_token_account: Account<'info, TokenAccount>,

    #[account(mut,
        constraint = payer_quote_token_account.mint.eq(&whirlpool.token_mint_b)
    )]
    pub payer_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut,
        has_one = whirlpool_position,
        seeds = [
            Vault::NAMESPACE.as_ref(),
            whirlpool.key().as_ref()
        ],
        bump = vault.bump,
    )]
    pub vault: Box<Account<'info, Vault>>,
    #[account(mut,
        address = vault.base_token_account.key()
    )]
    pub vault_base_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        address = vault.quote_token_account.key()
    )]
    pub vault_quote_token_account: Box<Account<'info, TokenAccount>>,

    // TODO: Init only if needed for subsequent deposits
    #[account(init,
        seeds = [
            UserPosition::NAMESPACE.as_ref(),
            vault.key().as_ref(),
            payer.key().as_ref(),
        ],
        bump,
        space = UserPosition::LEN,
        payer = payer
    )]
    pub user_position: Account<'info, UserPosition>,

    // -------------
    // PREPARE SWAP ACCOUNTS
    #[account(mut)]
    pub prepare_swap_whirlpool: Box<Account<'info, Whirlpool>>,

    #[account(mut, address = prepare_swap_whirlpool.token_vault_a)]
    pub prepare_swap_whirlpool_base_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = prepare_swap_whirlpool.token_vault_b)]
    pub prepare_swap_whirlpool_quote_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut,
        constraint = prepare_swap_tick_array_0.load()?.whirlpool.key().eq(&prepare_swap_whirlpool.key())
    )]
    pub prepare_swap_tick_array_0: AccountLoader<'info, TickArray>,
    #[account(mut,
        constraint = prepare_swap_tick_array_1.load()?.whirlpool.key().eq(&prepare_swap_whirlpool.key())
    )]
    pub prepare_swap_tick_array_1: AccountLoader<'info, TickArray>,
    #[account(mut,
        constraint = prepare_swap_tick_array_2.load()?.whirlpool.key().eq(&prepare_swap_whirlpool.key())
    )]
    pub prepare_swap_tick_array_2: AccountLoader<'info, TickArray>,

    /// CHECK: Unused in whirlpools
    #[account(
        seeds = [
            b"oracle".as_ref(),
            prepare_swap_whirlpool.key().as_ref()
        ],
        bump,
        seeds::program = whirlpool_program.key()
    )]
    pub prepare_swap_oracle: UncheckedAccount<'info>,

    // ----------------
    // WHIRLPOOL DEPOSIT ACCOUNT
    #[account(mut, has_one = whirlpool)]
    pub whirlpool_position: Box<Account<'info, WhirlpoolPosition>>,
    #[account(mut,
        constraint = whirlpool_position_token_account.amount == 1,
        associated_token::mint = whirlpool_position.position_mint,
        associated_token::authority = vault,
    )]
    pub whirlpool_position_token_account: Box<Account<'info, TokenAccount>>,

    // Whirlpool program performs checks
    #[account(mut)]
    pub whirlpool_position_tick_array_lower: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub whirlpool_position_tick_array_upper: AccountLoader<'info, TickArray>,

    #[account(mut,
        constraint = have_matching_mints(&whirlpool, &prepare_swap_whirlpool) @SurfError::WhirlpoolMintsNotMatching
    )]
    pub whirlpool: Box<Account<'info, Whirlpool>>,

    #[account(mut,
        address = whirlpool.token_vault_a.key()
    )]
    pub whirlpool_base_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        address = whirlpool.token_vault_b.key()
    )]
    pub whirlpool_quote_token_vault: Box<Account<'info, TokenAccount>>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> DepositLiquidity<'info> {
    pub fn get_prepare_swap_context(&self) -> CpiContext<'_, '_, '_, 'info, Swap<'info>> {
        let accounts = Swap {
            token_authority: self.payer.to_account_info(),
            token_owner_account_a: self.payer_base_token_account.to_account_info(),
            token_owner_account_b: self.payer_quote_token_account.to_account_info(),
            whirlpool: self.prepare_swap_whirlpool.to_account_info(),
            token_vault_a: self
                .prepare_swap_whirlpool_base_token_vault
                .to_account_info(),
            token_vault_b: self
                .prepare_swap_whirlpool_quote_token_vault
                .to_account_info(),
            tick_array0: self.prepare_swap_tick_array_0.to_account_info(),
            tick_array1: self.prepare_swap_tick_array_1.to_account_info(),
            tick_array2: self.prepare_swap_tick_array_2.to_account_info(),
            oracle: self.prepare_swap_oracle.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(self.whirlpool_program.to_account_info(), accounts)
    }

    pub fn get_increase_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, IncreaseLiquidity<'info>> {
        let increase_liq_accounts = IncreaseLiquidity {
            whirlpool: self.whirlpool.to_account_info(),
            position_authority: self.vault.to_account_info(),
            position: self.whirlpool_position.to_account_info(),
            position_token_account: self.whirlpool_position_token_account.to_account_info(),
            token_owner_account_a: self.vault_base_token_account.to_account_info(),
            token_owner_account_b: self.vault_quote_token_account.to_account_info(),
            token_vault_a: self.whirlpool_base_token_vault.to_account_info(),
            token_vault_b: self.whirlpool_quote_token_vault.to_account_info(),
            tick_array_lower: self.whirlpool_position_tick_array_lower.to_account_info(),
            tick_array_upper: self.whirlpool_position_tick_array_upper.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(
            self.whirlpool_program.to_account_info(),
            increase_liq_accounts,
        )
    }
}
