use anchor_lang::{prelude::*, solana_program::entrypoint::ProgramResult};

declare_id!("FjWGJ4ecVHR9R39kaGZJcRs4rcBcjDzckvjA7WSBmLsE");

pub mod instructions;
pub mod state;

use instructions::*;

#[program]
pub mod surf {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        position_bump: u8,
        tick_lower_index: i32,
        tick_upper_index: i32,
    ) -> ProgramResult {
        initialize_vault::handler(ctx, position_bump, tick_lower_index, tick_upper_index)
    }
}
