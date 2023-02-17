use anchor_lang::prelude::*;

declare_id!("4wVrbfSHxmhevzPzNfdpmVkJ2jqNRy6RYt4TxcHsnfSo");

pub mod errors;
pub mod helpers;
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

    pub fn initialize_vault_state(
        ctx: Context<InitializeVaultState>,
        full_tick_range: u32,
        vault_tick_range: u32,
        hedge_tick_range: u32,
    ) -> Result<()> {
        initialize_vault_state::handler(ctx, full_tick_range, vault_tick_range, hedge_tick_range)
    }

    pub fn open_vault_position(ctx: Context<OpenVaultPosition>, position_bump: u8) -> Result<()> {
        open_vault_position::handler(ctx, position_bump)
    }

    pub fn sync_vault(ctx: Context<SyncVault>) -> Result<()> {
        sync_vault::handler(ctx)
    }

    pub fn open_user_position(ctx: Context<OpenUserPosition>) -> Result<()> {
        open_user_position::handler(ctx)
    }

    pub fn sync_user_position(ctx: Context<SyncUserPosition>) -> Result<()> {
        sync_user_position::handler(ctx)
    }

    pub fn collect_user_fees(ctx: Context<CollectUserFees>) -> Result<()> {
        collect_user_fees::handler(ctx)
    }

    pub fn deposit_liquidity(
        ctx: Context<DepositLiquidity>,
        liquidity_input: u128,
        deposit_quote_input_max: u64,
    ) -> Result<()> {
        deposit_liquidity::handler(ctx, liquidity_input, deposit_quote_input_max)
    }
}
