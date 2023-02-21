use anchor_lang::prelude::*;

use crate::{
    helpers::hedge::{
        update_user_borrow_amounts, update_user_borrow_interest, update_user_collateral_interest,
    },
    state::{HedgePosition, UserPosition, VaultState},
};

pub fn handler(ctx: Context<SyncUserHedgePosition>) -> Result<()> {
    let vault_state = &ctx.accounts.vault_state;
    let user_position = &mut ctx.accounts.user_position;

    // UPDATE BORROW POSITION
    for hedge_position_ai in ctx.remaining_accounts.iter() {
        let hedge_position_loader = AccountLoader::<HedgePosition>::try_from(hedge_position_ai)?;
        let hedge_position = hedge_position_loader.load()?;

        if hedge_position.id > vault_state.hedge_positions_count - 1 {
            return Ok(());
        }

        require_keys_eq!(hedge_position.vault_state, vault_state.key());
        require_eq!(hedge_position.id, user_position.hedge_position_id);

        for (idx, borrow_position) in hedge_position.borrow_positions.iter().enumerate() {
            require_eq!(idx, user_position.borrow_position_index as usize);

            // 1. update interest
            update_user_borrow_interest(user_position, borrow_position)?;

            // 2. update adjustment diffs
            update_user_borrow_amounts(user_position, borrow_position)?;

            user_position.borrow_position_index = user_position.borrow_position_index + 1;
        }

        user_position.hedge_position_id = user_position.hedge_position_id + 1;
        user_position.borrow_position_index = 0;
    }

    // UPDATE COLLATERAL POSITION INTEREST
    update_user_collateral_interest(user_position, vault_state)?;

    Ok(())
}

#[derive(Accounts)]
pub struct SyncUserHedgePosition<'info> {
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