use anchor_lang::prelude::*;
use std::ops::Add;

use crate::{
    errors::SurfError,
    state::{UserPosition, VaultPosition},
};

pub fn update_user_position<'info>(
    user_position: &Account<'info, UserPosition>,
    previous_vault_positions: &[AccountInfo],
    current_vault_position: &Account<'info, VaultPosition>,
) -> Result<()> {
    let current_vault_position_id = current_vault_position.id;
    let mut vault_position_id_checkpoint = user_position.vault_position_checkpoint;

    let prev_vault_positions_count =
        (current_vault_position_id - vault_position_id_checkpoint) as usize;

    if prev_vault_positions_count > 0 {
        require_eq!(
            prev_vault_positions_count,
            previous_vault_positions.len(),
            // TODO: Error msg
            SurfError::InvalidAdmin
        );

        for vault_position_ai in previous_vault_positions.iter() {
            let vault_position = Account::<VaultPosition>::try_from(vault_position_ai)?;
            // TODO: Custom err
            require_eq!(vault_position_id_checkpoint, vault_position.id);

            // calculate user liquidity for that vault position on rebalance
            //      sub hedge adjustment losses for that vault position - checkpoints and current deltas
            //      add fees growths for that vault position - checkpoints and current deltas
            // calculate new user liquidity -> prev user liquidity - price range adjustment losses
            let close_sqrt_price = vault_position.close_sqrt_price;
            let upper_sqrt_price = vault_position.upper_sqrt_price;
            let lower_sqrt_price = vault_position.lower_sqrt_price;

            vault_position_id_checkpoint = vault_position_id_checkpoint.add(1);
        }
    }

    Ok(())
}
