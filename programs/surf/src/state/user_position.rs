use anchor_lang::prelude::*;
use whirlpools_client::math::checked_mul_shift_right;

use crate::errors::SurfError;

use super::VaultPosition;

#[account]
#[derive(Default)]
pub struct UserPosition {
    pub bump: u8, // 1

    pub vault: Pubkey, // 32

    pub liquidity: u128, // 16

    pub is_hedged: bool,              // 1
    pub collateral_quote_amount: u64, // 8
    pub borrow_base_amount: u64,      // 8

    /// Id of active vault position at time of last sync
    pub vault_position_checkpoint: u64, // 8

    pub fee_growth_checkpoint_base_token: u128,  // 16
    pub fee_growth_checkpoint_quote_token: u128, // 16

    pub hedge_adjustment_loss_checkpoint_base_token: u128, // 16
    pub hedge_adjustment_loss_checkpoint_quote_token: u128, // 16

    pub fee_unclaimed_base_token: u64,  // 8
    pub fee_unclaimed_quote_token: u64, // 8

    pub hedge_loss_unclaimed_base_token: u64,  // 8
    pub hedge_loss_unclaimed_quote_token: u64, // 8
}

impl UserPosition {
    pub const LEN: usize = 8 + 128;
    pub const NAMESPACE: &'static [u8; 13] = b"user_position";

    pub fn open(
        &mut self,
        bump: u8,
        vault_key: Pubkey,
        liquidity: u128,
        current_vault_position_id: u64,

        current_fee_growth_base_token: u128,
        current_fee_growth_quote_token: u128,

        current_hedge_adjustment_loss_checkpoint_base_token: u128,
        current_hedge_adjustment_loss_checkpoint_quote_token: u128,
    ) -> () {
        self.bump = bump;
        self.vault = vault_key;

        self.liquidity = liquidity;

        self.is_hedged = false;
        self.collateral_quote_amount = 0;
        self.borrow_base_amount = 0;

        self.vault_position_checkpoint = current_vault_position_id;

        self.hedge_adjustment_loss_checkpoint_base_token =
            current_hedge_adjustment_loss_checkpoint_base_token;
        self.hedge_adjustment_loss_checkpoint_quote_token =
            current_hedge_adjustment_loss_checkpoint_quote_token;

        self.fee_growth_checkpoint_base_token = current_fee_growth_base_token;
        self.fee_growth_checkpoint_quote_token = current_fee_growth_quote_token;

        self.fee_unclaimed_base_token = 0;
        self.fee_unclaimed_quote_token = 0;

        self.hedge_loss_unclaimed_base_token = 0;
        self.hedge_loss_unclaimed_quote_token = 0;
    }

    /// Sync position state with the current state of vault to the latest vault position provided
    pub fn sync<'info>(
        &mut self,
        previous_vault_positions: &[AccountInfo],
        current_vault_position: &Account<'info, VaultPosition>,
    ) -> Result<()> {
        let current_vault_position_id = current_vault_position.id;

        let prev_vault_positions_count =
            (current_vault_position_id - self.vault_position_checkpoint) as usize;

        if prev_vault_positions_count > 0 {
            require_eq!(
                previous_vault_positions.len(),
                0_usize,
                SurfError::MissingPreviousVaultPositions
            );

            for vault_position_ai in previous_vault_positions.iter() {
                let vault_position = Account::<VaultPosition>::try_from(vault_position_ai)?;

                if vault_position.id != self.vault_position_checkpoint {
                    msg!("Invalid position id: {}; should be {}. Previous positions are either not sorted or starting position is invalid", vault_position.id, self.vault_position_checkpoint);
                    return Err(SurfError::CustomError.into());
                }

                if vault_position.id == current_vault_position_id {
                    break;
                }

                update_fees(self, &vault_position);
                update_hedge_losses(self, &vault_position);

                // ----------
                // UPDATE PRICE RANGE ADJUSTMENT LOSSES
                let price_range_adjustment_liquidity_loss_bps =
                    vault_position.range_adjustment_liquidity_loss;
                let liquidity_loss = price_range_adjustment_liquidity_loss_bps * self.liquidity;
                self.liquidity = self.liquidity - liquidity_loss;

                self.vault_position_checkpoint = self.vault_position_checkpoint + 1
            }
        }

        if self.vault_position_checkpoint != current_vault_position_id {
            // Exit early, user position was synced up to the latest vault position provided
            return Ok(());
        }

        update_fees(self, &current_vault_position);
        update_hedge_losses(self, &current_vault_position);

        Ok(())
    }
}

pub fn update_fees<'info>(
    user_position: &mut UserPosition,
    vault_position: &Account<'info, VaultPosition>,
) -> () {
    let (_fee_delta_base_token, _fee_delta_quote_token) = calculate_deltas(
        user_position.liquidity,
        user_position.fee_growth_checkpoint_base_token,
        user_position.fee_growth_checkpoint_quote_token,
        vault_position.fee_growth_base_token,
        vault_position.fee_growth_quote_token,
    );
    user_position.fee_unclaimed_base_token = user_position
        .fee_unclaimed_base_token
        .wrapping_add(_fee_delta_base_token);
    user_position.fee_unclaimed_quote_token = user_position
        .fee_unclaimed_quote_token
        .wrapping_add(_fee_delta_quote_token);
}

pub fn update_hedge_losses<'info>(
    user_position: &mut UserPosition,
    vault_position: &Account<'info, VaultPosition>,
) -> () {
    // For now assume position is hedged from deposit
    // TODO: need to account for positions that were hedged after deposit
    let (_hedge_delta_base_token, _hedge_delta_quote_token) = calculate_deltas(
        user_position.liquidity,
        user_position.hedge_adjustment_loss_checkpoint_base_token,
        user_position.hedge_adjustment_loss_checkpoint_quote_token,
        vault_position.hedge_adjustment_loss_base_token,
        vault_position.hedge_adjustment_loss_quote_token,
    );
    user_position.hedge_loss_unclaimed_base_token = user_position
        .hedge_loss_unclaimed_base_token
        .wrapping_add(_hedge_delta_base_token);
    user_position.hedge_loss_unclaimed_quote_token = user_position
        .hedge_loss_unclaimed_quote_token
        .wrapping_add(_hedge_delta_quote_token);
}

pub fn calculate_deltas<'info>(
    liquidity: u128,
    checkpoint_base_token_per_unit: u128,
    checkpoint_quote_token_per_unit: u128,
    current_base_token_per_unit: u128,
    current_quote_token_per_unit: u128,
) -> (u64, u64) {
    let delta_base_token_per_unit =
        current_base_token_per_unit.wrapping_sub(checkpoint_base_token_per_unit);
    let delta_quote_token_per_unit =
        current_quote_token_per_unit.wrapping_sub(checkpoint_quote_token_per_unit);

    let delta_base_token =
        checked_mul_shift_right(delta_base_token_per_unit, liquidity).unwrap_or(0);
    let delta_quote_token =
        checked_mul_shift_right(delta_quote_token_per_unit, liquidity).unwrap_or(0);

    (delta_base_token, delta_quote_token)
}
