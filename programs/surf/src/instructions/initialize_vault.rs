use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use drift::{
    cpi as drift_cpi,
    cpi::accounts::{InitializeUser, InitializeUserStats, UpdateUser},
    program::Drift as DriftProgram,
    state::{state::State, user::UserStats},
};
use whirlpools::{program::Whirlpool as WhirlpoolProgram, state::Whirlpool};

use crate::{
    errors::SurfError,
    state::{AdminConfig, Vault},
    utils::constraints::is_admin,
};

// TODO: Add custom errors
// TODO: Limit to only USDC markets
pub fn handler(
    ctx: Context<InitializeVault>,
    drift_subaccount_id: u16,
    full_tick_range: u32,
    vault_tick_range: u32,
    hedge_tick_range: u32,
) -> Result<()> {
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

    let rent = &ctx.accounts.rent;
    let system_program = &ctx.accounts.system_program;

    // Init drift user stats for admin_config if needed
    let admin_config_bump = ctx.accounts.admin_config.bump;
    let drift_program_signer_seeds: &[&[&[u8]]] =
        &[&[AdminConfig::NAMESPACE.as_ref(), &[admin_config_bump]]];

    let drift_program = &ctx.accounts.drift_program;
    let drift_user_stats = &ctx.accounts.drift_stats;

    if drift_user_stats.data_is_empty() {
        let init_drift_user_stats_context = ctx.accounts.get_initialize_user_stats_context(
            drift_program,
            system_program,
            rent,
            drift_program_signer_seeds,
        );
        drift_cpi::initialize_user_stats(init_drift_user_stats_context)?;
        ctx.accounts.drift_state.reload()?;
    }

    // Init user
    let user_stats_loader: AccountLoader<UserStats> = AccountLoader::try_from(&drift_user_stats)
        .or(Err(SurfError::InvalidDriftAccountStatsAccount))?;

    let (init_drift_user_context, drift_subaccount_name) =
        ctx.accounts.get_initialize_user_context_and_args(
            user_stats_loader,
            drift_program,
            system_program,
            rent,
            drift_program_signer_seeds,
        );
    drift_cpi::initialize_user(
        init_drift_user_context,
        drift_subaccount_id,
        drift_subaccount_name,
    )?;

    let vault_bump = ctx.bumps.get("vault").unwrap();

    // Update delegate
    let update_subaccount_delegate_context =
        ctx.accounts.get_update_drift_subaccount_delegate_context();
    drift_cpi::update_user_delegate(
        update_subaccount_delegate_context.with_signer(&[&[
            AdminConfig::NAMESPACE.as_ref(),
            &[ctx.accounts.admin_config.bump],
        ]]),
        drift_subaccount_id,
        ctx.accounts.vault.key(),
    )?;

    ctx.accounts.vault.initialize(
        *vault_bump,
        ctx.accounts.whirlpool.key(),
        ctx.accounts.token_mint_a.key(),
        ctx.accounts.token_mint_b.key(),
        ctx.accounts.token_vault_a.key(),
        ctx.accounts.token_vault_b.key(),
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
#[instruction(drift_subaccount_id: u16)]
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
        constraint = whirlpool.token_mint_a.eq(&token_mint_a.key()) && whirlpool.token_mint_b.eq(&token_mint_b.key())
    )]
    pub whirlpool: Box<Account<'info, Whirlpool>>,

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

    pub token_mint_a: Box<Account<'info, Mint>>,
    #[account(init,
        payer = admin,
        associated_token::mint = token_mint_a,
        associated_token::authority = vault
    )]
    pub token_vault_a: Box<Account<'info, TokenAccount>>,

    pub token_mint_b: Box<Account<'info, Mint>>,
    #[account(init,
        payer = admin,
        associated_token::mint = token_mint_b,
        associated_token::authority = vault
    )]
    pub token_vault_b: Box<Account<'info, TokenAccount>>,

    // TODO: Initialize drift accounts with vault as authority
    /// CHECK: Drift program validates the account in the CPI
    #[account(mut,
        seeds = [
            b"user_stats".as_ref(),
            admin_config.key().as_ref(),
        ],
        bump,
        seeds::program = drift_program.key(),
    )]
    pub drift_stats: UncheckedAccount<'info>,

    /// CHECK: Drift program validates the account in the CPI
    #[account(mut,
        seeds = [
            b"user".as_ref(),
            admin_config.key().as_ref(),
            drift_subaccount_id.to_le_bytes().as_ref()
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
    pub fn get_initialize_user_stats_context<'a>(
        &'a self,
        drift_program: &Program<'info, DriftProgram>,
        system_program: &Program<'info, System>,
        rent: &Sysvar<'info, Rent>,
        signer_seeds: &'a [&[&[u8]]],
    ) -> CpiContext<'_, '_, '_, 'info, InitializeUserStats<'info>> {
        let init_drift_user_stats_accounts = InitializeUserStats {
            user_stats: self.drift_stats.to_account_info(),
            state: self.drift_state.to_account_info(),
            authority: self.admin_config.to_account_info(),
            payer: self.admin.to_account_info(),
            rent: rent.to_account_info(),
            system_program: system_program.to_account_info(),
        };
        CpiContext::new_with_signer(
            drift_program.to_account_info(),
            init_drift_user_stats_accounts,
            signer_seeds,
        )
    }

    pub fn get_initialize_user_context_and_args<'a>(
        &'a self,
        user_stats: AccountLoader<'info, UserStats>,
        drift_program: &Program<'info, DriftProgram>,
        system_program: &Program<'info, System>,
        rent: &Sysvar<'info, Rent>,
        signer_seeds: &'a [&[&[u8]]],
    ) -> (
        CpiContext<'_, '_, '_, 'info, InitializeUser<'info>>,
        [u8; 32],
    ) {
        let drift_subaccount_name: [u8; 32] = [32; 32];

        let init_drift_user_accounts = InitializeUser {
            user_stats: user_stats.to_account_info(),
            payer: self.admin.to_account_info(),
            authority: self.admin_config.to_account_info(),
            state: self.drift_state.to_account_info(),
            user: self.drift_subaccount.to_account_info(),
            rent: rent.to_account_info(),
            system_program: system_program.to_account_info(),
        };
        (
            CpiContext::new_with_signer(
                drift_program.to_account_info(),
                init_drift_user_accounts,
                signer_seeds,
            ),
            drift_subaccount_name,
        )
    }

    pub fn get_update_drift_subaccount_delegate_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, UpdateUser<'info>> {
        let accounts = UpdateUser {
            authority: self.admin_config.to_account_info(),
            user: self.drift_subaccount.to_account_info(),
        };
        CpiContext::new(self.drift_program.to_account_info(), accounts)
    }
}
