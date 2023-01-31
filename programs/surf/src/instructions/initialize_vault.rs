use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    mint,
    token::{Mint, Token, TokenAccount},
};
use drift::{
    cpi as drift_cpi,
    cpi::accounts::{InitializeUser, InitializeUserStats},
    program::Drift as DriftProgram,
    state::state::State,
};
use whirlpools::{program::Whirlpool as WhirlpoolProgram, state::Whirlpool};

use crate::{
    errors::SurfError,
    state::{AdminConfig, Vault},
    utils::constraints::is_admin,
};

// TODO: Add custom errors
pub fn handler(
    ctx: Context<InitializeVault>,
    full_tick_range: u32,
    vault_tick_range: u32,
    hedge_tick_range: u32,
) -> Result<()> {
    // --------
    // Validate tick ranges
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
    // Initialize drift stats
    let vault_bump = ctx.bumps.get("vault").unwrap();
    let whirlpool_key = ctx.accounts.whirlpool.key();

    let drift_program_signer_seeds: &[&[&[u8]]] = &[&[
        Vault::NAMESPACE.as_ref(),
        &whirlpool_key.as_ref(),
        &[*vault_bump],
    ]];

    let init_drift_user_stats_context = ctx.accounts.get_initialize_user_stats_context();
    drift_cpi::initialize_user_stats(
        init_drift_user_stats_context.with_signer(drift_program_signer_seeds),
    )?;
    ctx.accounts.drift_state.reload()?;

    // --------
    // Initialize drift subaccount
    let (init_drift_user_context, drift_subaccount_name) =
        ctx.accounts.get_initialize_user_context_and_args();
    drift_cpi::initialize_user(
        init_drift_user_context.with_signer(drift_program_signer_seeds),
        0,
        drift_subaccount_name,
    )?;

    // --------
    // Initialize vault
    ctx.accounts.vault.initialize(
        *vault_bump,
        ctx.accounts.whirlpool.key(),
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

// TODO: Check if token mints correspond with vault token mints in subsequent ixs
#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        constraint = is_admin(&admin_config, &admin) @SurfError::InvalidAdmin,
        seeds = [AdminConfig::NAMESPACE.as_ref()],
        bump
    )]
    pub admin_config: Account<'info, AdminConfig>,

    #[account(
        constraint = whirlpool.token_mint_a.eq(&base_token_mint.key()) && whirlpool.token_mint_b.eq(&quote_token_mint.key())
    )]
    pub whirlpool: Box<Account<'info, Whirlpool>>,

    // ------
    // Vault accounts
    #[account(init,
        seeds = [
            Vault::NAMESPACE.as_ref(),
            whirlpool.key().as_ref(),
        ],
        payer = admin,
        space = Vault::LEN,
        bump
    )]
    pub vault: Box<Account<'info, Vault>>,

    pub base_token_mint: Box<Account<'info, Mint>>,
    #[cfg_attr(
        not(feature = "test"),
        account(
            address = mint::USDC @SurfError::InvalidQuoteTokenMint,
        ),
    )]
    pub quote_token_mint: Box<Account<'info, Mint>>,

    #[account(init,
        payer = admin,
        associated_token::mint = base_token_mint,
        associated_token::authority = vault
    )]
    pub vault_base_token_account: Box<Account<'info, TokenAccount>>,
    #[account(init,
        payer = admin,
        associated_token::mint = quote_token_mint,
        associated_token::authority = vault
    )]
    pub vault_quote_token_account: Box<Account<'info, TokenAccount>>,

    // ------
    // Drift accounts
    /// CHECK: Drift program validates the account in the CPI
    #[account(mut,
        seeds = [
            b"user_stats".as_ref(),
            vault.key().as_ref(),
        ],
        bump,
        seeds::program = drift_program.key(),
    )]
    pub drift_stats: UncheckedAccount<'info>,

    /// CHECK: Drift program validates the account in the CPI
    #[account(mut,
        seeds = [
            b"user".as_ref(),
            vault.key().as_ref(),
            0_u16.to_le_bytes().as_ref()
        ],
        bump,
        seeds::program = drift_program.key(),
    )]
    pub drift_subaccount: UncheckedAccount<'info>,

    #[account(mut)]
    pub drift_state: Box<Account<'info, State>>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub drift_program: Program<'info, DriftProgram>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> InitializeVault<'info> {
    pub fn get_initialize_user_stats_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, InitializeUserStats<'info>> {
        let init_drift_user_stats_accounts = InitializeUserStats {
            user_stats: self.drift_stats.to_account_info(),
            state: self.drift_state.to_account_info(),
            authority: self.vault.to_account_info(),
            payer: self.admin.to_account_info(),
            rent: self.rent.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };
        CpiContext::new(
            self.drift_program.to_account_info(),
            init_drift_user_stats_accounts,
        )
    }

    pub fn get_initialize_user_context_and_args(
        &self,
    ) -> (
        CpiContext<'_, '_, '_, 'info, InitializeUser<'info>>,
        [u8; 32],
    ) {
        let drift_subaccount_name: [u8; 32] = [32; 32];
        let init_drift_user_accounts = InitializeUser {
            user_stats: self.drift_stats.to_account_info(),
            payer: self.admin.to_account_info(),
            authority: self.vault.to_account_info(),
            state: self.drift_state.to_account_info(),
            user: self.drift_subaccount.to_account_info(),
            rent: self.rent.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };
        (
            CpiContext::new(
                self.drift_program.to_account_info(),
                init_drift_user_accounts,
            ),
            drift_subaccount_name,
        )
    }
}
