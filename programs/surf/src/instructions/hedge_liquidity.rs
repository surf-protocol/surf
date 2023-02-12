use anchor_lang::prelude::*;
use anchor_spl::token::{self as token_cpi, Token, TokenAccount, Transfer};
use drift::{
    cpi::{
        self as drift_cpi,
        accounts::{Deposit as DriftDeposit, Withdraw as DriftWithdraw},
    },
    program::Drift,
    state::{
        spot_market::SpotMarket as DriftSpotMarket,
        state::State as DriftState,
        user::{User as DriftSubaccount, UserStats as DriftStats},
    },
};
use whirlpools::{
    cpi::{self as whirlpool_cpi, accounts::Swap},
    program::Whirlpool as WhirlpoolProgram,
    TickArray, Whirlpool,
};
use whirlpools_client::math::MIN_SQRT_PRICE_X64;

use crate::{
    errors::SurfError,
    state::{UserPosition, Vault, VaultPosition},
    utils::{
        constraints::have_matching_mints,
        orca::liquidity_math::{get_amount_delta_a_wrapped, get_amount_delta_b_wrapped},
    },
};

pub fn handler(ctx: Context<HedgeLiquidity>) -> Result<()> {
    // TODO: hedge only unhedged liquidity if there is any
    let vault_position = &ctx.accounts.vault_position;
    let user_position = &ctx.accounts.user_position;

    let unhedged_liquidity = user_position.liquidity - user_position.hedged_liquidity;

    if unhedged_liquidity == 0 {
        return Err(SurfError::PositionAlreadyHedged.into());
    }

    // TRANSFER COLLATERAL FROM USER TO VAULT
    let quote_token_amount = get_amount_delta_b_wrapped(
        vault_position.middle_sqrt_price,
        vault_position.lower_sqrt_price,
        unhedged_liquidity,
        true,
    )?;
    let total_collateral = quote_token_amount * 2;

    token_cpi::transfer(ctx.accounts.transfer_context(), total_collateral)?;

    // DEPOSIT COLLATERAL TO DRIFT
    drift_cpi::deposit(
        ctx.accounts.deposit_collateral_context(),
        0_u16,
        total_collateral,
        false,
    )?;

    // BORROW FROM DRIFT
    let current_base_token_amount = get_amount_delta_a_wrapped(
        vault_position.upper_sqrt_price,
        ctx.accounts.whirlpool.sqrt_price,
        unhedged_liquidity,
        true,
    )?;

    drift_cpi::withdraw(
        ctx.accounts.borrow_context(),
        1_u16,
        current_base_token_amount,
        false,
    )?;

    // SWAP BORROWED AMOUNT
    whirlpool_cpi::swap(
        ctx.accounts.hedge_swap_context(),
        current_base_token_amount,
        0,
        MIN_SQRT_PRICE_X64,
        true,
        true,
    )?;

    ctx.accounts
        .user_position
        .hedge(total_collateral, current_base_token_amount);

    Ok(())
}

#[derive(Accounts)]
pub struct HedgeLiquidity<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        token::mint = vault.quote_token_mint,
        token::authority = owner.key(),
    )]
    pub owner_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [
            UserPosition::NAMESPACE.as_ref(),
            vault.key().as_ref(),
            owner.key().as_ref(),
        ],
        bump = user_position.bump,
    )]
    pub user_position: Box<Account<'info, UserPosition>>,

    #[account(
        seeds = [
            VaultPosition::NAMESPACE.as_ref(),
            vault.key().as_ref(),
            vault.vault_positions_count.to_le_bytes().as_ref(),
        ],
        bump = vault_position.bump,
    )]
    pub vault_position: Box<Account<'info, VaultPosition>>,

    #[account(has_one = whirlpool)]
    pub vault: Box<Account<'info, Vault>>,
    #[account(
        mut,
        address = vault.base_token_account,
    )]
    pub vault_base_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = vault.quote_token_account,
    )]
    pub vault_quote_token_account: Box<Account<'info, TokenAccount>>,

    pub whirlpool: Box<Account<'info, Whirlpool>>,

    // ---------
    // DRIFT ACCOUNTS
    pub drift_state: Box<Account<'info, DriftState>>,
    /// CHECK: Drift program checks these accounts
    pub drift_signer: UncheckedAccount<'info>,

    /// CHECK: Drift program checks these accounts
    pub drift_base_token_oracle: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [
            b"spot_market_vault".as_ref(),
            1_u16.to_le_bytes().as_ref(),
        ],
        bump,
        seeds::program = drift_program.key(),
    )]
    pub drift_base_spot_market_vault: Box<Account<'info, TokenAccount>>,
    pub drift_base_spot_market: AccountLoader<'info, DriftSpotMarket>,

    #[account(
        mut,
        seeds = [
            b"spot_market_vault".as_ref(),
            0_u16.to_le_bytes().as_ref(),
        ],
        bump,
        seeds::program = drift_program.key(),
    )]
    pub drift_quote_spot_market_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub drift_quote_spot_market: AccountLoader<'info, DriftSpotMarket>,

    #[account(
        mut,
        address = vault.drift_stats,
    )]
    pub drift_stats: AccountLoader<'info, DriftStats>,
    #[account(
        mut,
        address = vault.drift_subaccount,
    )]
    pub drift_subaccount: AccountLoader<'info, DriftSubaccount>,

    // ----------
    // HEDGE SWAP ACCOUNTS
    #[account(
        mut,
        constraint = have_matching_mints(&whirlpool, &hedge_swap_whirlpool) @SurfError::WhirlpoolMintsNotMatching,
    )]
    pub hedge_swap_whirlpool: Box<Account<'info, Whirlpool>>,

    #[account(
        mut,
        address = hedge_swap_whirlpool.token_vault_a,
    )]
    pub hedge_swap_whirlpool_base_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = hedge_swap_whirlpool.token_vault_b,
    )]
    pub hedge_swap_whirlpool_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub hedge_swap_tick_array_0: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub hedge_swap_tick_array_1: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub hedge_swap_tick_array_2: AccountLoader<'info, TickArray>,

    /// CHECK: Whirlpool CPI
    pub hedge_swap_oracle: UncheckedAccount<'info>,

    pub drift_program: Program<'info, Drift>,
    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub token_program: Program<'info, Token>,
}

impl<'info> HedgeLiquidity<'info> {
    pub fn transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let program = &self.token_program;
        let accounts = Transfer {
            from: self.owner_quote_token_account.to_account_info(),
            to: self.vault_quote_token_account.to_account_info(),
            authority: self.owner.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }

    pub fn deposit_collateral_context(&self) -> CpiContext<'_, '_, '_, 'info, DriftDeposit<'info>> {
        let program = &self.drift_program;
        let accounts = DriftDeposit {
            authority: self.vault.to_account_info(),
            user_token_account: self.vault_quote_token_account.to_account_info(),
            user: self.drift_subaccount.to_account_info(),
            user_stats: self.drift_stats.to_account_info(),
            state: self.drift_state.to_account_info(),
            spot_market_vault: self.drift_quote_spot_market_vault.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
            .with_remaining_accounts(vec![self.drift_quote_spot_market.to_account_info()])
    }

    pub fn borrow_context(&self) -> CpiContext<'_, '_, '_, 'info, DriftWithdraw<'info>> {
        let program = &self.drift_program;
        let accounts = DriftWithdraw {
            state: self.drift_state.to_account_info(),
            drift_signer: self.drift_signer.to_account_info(),
            spot_market_vault: self.drift_base_spot_market_vault.to_account_info(),
            user: self.drift_subaccount.to_account_info(),
            user_stats: self.drift_stats.to_account_info(),
            authority: self.vault.to_account_info(),
            user_token_account: self.vault_base_token_account.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts).with_remaining_accounts(vec![
            self.drift_base_token_oracle.to_account_info(),
            self.drift_quote_spot_market.to_account_info(),
            self.drift_base_spot_market.to_account_info(),
        ])
    }

    pub fn hedge_swap_context(&self) -> CpiContext<'_, '_, '_, 'info, Swap<'info>> {
        let program = &self.whirlpool_program;
        let accounts = Swap {
            whirlpool: self.hedge_swap_whirlpool.to_account_info(),
            token_vault_a: self
                .hedge_swap_whirlpool_base_token_account
                .to_account_info(),
            token_vault_b: self
                .hedge_swap_whirlpool_quote_token_account
                .to_account_info(),
            tick_array0: self.hedge_swap_tick_array_0.to_account_info(),
            tick_array1: self.hedge_swap_tick_array_1.to_account_info(),
            tick_array2: self.hedge_swap_tick_array_2.to_account_info(),
            oracle: self.hedge_swap_oracle.to_account_info(),
            token_authority: self.vault.to_account_info(),
            token_owner_account_a: self.vault_base_token_account.to_account_info(),
            token_owner_account_b: self.vault_quote_token_account.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }
}
