use anchor_lang::prelude::*;

declare_id!("4wVrbfSHxmhevzPzNfdpmVkJ2jqNRy6RYt4TxcHsnfSo");

pub mod errors;
pub mod helpers;
pub mod instructions;
pub mod macros;
pub mod state;
pub mod utils;

use instructions::*;

#[program]
pub mod surf {
    use super::*;

    pub fn initialize_admin_config(ctx: Context<InitializeAdminConfig>) -> Result<()> {
        initialize_admin_config::handler(ctx)
    }

    pub fn initialize_vault_state(
        ctx: Context<InitializeVaultState>,
        full_tick_range: u32,
        vault_tick_range: u32,
        hedge_tick_range: u32,
    ) -> Result<()> {
        initialize_vault_state::handler(ctx, full_tick_range, vault_tick_range, hedge_tick_range)
    }

    pub fn open_whirlpool_position(
        ctx: Context<OpenWhirlpoolPosition>,
        position_bump: u8,
    ) -> Result<()> {
        open_whirlpool_position::handler(ctx, position_bump)
    }

    pub fn open_hedge_position(ctx: Context<OpenHedgePosition>) -> Result<()> {
        open_hedge_position::handler(ctx)
    }

    pub fn sync_whirlpool_position(ctx: Context<SyncWhirlpoolPosition>) -> Result<()> {
        sync_whirlpool_position::handler(ctx)
    }
}
