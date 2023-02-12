use anchor_lang::prelude::*;
use whirlpools_client::math::{checked_mul_shift_right, U256Muldiv};

use crate::errors::SurfError;

use super::VaultPosition;

#[account]
#[derive(Default)]
pub struct UserPosition {
    pub bump: u8, // 1

    pub vault: Pubkey, // 32

    pub liquidity: u128, // 16

    // Store hedged liquidity to keep track of what part and if position is hedged
    pub hedged_liquidity: u128,
    // Store collateral and borrowed amounts to keep track how much can user withdraw
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

        self.hedged_liquidity = 0;
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

    pub fn deposit_liquidity<'info>(
        &mut self,
        liquidity_diff: u128,
        vault_position: &Account<'info, VaultPosition>,
    ) -> Result<()> {
        self.liquidity
            .checked_add(liquidity_diff)
            .ok_or(SurfError::LiquidityOverflow)?;

        self.fee_growth_checkpoint_base_token = vault_position.fee_growth_base_token;
        self.fee_growth_checkpoint_quote_token = vault_position.fee_growth_quote_token;

        Ok(())
    }

    pub fn hedge(&mut self, collateral_quote_amount: u64, borrow_base_amount: u64) -> () {
        self.collateral_quote_amount = collateral_quote_amount;
        self.borrow_base_amount = borrow_base_amount;
        self.hedged_liquidity = self.liquidity;
    }

    /// Update user_position fees and hedge losses
    /// Updates
    ///     - unclaimed token amounts
    ///     - hedge losses and fee growths checkpoints
    pub fn update_fees_and_hedge_losses<'info>(
        &mut self,
        vault_position: &Account<'info, VaultPosition>,
    ) -> () {
        // this is always invoked before mutating action so if liquidity is 0
        // just exit early (can not collect fees / rewards without liquidity)
        if self.liquidity == 0 {
            return ();
        }

        // -----------
        // UPDATE FEES
        let fee_growth_base_token = vault_position.fee_growth_base_token;
        let fee_growth_quote_token = vault_position.fee_growth_quote_token;
        let (_fee_delta_base_token, _fee_delta_quote_token) = calculate_deltas(
            self.liquidity,
            self.fee_growth_checkpoint_base_token,
            self.fee_growth_checkpoint_quote_token,
            fee_growth_base_token,
            fee_growth_quote_token,
        );

        self.fee_unclaimed_base_token = self
            .fee_unclaimed_base_token
            .wrapping_add(_fee_delta_base_token);
        self.fee_unclaimed_quote_token = self
            .fee_unclaimed_quote_token
            .wrapping_add(_fee_delta_quote_token);

        self.fee_growth_checkpoint_base_token = fee_growth_base_token;
        self.fee_growth_checkpoint_quote_token = fee_growth_quote_token;

        // UPDATE HEDGE LOSSES
        // For now assume position is hedged from deposit
        // TODO: need to account for positions that were hedged after deposit (Update checkpoints on hedge instruction)
        let hedge_adjustment_loss_base_token = vault_position.hedge_adjustment_loss_base_token;
        let hedge_adjustment_loss_quote_token = vault_position.hedge_adjustment_loss_quote_token;

        let (_hedge_delta_base_token, _hedge_delta_quote_token) = calculate_deltas(
            self.liquidity,
            self.hedge_adjustment_loss_checkpoint_base_token,
            self.hedge_adjustment_loss_checkpoint_quote_token,
            hedge_adjustment_loss_base_token,
            hedge_adjustment_loss_quote_token,
        );

        self.hedge_loss_unclaimed_base_token = self
            .hedge_loss_unclaimed_base_token
            .wrapping_add(_hedge_delta_base_token);
        self.hedge_loss_unclaimed_quote_token = self
            .hedge_loss_unclaimed_quote_token
            .wrapping_add(_hedge_delta_quote_token);

        self.hedge_adjustment_loss_checkpoint_base_token = hedge_adjustment_loss_base_token;
        self.hedge_adjustment_loss_checkpoint_quote_token = hedge_adjustment_loss_quote_token;
    }

    /// Update user_position liquidity to match the liquidity of next vault_position
    /// **Does not update vault_position_checkpoint**
    pub fn update_range_adjustment_diff<'info>(
        &mut self,
        vault_liquidity: u128,
        vault_liquidity_diff: i128,
    ) -> Result<()> {
        if vault_liquidity_diff == 0 {
            return Ok(());
        }

        let is_loss = vault_liquidity_diff < 0;
        let vault_liquidity_diff_abs = vault_liquidity_diff.unsigned_abs();

        let new_vault_liquidity = if is_loss {
            vault_liquidity
                .checked_sub(vault_liquidity_diff_abs)
                .ok_or(SurfError::LiquidityDiffTooHigh)?
        } else {
            vault_liquidity
                .checked_add(vault_liquidity_diff_abs)
                .ok_or(SurfError::LiquidityDiffTooHigh)?
        };

        let user_liquidity_u256 = U256Muldiv::new(0, self.liquidity);
        let current_vault_liquidity_u256 = U256Muldiv::new(0, vault_liquidity);
        let new_vault_liquidity_u256 = U256Muldiv::new(0, new_vault_liquidity);

        let new_user_liquidity_u256 = user_liquidity_u256
            .mul(new_vault_liquidity_u256)
            .div(current_vault_liquidity_u256, false);

        let new_user_liquidity = new_user_liquidity_u256.0.try_into_u128();

        if let Err(_) = new_user_liquidity {
            return Err(SurfError::LiquidityDiffTooHigh.into());
        }

        self.liquidity = new_user_liquidity.unwrap();

        Ok(())
    }

    pub fn reset_fees(&mut self) -> () {
        self.fee_unclaimed_base_token = 0;
        self.fee_unclaimed_quote_token = 0;
    }
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

#[cfg(test)]
mod test_user_position {
    use crate::errors::SurfError;

    #[cfg(test)]
    mod test_update_range_adjustment_diff {
        use crate::state::UserPosition;

        use super::SurfError;

        #[test]
        fn test_update_range_adjustment_add_ok() {
            let mut user_position = UserPosition::default();
            user_position.liquidity = 100;

            let result = user_position.update_range_adjustment_diff(200, 50);

            assert!(result.is_ok());
            assert_eq!(user_position.liquidity, 125);
        }

        #[test]
        fn test_update_range_adjustment_sub_ok() {
            let mut user_position = UserPosition::default();
            user_position.liquidity = 100;

            let result = user_position.update_range_adjustment_diff(200, -50);

            assert!(result.is_ok());
            assert_eq!(user_position.liquidity, 75);
        }

        #[test]
        fn test_update_range_adjustment_diff_liquidity_diff_zero() {
            let mut user_position = UserPosition::default();
            user_position.liquidity = 100;

            let result = user_position.update_range_adjustment_diff(200, 0);

            assert!(result.is_ok());
            assert_eq!(user_position.liquidity, 100);
        }

        #[test]
        fn test_update_range_adjustment_diff_liquidity_diff_higher_than_vault_liquidity() {
            let mut user_position = UserPosition::default();
            user_position.liquidity = 100;

            let result = user_position.update_range_adjustment_diff(50, -100);

            assert_eq!(result.unwrap_err(), SurfError::LiquidityDiffTooHigh.into())
        }

        #[test]
        fn test_update_range_adjustment_diff_overflow() {
            let mut user_position = UserPosition::default();
            user_position.liquidity = u128::MAX;

            let result = user_position.update_range_adjustment_diff(u128::MAX, 1);

            assert_eq!(result.unwrap_err(), SurfError::LiquidityDiffTooHigh.into())
        }
    }
}
