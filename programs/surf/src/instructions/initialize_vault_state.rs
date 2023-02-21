use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    mint,
    token::{Mint, Token, TokenAccount},
};
use drift::{
    cpi::{
        self as drift_cpi,
        accounts::{InitializeUser, InitializeUserStats},
    },
    program::Drift,
};
use whirlpools::Whirlpool;

use crate::{
    errors::SurfError,
    state::{AdminConfig, VaultState},
    utils::constraints::is_admin,
};

pub fn handler(
    ctx: Context<InitializeVaultState>,
    full_tick_range: u32,
    vault_tick_range: u32,
    hedge_tick_range: u32,
) -> Result<()> {
    // --------
    // VALIDATE TICK RANGES
    if full_tick_range < 400 {
        return Err(SurfError::FullTickRangeTooSmall.into());
    }
    if vault_tick_range < 200 {
        return Err(SurfError::VaultTickRangeTooSmall.into());
    }
    // Vault tick range can not be less than half of full tick range, to keep drift account healthy
    if vault_tick_range > full_tick_range / 2 {
        return Err(SurfError::VaultTickRangeTooBig.into());
    }
    if hedge_tick_range < 20 {
        return Err(SurfError::HedgeTickRangeTooSmall.into());
    }
    if hedge_tick_range > vault_tick_range {
        return Err(SurfError::HedgeTickRangeTooBig.into());
    }

    // --------
    // INITIALIZE DRIFT ACCOUNTS
    let vault_state_bump = *ctx.bumps.get("vault_state").unwrap();
    let whirlpool_key = ctx.accounts.whirlpool.key();

    let drift_signer_seeds: &[&[&[u8]]] = &[&[
        VaultState::NAMESPACE.as_ref(),
        whirlpool_key.as_ref(),
        &[vault_state_bump],
    ]];

    drift_cpi::initialize_user_stats(
        ctx.accounts
            .initialize_drift_stats_context()
            .with_signer(drift_signer_seeds),
    )?;

    let drift_subaccount_name = [32_u8; 32];
    drift_cpi::initialize_user(
        ctx.accounts
            .initialize_drift_subaccount_context()
            .with_signer(drift_signer_seeds),
        0_u16,
        drift_subaccount_name,
    )?;

    // ---------
    // INITIALIZE VAULT STATE
    ctx.accounts.vault_state.initialize(
        vault_state_bump,
        whirlpool_key,
        ctx.accounts.base_token_mint.key(),
        ctx.accounts.quote_token_mint.key(),
        ctx.accounts.vault_base_token_account.key(),
        ctx.accounts.vault_quote_token_account.key(),
        ctx.accounts.drift_stats.key(),
        ctx.accounts.drift_subaccount.key(),
        full_tick_range,
        vault_tick_range,
        hedge_tick_range,
    );

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeVaultState<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        constraint = is_admin(&admin_config, &admin) @SurfError::InvalidAdmin,
        seeds = [
            AdminConfig::NAMESPACE.as_ref(),
        ],
        bump = admin_config.bump,
    )]
    pub admin_config: Account<'info, AdminConfig>,

    #[account(
        constraint = whirlpool.token_mint_a.eq(&base_token_mint.key()),
        constraint = whirlpool.token_mint_b.eq(&quote_token_mint.key()),
    )]
    pub whirlpool: Box<Account<'info, Whirlpool>>,

    pub base_token_mint: Box<Account<'info, Mint>>,
    #[cfg_attr(
        not(feature = "test"),
        account(
            address = mint::USDC @SurfError::InvalidQuoteTokenMint,
        ),
    )]
    pub quote_token_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = admin,
        space = VaultState::LEN,
        seeds = [
            VaultState::NAMESPACE.as_ref(),
            whirlpool.key().as_ref(),
        ],
        bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        init,
        payer = admin,
        associated_token::mint = base_token_mint,
        associated_token::authority = vault_state,
    )]
    pub vault_base_token_account: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = admin,
        associated_token::mint = quote_token_mint,
        associated_token::authority = vault_state,
    )]
    pub vault_quote_token_account: Account<'info, TokenAccount>,

    // ------
    // Drift accounts
    /// CHECK: Drift program validates the account in the CPI
    pub drift_state: UncheckedAccount<'info>,
    /// CHECK: Drift program validates the account in the CPI
    #[account(
        mut,
        seeds = [
            b"user_stats".as_ref(),
            vault_state.key().as_ref(),
        ],
        bump,
        seeds::program = drift_program.key(),
    )]
    pub drift_stats: UncheckedAccount<'info>,

    /// CHECK: Drift program validates the account in the CPI
    #[account(
        mut,
        seeds = [
            b"user".as_ref(),
            vault_state.key().as_ref(),
            0_u16.to_le_bytes().as_ref()
        ],
        bump,
        seeds::program = drift_program.key(),
    )]
    pub drift_subaccount: UncheckedAccount<'info>,

    pub drift_program: Program<'info, Drift>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> InitializeVaultState<'info> {
    pub fn initialize_drift_stats_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, InitializeUserStats<'info>> {
        let program = &self.drift_program;
        let accounts = InitializeUserStats {
            state: self.drift_state.to_account_info(),
            user_stats: self.drift_stats.to_account_info(),
            authority: self.vault_state.to_account_info(),
            payer: self.admin.to_account_info(),
            rent: self.rent.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }

    pub fn initialize_drift_subaccount_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, InitializeUser<'info>> {
        let program = &self.drift_program;
        let accounts = InitializeUser {
            state: self.drift_state.to_account_info(),
            user_stats: self.drift_stats.to_account_info(),
            user: self.drift_subaccount.to_account_info(),
            payer: self.admin.to_account_info(),
            authority: self.vault_state.to_account_info(),
            rent: self.rent.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }
}
