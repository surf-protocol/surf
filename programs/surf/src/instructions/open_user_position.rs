use anchor_lang::prelude::*;

use crate::state::{UserPosition, VaultState};

pub fn handler(ctx: Context<OpenUserPosition>) -> Result<()> {
    let user_position_bump = *ctx.bumps.get("user_position").unwrap();
    ctx.accounts.user_position.open(user_position_bump);

    Ok(())
}

#[derive(Accounts)]
pub struct OpenUserPosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = UserPosition::LEN,
        seeds = [
            UserPosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            owner.key().as_ref(),
        ],
        bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    pub vault_state: Account<'info, VaultState>,

    pub system_program: Program<'info, System>,
}
