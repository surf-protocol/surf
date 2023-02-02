use anchor_lang::{prelude::*, system_program};
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use drift::{
    cpi::{
        self as drift_cpi,
        accounts::{Deposit as DriftDeposit, Withdraw as DriftWithdraw},
    },
    program::Drift,
    state::{
        spot_market::SpotMarket as DriftSpotMarket,
        state::State as DriftState,
        user::{User as DriftUser, UserStats as DriftUserStats},
    },
};
use whirlpools::{
    cpi as whirlpool_cpi,
    cpi::accounts::{IncreaseLiquidity, Swap},
    program::Whirlpool as WhirlpoolProgram,
    Position as WhirlpoolPosition, TickArray, Whirlpool,
};
use whirlpools_client::{
    errors::ErrorCode as WhirlpoolsErrorCode,
    math::{
        get_amount_delta_a, get_amount_delta_b, sqrt_price_from_tick_index, MAX_SQRT_PRICE_X64,
    },
};

use crate::{
    errors::SurfError,
    state::{AdminConfig, UserPosition, Vault},
    utils::orca::liquidity_math::{get_liquidity_from_base_token, get_liquidity_from_quote_token},
};

pub fn handler(ctx: Context<Deposit>, max_input_quote_amount: u64) -> Result<()> {
    // TODO: Update fees
    let lower_sqrt_price =
        sqrt_price_from_tick_index(ctx.accounts.whirlpool_position.tick_lower_index);
    let upper_sqrt_price =
        sqrt_price_from_tick_index(ctx.accounts.whirlpool_position.tick_upper_index);

    // -------
    // PREPARE INPUTS
    let estimated_whirlpool_quote_input_amount = max_input_quote_amount / 2;
    let estimated_whirlpool_liquidity_input = get_liquidity_from_quote_token(
        estimated_whirlpool_quote_input_amount,
        lower_sqrt_price,
        upper_sqrt_price,
        false,
    );
    let current_sqrt_price = ctx.accounts.whirlpool.sqrt_price;

    let (estimated_base_input, estimated_quote_input) = get_whirlpool_input_tokens_deltas(
        estimated_whirlpool_liquidity_input,
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
    let mut real_whirlpool_liquidity_input = estimated_whirlpool_liquidity_input;
    let mut real_base_input = estimated_base_input;
    let mut real_quote_input = estimated_quote_input;
    let deposit_whirlpool_key = ctx.accounts.whirlpool.key();
    let prepare_swap_whirlpool_key = ctx.accounts.prepare_swap_whirlpool.key();

    if deposit_whirlpool_key.eq(&prepare_swap_whirlpool_key) {
        let whirlpool = &mut ctx.accounts.whirlpool;
        whirlpool.reload()?;
        let updated_current_sqrt_price = whirlpool.sqrt_price;

        if current_sqrt_price != updated_current_sqrt_price {
            real_whirlpool_liquidity_input = get_liquidity_from_base_token(
                real_base_input,
                updated_current_sqrt_price,
                upper_sqrt_price,
                false,
            )?;
            let (_real_base_input, _real_quote_input) = get_whirlpool_input_tokens_deltas(
                real_whirlpool_liquidity_input,
                updated_current_sqrt_price,
                upper_sqrt_price,
                lower_sqrt_price,
            )?;
            real_base_input = _real_base_input;
            real_quote_input = _real_quote_input;
        }
    }

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
        max_input_quote_amount - whirlpool_input_base_amount_denominated,
    )?;

    // -------
    // DEPOSIT TO WHIRLPOOL
    msg!("Increase liquidity base - {}", real_base_input);
    msg!("Increase liquidity quote - {}", real_quote_input);
    let increase_liquidity_context = ctx.accounts.get_whirlpool_increase_liquidity_context();
    whirlpool_cpi::increase_liquidity(
        increase_liquidity_context.with_signer(&[&[
            Vault::NAMESPACE.as_ref(),
            deposit_whirlpool_key.as_ref(),
            &[ctx.accounts.vault.bump],
        ]]),
        real_whirlpool_liquidity_input,
        real_base_input,
        real_quote_input,
    )?;

    // -------
    // DEPOSIT TO DRIFT
    let real_whirlpool_quote_input_amount =
        whirlpool_input_base_amount_denominated + real_quote_input;
    let drift_collateral_quote_amount = max_input_quote_amount - real_whirlpool_quote_input_amount;

    let whirlpool_key = ctx.accounts.whirlpool.key();
    let drift_signer_seeds: &[&[&[u8]]] = &[&[
        Vault::NAMESPACE.as_ref(),
        whirlpool_key.as_ref(),
        &[ctx.accounts.vault.bump],
    ]];

    msg!("Deposit collateral - {}", drift_collateral_quote_amount);
    let drift_deposit_context = ctx.accounts.get_drift_deposit_context(drift_signer_seeds);
    drift_cpi::deposit(
        drift_deposit_context,
        0,
        drift_collateral_quote_amount,
        false,
    )?;

    // Withdraw from drift
    msg!("Borrow - {}", real_base_input);
    let drift_withdraw_context = ctx.accounts.get_drift_withdraw_context(drift_signer_seeds);
    drift_cpi::withdraw(drift_withdraw_context, 1, real_base_input, false)?;

    // Swap withdrawn SOL from drift

    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    // TODO: Add constraints
    #[account(mut,
        constraint = payer_base_token_account.mint.key().eq(&prepare_swap_whirlpool.token_mint_a.key())
    )]
    pub payer_base_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = payer_quote_token_account.mint.key().eq(&prepare_swap_whirlpool.token_mint_b.key())
    )]
    pub payer_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        seeds = [
            AdminConfig::NAMESPACE.as_ref(),
        ],
        bump = admin_config.bump,
    )]
    pub admin_config: Box<Account<'info, AdminConfig>>,

    // -------------
    // Prepare swap accounts
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
    // Whirlpool deposit accounts
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

    #[account(mut, has_one = whirlpool)]
    pub whirlpool_position: Box<Account<'info, WhirlpoolPosition>>,
    #[account(mut,
        constraint = whirlpool_position_token_account.amount == 1,
        associated_token::mint = whirlpool_position.position_mint,
        associated_token::authority = vault,
    )]
    pub whirlpool_position_token_account: Account<'info, TokenAccount>,

    // Whirlpool program performs checks
    #[account(mut)]
    pub whirlpool_position_tick_array_lower: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub whirlpool_position_tick_array_upper: AccountLoader<'info, TickArray>,

    #[account(mut)]
    pub whirlpool: Box<Account<'info, Whirlpool>>,

    #[account(mut,
        address = whirlpool.token_vault_a.key()
    )]
    pub whirlpool_base_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        address = whirlpool.token_vault_b.key()
    )]
    pub whirlpool_quote_token_vault: Box<Account<'info, TokenAccount>>,

    // ----------------
    // Drift accounts
    pub drift_state: Box<Account<'info, DriftState>>,
    /// CHECK: Drift program handles checks
    pub drift_signer: UncheckedAccount<'info>,
    #[account(mut,
        seeds = [b"spot_market_vault".as_ref(), 0_u16.to_le_bytes().as_ref()],
        bump,
        seeds::program = drift_program.key(),
    )]
    pub drift_quote_spot_market_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        seeds = [b"spot_market_vault".as_ref(), 1_u16.to_le_bytes().as_ref()],
        bump,
        seeds::program = drift_program.key(),
    )]
    pub drift_base_spot_market_vault: Box<Account<'info, TokenAccount>>,

    // TODO: Add custom errors ??
    /// CHECK: Drift program checks these accounts
    pub drift_base_token_oracle: UncheckedAccount<'info>,
    /// CHECK: Drift program checks these accounts
    #[account(mut)]
    pub drift_base_spot_market: AccountLoader<'info, DriftSpotMarket>,
    /// CHECK: Drift program checks these accounts
    #[account(mut)]
    pub drift_quote_spot_market: AccountLoader<'info, DriftSpotMarket>,

    #[account(mut,
        address = vault.drift_stats.key(),
    )]
    pub drift_stats: AccountLoader<'info, DriftUserStats>,
    #[account(mut,
        address = vault.drift_subaccount.key(),
    )]
    pub drift_subaccount: AccountLoader<'info, DriftUser>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub drift_program: Program<'info, Drift>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> Deposit<'info> {
    pub fn get_prepare_swap_context(&self) -> CpiContext<'_, '_, '_, 'info, Swap<'info>> {
        let init_swap_accounts = Swap {
            token_authority: self.payer.to_account_info(),
            whirlpool: self.prepare_swap_whirlpool.to_account_info(),
            token_owner_account_a: self.payer_base_token_account.to_account_info(),
            token_owner_account_b: self.payer_quote_token_account.to_account_info(),
            token_vault_a: self
                .prepare_swap_whirlpool_base_token_vault
                .to_account_info(),
            token_vault_b: self
                .prepare_swap_whirlpool_quote_token_vault
                .to_account_info(),
            tick_array0: self.prepare_swap_tick_array_0.to_account_info(),
            tick_array1: self.prepare_swap_tick_array_1.to_account_info(),
            tick_array2: self.prepare_swap_tick_array_2.to_account_info(),
            token_program: self.token_program.to_account_info(),
            oracle: self.prepare_swap_oracle.to_account_info(),
        };
        CpiContext::new(self.whirlpool_program.to_account_info(), init_swap_accounts)
    }

    pub fn get_whirlpool_increase_liquidity_context(
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

    pub fn get_drift_deposit_context<'a>(
        &'a self,
        signer_seeds: &'a [&[&[u8]]],
    ) -> CpiContext<'_, '_, '_, 'info, DriftDeposit<'info>> {
        let deposit_accounts = DriftDeposit {
            state: self.drift_state.to_account_info(),
            user_stats: self.drift_stats.to_account_info(),
            user: self.drift_subaccount.to_account_info(),
            authority: self.vault.to_account_info(),
            spot_market_vault: self.drift_quote_spot_market_vault.to_account_info(),
            user_token_account: self.vault_quote_token_account.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext {
            program: self.drift_program.to_account_info(),
            accounts: deposit_accounts,
            remaining_accounts: vec![
                self.drift_base_token_oracle.to_account_info(),
                self.drift_quote_spot_market.to_account_info(),
            ],
            signer_seeds,
        }
    }

    pub fn get_drift_withdraw_context<'a>(
        &'a self,
        signer_seeds: &'a [&[&[u8]]],
    ) -> CpiContext<'_, '_, '_, 'info, DriftWithdraw<'info>> {
        let withdraw_accounts = DriftWithdraw {
            state: self.drift_state.to_account_info(),
            drift_signer: self.drift_signer.to_account_info(),
            user_stats: self.drift_stats.to_account_info(),
            user: self.drift_subaccount.to_account_info(),
            authority: self.vault.to_account_info(),
            spot_market_vault: self.drift_base_spot_market_vault.to_account_info(),
            user_token_account: self.vault_base_token_account.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext {
            program: self.drift_program.to_account_info(),
            accounts: withdraw_accounts,
            remaining_accounts: vec![
                self.drift_base_token_oracle.to_account_info(),
                self.drift_base_spot_market.to_account_info(),
                self.drift_quote_spot_market.to_account_info(),
            ],
            signer_seeds,
        }
    }
}

pub fn get_whirlpool_input_tokens_deltas(
    liquidity_input: u128,
    current_sqrt_price: u128,
    upper_sqrt_price: u128,
    lower_sqrt_price: u128,
) -> Result<(u64, u64)> {
    let transform_whirlpool_error = |err: WhirlpoolsErrorCode| match err {
        WhirlpoolsErrorCode::MultiplicationOverflow => SurfError::MultiplicationOverflow,
        WhirlpoolsErrorCode::NumberDownCastError => SurfError::NumberDownCastError,
        WhirlpoolsErrorCode::TokenMaxExceeded => SurfError::TokenMaxExceeded,
        WhirlpoolsErrorCode::MultiplicationShiftRightOverflow => {
            SurfError::MultiplicationShiftRightOverflow
        }
        _ => unreachable!(),
    };

    let base_token_amount =
        get_amount_delta_a(current_sqrt_price, upper_sqrt_price, liquidity_input, true);
    let quote_token_amount =
        get_amount_delta_b(lower_sqrt_price, current_sqrt_price, liquidity_input, true);

    if let Err(err) = base_token_amount {
        return Err(transform_whirlpool_error(err).into());
    }
    if let Err(err) = quote_token_amount {
        return Err(transform_whirlpool_error(err).into());
    }

    Ok((base_token_amount.unwrap(), quote_token_amount.unwrap()))
}
