use anchor_lang::prelude::*;
use whirlpools::Whirlpool;

use crate::{
    errors::SurfError,
    state::{UserPosition, Vault, VaultPosition},
};

pub fn handler(ctx: Context<OpenUserPosition>) -> Result<()> {
    let whirlpool = &ctx.accounts.whirlpool;
    let vault = &ctx.accounts.vault;
    let vault_position = &ctx.accounts.vault_position;

    if vault.current_vault_position_id == None {
        return Err(SurfError::PositionCanNotBeOpen.into());
    }

    let user_position_bump = *ctx.bumps.get("user_position").unwrap();

    ctx.accounts.user_position.open(
        user_position_bump,
        vault.key(),
        0,
        vault.current_vault_position_id.unwrap(),
        whirlpool.fee_growth_global_a,
        whirlpool.fee_growth_global_b,
        vault_position.hedge_adjustment_loss_base_token,
        vault_position.hedge_adjustment_loss_quote_token,
    );

    Ok(())
}

#[derive(Accounts)]
pub struct OpenUserPosition<'info> {
    #[account(mut)]
    pub position_authority: Signer<'info>,

    pub whirlpool: Account<'info, Whirlpool>,

    #[account(
        mut,
        seeds = [
            Vault::NAMESPACE.as_ref(),
            whirlpool.key().as_ref(),
        ],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [
            VaultPosition::NAMESPACE.as_ref(),
            vault.key().as_ref(),
            vault.vault_positions_count.to_le_bytes().as_ref(),
        ],
        bump = vault_position.bump,
    )]
    pub vault_position: Account<'info, VaultPosition>,

    #[account(
        init,
        payer = position_authority,
        space = UserPosition::LEN,
        seeds = [
            UserPosition::NAMESPACE.as_ref(),
            vault.key().as_ref(),
            position_authority.key().as_ref(),
        ],
        bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    pub system_program: Program<'info, System>,
}
