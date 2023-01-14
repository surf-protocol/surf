use anchor_lang::prelude::*;

declare_id!("BwsVJd1hBE8q1L6fdLeEkm6QnFhgr5wBxW9pnEY5zzvT");

#[program]
pub mod surf_protocol {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
