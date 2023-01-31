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

    pub fn open_whirlpool_position(
        ctx: Context<OpenWhirlpoolPosition>,
        position_bump: u8,
        tick_lower_index: i32,
        tick_upper_index: i32,
    ) -> Result<()> {
        open_whirlpool_position::handler(ctx, position_bump, tick_lower_index, tick_upper_index)
    }

    pub fn deposit(ctx: Context<Deposit>, input_quote_amount: u64) -> Result<()> {
        deposit::handler(ctx, input_quote_amount)
    }
}
