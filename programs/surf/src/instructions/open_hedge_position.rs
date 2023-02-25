use anchor_lang::prelude::*;

use crate::state::{HedgePosition, VaultState};

pub fn handler(ctx: Context<OpenHedgePosition>) -> Result<()> {
    let bump = *ctx.bumps.get("vault_hedge_position").unwrap();
    let id = ctx.accounts.vault_state.hedge_positions_count;

    ctx.accounts.vault_hedge_position.load_init()?.initialize(
        bump,
        ctx.accounts.vault_state.key(),
        id,
    );

    let vault_state = &mut ctx.accounts.vault_state;

    if vault_state.hedge_positions_count == 0 {
        vault_state.set_initial_hedge_position_id();
    }

    vault_state.initialize_hedge_position()?;

    Ok(())
}

#[derive(Accounts)]
pub struct OpenHedgePosition<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub vault_state: Account<'info, VaultState>,

    #[account(
        init,
        payer = payer,
        space = HedgePosition::LEN,
        seeds = [
            HedgePosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            vault_state.hedge_positions_count.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub vault_hedge_position: AccountLoader<'info, HedgePosition>,

    pub system_program: Program<'info, System>,
}
