use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use drift::{
    cpi as drift_cpi,
    cpi::accounts::{InitializeUser, InitializeUserStats},
    program::Drift as DriftProgram,
    state::{state::State, user::UserStats},
};
use whirlpools::{
    cpi as whirlpool_cpi, cpi::accounts::OpenPosition, program::Whirlpool as WhirlpoolProgram,
    OpenPositionBumps, Whirlpool,
};

use crate::{
    errors::SurfError,
    state::{AdminConfig, Vault},
};

// TODO: Add custom errors
pub fn handler(
    ctx: Context<InitializeVault>,
    bumps: InitVaultBumps,
    drift_subaccount_id: u16,
    tick_lower_index: i32,
    tick_upper_index: i32,
) -> Result<()> {
    ctx.accounts.vault.set_inner(Vault {
        whirlpool: ctx.accounts.whirlpool.key(),
        whirlpool_position: ctx.accounts.position.key(),
        token_mint_a: ctx.accounts.token_mint_a.key(),
        token_mint_b: ctx.accounts.token_mint_b.key(),
        token_vault_a: ctx.accounts.token_vault_a.key(),
        token_vault_b: ctx.accounts.token_vault_b.key(),
        drift_account_stats: ctx.accounts.drift_user_stats.key(),
        drift_subaccount: ctx.accounts.drift_user.key(),
    });

    let vault_account = &ctx.accounts.vault;
    let rent = &ctx.accounts.rent;
    let system_program = &ctx.accounts.system_program;

    // Open whirlpool position
    let open_position_context =
        ctx.accounts
            .get_open_position_context(vault_account, system_program, rent);
    whirlpool_cpi::open_position(
        open_position_context,
        OpenPositionBumps {
            position_bump: bumps.position,
        },
        tick_lower_index,
        tick_upper_index,
    )?;

    // Init drift user stats for admin_config if needed
    let admin_config_bump = ctx.accounts.admin_config.bump;
    let drift_program_signer_seeds: &[&[&[u8]]] =
        &[&[AdminConfig::SEED.as_ref(), &[admin_config_bump]]];

    let drift_program = &ctx.accounts.drift_program;
    let drift_user_stats = &ctx.accounts.drift_user_stats;

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
        .or(Err(SurfError::InvalidDriftUserStatsAccount))?;

    let init_drift_user_context = ctx.accounts.get_initialize_user_context(
        user_stats_loader,
        drift_program,
        system_program,
        rent,
        drift_program_signer_seeds,
    );
    // Name filled with spaces
    let drift_subaccount_name = [32; 32];
    drift_cpi::initialize_user(
        init_drift_user_context,
        drift_subaccount_id,
        drift_subaccount_name,
    )?;

    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Default)]
pub struct InitVaultBumps {
    position: u8,
    user_stats: u8,
    user: u8,
}

#[derive(Accounts)]
#[instruction(bumps: InitVaultBumps, drift_subaccount_id: u16)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        constraint = admin_config.admin_key.eq(&admin.key()),
        seeds = [AdminConfig::SEED.as_ref()],
        bump
    )]
    pub admin_config: Account<'info, AdminConfig>,

    pub whirlpool: Box<Account<'info, Whirlpool>>,

    #[account(init,
        seeds = [
            Vault::SEED.as_ref(),
            whirlpool.key().as_ref(),
        ],
        payer = admin,
        space = Vault::LEN,
        bump
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: Whirlpool program validates the account in the CPI
    #[account(mut)]
    pub position: UncheckedAccount<'info>,
    /// CHECK: Whirlpool program validates the account in the CPI
    #[account(mut)]
    pub position_mint: Signer<'info>,
    /// CHECK: Whirlpool program validates the account in the CPI
    #[account(mut)]
    pub position_token_account: UncheckedAccount<'info>,

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

    /// CHECK: Drift program validates the account in the CPI
    #[account(mut,
        seeds = [
            b"user_stats".as_ref(),
            admin_config.key().as_ref(),
        ],
        bump = bumps.user_stats,
        seeds::program = drift_program.key(),
    )]
    pub drift_user_stats: UncheckedAccount<'info>,

    /// CHECK: Drift program validates the account in the CPI
    #[account(mut,
        seeds = [
            b"user".as_ref(),
            admin_config.key().as_ref(),
            drift_subaccount_id.to_le_bytes().as_ref()
        ],
        bump = bumps.user,
        seeds::program = drift_program.key(),
    )]
    pub drift_user: UncheckedAccount<'info>,

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
    pub fn get_open_position_context(
        &self,
        vault_account: &Account<'info, Vault>,
        system_program: &Program<'info, System>,
        rent: &Sysvar<'info, Rent>,
    ) -> CpiContext<'_, '_, '_, 'info, OpenPosition<'info>> {
        let open_position_accounts = OpenPosition {
            owner: vault_account.to_account_info(),
            funder: self.admin.to_account_info(),
            position_mint: self.position_mint.to_account_info(),
            position: self.position.to_account_info(),
            position_token_account: self.position_token_account.to_account_info(),
            whirlpool: self.whirlpool.to_account_info(),
            token_program: self.token_program.to_account_info(),
            associated_token_program: self.associated_token_program.to_account_info(),
            system_program: system_program.to_account_info(),
            rent: rent.to_account_info(),
        };
        CpiContext::new(
            self.whirlpool_program.to_account_info(),
            open_position_accounts,
        )
    }

    pub fn get_initialize_user_stats_context<'a>(
        &'a self,
        drift_program: &Program<'info, DriftProgram>,
        system_program: &Program<'info, System>,
        rent: &Sysvar<'info, Rent>,
        signer_seeds: &'a [&[&[u8]]],
    ) -> CpiContext<'_, '_, '_, 'info, InitializeUserStats<'info>> {
        let init_drift_user_stats_accounts = InitializeUserStats {
            user_stats: self.drift_user_stats.to_account_info(),
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

    pub fn get_initialize_user_context<'a>(
        &'a self,
        user_stats: AccountLoader<'info, UserStats>,
        drift_program: &Program<'info, DriftProgram>,
        system_program: &Program<'info, System>,
        rent: &Sysvar<'info, Rent>,
        signer_seeds: &'a [&[&[u8]]],
    ) -> CpiContext<'_, '_, '_, 'info, InitializeUser<'info>> {
        let init_drift_user_accounts = InitializeUser {
            user_stats: user_stats.to_account_info(),
            payer: self.admin.to_account_info(),
            authority: self.admin_config.to_account_info(),
            state: self.drift_state.to_account_info(),
            user: self.drift_user.to_account_info(),
            rent: rent.to_account_info(),
            system_program: system_program.to_account_info(),
        };
        CpiContext::new_with_signer(
            drift_program.to_account_info(),
            init_drift_user_accounts,
            signer_seeds,
        )
    }
}
