use anchor_lang::prelude::*;

declare_id!("4wVrbfSHxmhevzPzNfdpmVkJ2jqNRy6RYt4TxcHsnfSo");

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
        full_tick_range: u32,
        vault_tick_range: u32,
        hedge_tick_range: u32,
    ) -> Result<()> {
        initialize_vault::handler(ctx, full_tick_range, vault_tick_range, hedge_tick_range)
    }

    pub fn open_position(ctx: Context<OpenPosition>, position_bump: u8) -> Result<()> {
        open_vault_position::handler(ctx, position_bump)
    }

    pub fn deposit_liquidity(
        ctx: Context<DepositLiquidity>,
        liquidity_input: u128,
        deposit_quote_input_max: u64,
    ) -> Result<()> {
        deposit_liquidity::handler(ctx, liquidity_input, deposit_quote_input_max)
    }

    pub fn hedge_liquidity(ctx: Context<HedgeLiquidity>) -> Result<()> {
        hedge_liquidity::handler(ctx)
    }
}
