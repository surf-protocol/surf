use anchor_lang::prelude::*;

declare_id!("FjWGJ4ecVHR9R39kaGZJcRs4rcBcjDzckvjA7WSBmLsE");

pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;

#[program]
pub mod surf {
    use super::*;

    pub fn initialize_admin_config(ctx: Context<InitializeAdminConfig>) -> Result<()> {
        initialize_admin_config::handler(ctx)
    }

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        drift_subaccount_id: u16,
        full_tick_range: u32,
        vault_tick_range: u32,
        hedge_tick_range: u32,
    ) -> Result<()> {
        initialize_vault::handler(
            ctx,
            drift_subaccount_id,
            full_tick_range,
            vault_tick_range,
            hedge_tick_range,
        )
    }

    pub fn open_whirlpool_position(
        ctx: Context<OpenWhirlpoolPosition>,
        position_bump: u8,
        tick_lower_index: i32,
        tick_upper_index: i32,
    ) -> Result<()> {
        open_whirlpool_position::handler(ctx, position_bump, tick_lower_index, tick_upper_index)
    }
}
