// use anchor_lang::prelude::*;

// use crate::{
//     errors::SurfError,
//     state::{UserPosition, Vault, VaultPosition},
// };

// pub fn handler(ctx: Context<SyncUserPosition>) -> Result<()> {
//     let current_vault_position = &ctx.accounts.current_vault_position;
//     let user_position = &mut ctx.accounts.user_position;

//     // -----------
//     // SYNC WITH PREVIOUS VAULT POSITIONS
//     let prev_vault_positions_count =
//         (current_vault_position.id - user_position.vault_position_checkpoint) as usize;
//     let previous_vault_positions = ctx.remaining_accounts;

//     if prev_vault_positions_count > 0 {
//         require_neq!(
//             previous_vault_positions.len(),
//             0_usize,
//             SurfError::MissingPreviousVaultPositions
//         );

//         for vault_position_ai in previous_vault_positions.iter() {
//             let vault_position = Account::<VaultPosition>::try_from(vault_position_ai)?;

//             // Ensure it belongs to the vault
//             require_keys_eq!(vault_position.vault, user_position.vault);
//             // Ensure it was not synced yet
//             if vault_position.id != user_position.vault_position_checkpoint {
//                 msg!(
//                     "Invalid position id: {}; should be {}. Previous positions are either not sorted or starting position is invalid",
//                     vault_position.id,
//                     user_position.vault_position_checkpoint,
//                 );
//                 return Err(SurfError::CustomError.into());
//             }
//             // Ensure it is not the active position
//             if vault_position.id == current_vault_position.id {
//                 break;
//             }

//             user_position.update_fees_and_hedge_losses(&vault_position);
//             user_position.update_range_adjustment_diff(
//                 vault_position.liquidity,
//                 vault_position.range_adjustment_liquidity_diff,
//             )?;

//             user_position.vault_position_checkpoint = user_position.vault_position_checkpoint + 1;
//         }

//         // Exit early if not all previous vault positions are provided
//         if user_position.vault_position_checkpoint != current_vault_position.id {
//             return Ok(());
//         }
//     }

//     // -----------
//     // SYNC WITH CURRENT VAULT POSITION
//     if user_position.vault_position_checkpoint != current_vault_position.id {
//         msg!(
//             "User position can not by synced without previous vault positions. Need previous vault positions since {}",
//             user_position.vault_position_checkpoint,
//         );
//         return Err(SurfError::CustomError.into());
//     }

//     user_position.update_fees_and_hedge_losses(&current_vault_position);

//     Ok(())
// }

// #[derive(Accounts)]
// pub struct SyncUserPosition<'info> {
//     pub authority: Signer<'info>,

//     pub vault: Account<'info, Vault>,

//     #[account(
//         mut,
//         seeds = [
//             UserPosition::NAMESPACE.as_ref(),
//             vault.key().as_ref(),
//             authority.key().as_ref(),
//         ],
//         bump = user_position.bump,
//     )]
//     pub user_position: Account<'info, UserPosition>,

//     #[account(
//         mut,
//         seeds = [
//             VaultPosition::NAMESPACE.as_ref(),
//             vault.key().as_ref(),
//             vault.vault_positions_count.to_le_bytes().as_ref(),
//         ],
//         bump = current_vault_position.bump,
//     )]
//     pub current_vault_position: Account<'info, VaultPosition>,
// }
