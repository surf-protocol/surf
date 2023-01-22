use anchor_lang::prelude::*;

use crate::state::AdminConfig;
use crate::Program;

pub fn handler(ctx: Context<InitializeAdminConfig>) -> Result<()> {
    let admin_config_bump = ctx.bumps.get("admin_config").unwrap();
    let admin_key = ctx.accounts.admin.key();
    ctx.accounts.admin_config.set_inner(AdminConfig {
        bump: *admin_config_bump,
        admin_key,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeAdminConfig<'info> {
    #[account(init,
        seeds = [AdminConfig::NAMESPACE.as_ref()],
        space = AdminConfig::LEN,
        payer = admin,
        bump
    )]
    pub admin_config: Account<'info, AdminConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}
