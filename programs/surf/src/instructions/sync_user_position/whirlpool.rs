use anchor_lang::prelude::*;

use crate::{
    errors::SurfError,
    helpers::whirlpool::{update_user_fees_and_rewards, update_user_liquidity},
    state::{UserPosition, VaultState, WhirlpoolPosition},
};

pub fn handler<'remaining, 'info>(
    ctx: Context<'_, '_, 'remaining, 'info, SyncUserWhirlpoolPosition<'info>>,
) -> Result<()> {
    let vault_state = &ctx.accounts.vault_state;
    let user_position = &mut ctx.accounts.user_position;

    for whirlpool_position_ai in ctx.remaining_accounts.iter() {
        let whirlpool_position = Account::<WhirlpoolPosition>::try_from(whirlpool_position_ai)?;

        if whirlpool_position.id > vault_state.whirlpool_positions_count - 1 {
            return Err(SurfError::InvalidWhirlpoolPosition.into());
        }

        require_keys_eq!(
            whirlpool_position.vault_state,
            vault_state.key(),
            SurfError::InvalidWhirlpoolPosition,
        );
        require_eq!(
            whirlpool_position.id,
            user_position.whirlpool_position_id,
            SurfError::InvalidWhirlpoolPosition,
        );

        // sync fees and rewards
        update_user_fees_and_rewards(user_position, &whirlpool_position);

        // sync liquidity diff and update id if not latest
        if vault_state.current_whirlpool_position_id != Some(whirlpool_position.id) {
            update_user_liquidity(user_position, &whirlpool_position)?;

            user_position.whirlpool_position_id = user_position.whirlpool_position_id + 1;
        }
    }

    Ok(())
}

#[derive(Accounts)]
pub struct SyncUserWhirlpoolPosition<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [
            UserPosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
        ],
        bump = user_position.bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    pub vault_state: Account<'info, VaultState>,
}
