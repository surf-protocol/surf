use anchor_lang::prelude::*;

declare_id!("FjWGJ4ecVHR9R39kaGZJcRs4rcBcjDzckvjA7WSBmLsE");

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

#[program]
pub mod surf {
    use super::*;

    pub fn initialize_admin_config(ctx: Context<InitializeAdminConfig>) -> Result<()> {
        initialize_admin_config::handler(ctx)
    }

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        bumps: InitVaultBumps,
        drift_subaccount_id: u16,
        tick_lower_index: i32,
        tick_upper_index: i32,
    ) -> Result<()> {
        initialize_vault::handler(
            ctx,
            bumps,
            drift_subaccount_id,
            tick_lower_index,
            tick_upper_index,
        )
    }
}
