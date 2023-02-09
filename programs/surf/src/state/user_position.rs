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

    pub fn update_fees_and_hedge_losses<'info>(
        &mut self,
        vault_position: &Account<'info, VaultPosition>,
    ) -> () {
        // UPDATE FEES
        let (_fee_delta_base_token, _fee_delta_quote_token) = calculate_deltas(
            self.liquidity,
            self.fee_growth_checkpoint_base_token,
            self.fee_growth_checkpoint_quote_token,
            vault_position.fee_growth_base_token,
            vault_position.fee_growth_quote_token,
        );
        self.fee_unclaimed_base_token = self
            .fee_unclaimed_base_token
            .wrapping_add(_fee_delta_base_token);
        self.fee_unclaimed_quote_token = self
            .fee_unclaimed_quote_token
            .wrapping_add(_fee_delta_quote_token);

        // UPDATE HEDGE LOSSES
        // For now assume position is hedged from deposit
        // TODO: need to account for positions that were hedged after deposit
        let (_hedge_delta_base_token, _hedge_delta_quote_token) = calculate_deltas(
            self.liquidity,
            self.hedge_adjustment_loss_checkpoint_base_token,
            self.hedge_adjustment_loss_checkpoint_quote_token,
            vault_position.hedge_adjustment_loss_base_token,
            vault_position.hedge_adjustment_loss_quote_token,
        );
        self.hedge_loss_unclaimed_base_token = self
            .hedge_loss_unclaimed_base_token
            .wrapping_add(_hedge_delta_base_token);
        self.hedge_loss_unclaimed_quote_token = self
            .hedge_loss_unclaimed_quote_token
            .wrapping_add(_hedge_delta_quote_token);
    }

    pub fn update_range_adjustment_diff<'info>(
        &mut self,
        total_vault_liquidity: u128,
        total_vault_liquidity_diff: i128,
    ) -> Result<()> {
        if total_vault_liquidity_diff == 0 {
            return Ok(());
        }

        let is_loss = total_vault_liquidity_diff < 0;
        let total_liquidity_diff_abs = total_vault_liquidity_diff.unsigned_abs();

        let total_liquidity = U256Muldiv::new(0, total_vault_liquidity);
        let total_liquidity_diff = U256Muldiv::new(0, total_liquidity_diff_abs).shift_left(128);
        let user_liquidity = U256Muldiv::new(0, self.liquidity);

        // g is 128 fractional bits
        //
        // TL_l_x128 / TL = g
        //
        // where - TL_l = total vault liquidity loss shifted left by 128 bits -> 256 bits integer, always bigger than 128 bits integer
        //       - TL = total vault liquidity -> 128 bits integer
        //
        let (g, g_remainder) = total_liquidity_diff.div(total_liquidity, true);
        // u128 * u128 = u256
        let user_liquidity_loss_shifted = g.mul(user_liquidity);

        // user liquidity loss is always in bounds of 128 bits integer
        // u256 >> 128 = u256 / u128 = u128
        let user_liquidity_diff = user_liquidity_loss_shifted
            .shift_right(128)
            .try_into_u128()
            .unwrap();

        let is_rem = g_remainder.gt(U256Muldiv::new(0, 0));

        if is_loss {
            self.liquidity = subtract_liquidity_diff(self.liquidity, user_liquidity_diff, is_rem)?;
        } else {
            self.liquidity = add_liquidity_diff(self.liquidity, user_liquidity_diff, is_rem)?;
        }

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

pub fn add_liquidity_diff(liquidity: u128, diff: u128, add_rem: bool) -> Result<u128> {
    let rem: u128 = if add_rem { 1 } else { 0 };
    let x = liquidity
        .checked_add(diff)
        .ok_or(SurfError::LiquidityDiffTooHigh)?;
    let y = x.checked_add(rem).ok_or(SurfError::LiquidityDiffTooHigh)?;
    Ok(y)
}

pub fn subtract_liquidity_diff(liquidity: u128, diff: u128, sub_rem: bool) -> Result<u128> {
    let rem: u128 = if sub_rem { 1 } else { 0 };
    let x = liquidity
        .checked_sub(diff)
        .ok_or(SurfError::LiquidityDiffTooLow)?;
    let y = x.checked_sub(rem).ok_or(SurfError::LiquidityDiffTooLow)?;
    Ok(y)
}

#[cfg(test)]
mod test_user_position {
    use crate::errors::SurfError;

    use super::UserPosition;

    #[test]
    fn valid_positive_liq_with_remainder_update_range_adjustment_diff() {
        let mut user_position = UserPosition::default();
        user_position.liquidity = 1_000_000;

        assert_eq!(
            user_position.update_range_adjustment_diff(10_000_000, 1000),
            Ok(())
        );
        assert_eq!(user_position.liquidity, 1_000_100_u128)
    }

    #[test]
    fn valid_negative_liq_with_remainder_update_range_adjustment_diff() {
        let mut user_position = UserPosition::default();
        user_position.liquidity = 1_000_000;

        assert_eq!(
            user_position.update_range_adjustment_diff(10_000_000, -1000),
            Ok(())
        );
        assert_eq!(user_position.liquidity, 999_900_u128)
    }

    #[test]
    fn valid_negative_liq_extremes_update_range_adjustment_diff() {
        let mut user_position = UserPosition::default();
        user_position.liquidity = 1;

        assert_eq!(
            user_position.update_range_adjustment_diff(u128::MAX, i128::MIN),
            Ok(())
        );
        assert_eq!(user_position.liquidity, 0)
    }

    #[test]
    fn success_no_overflow_update_range_adjustment_diff() {
        let mut user_position = UserPosition::default();
        user_position.liquidity = u128::MAX;

        assert_eq!(
            user_position.update_range_adjustment_diff(u128::MAX, -1000),
            Ok(())
        );
        assert_eq!(user_position.liquidity, u128::MAX - 1000)
    }

    #[test]
    fn panic_overflow_update_range_adjustment_diff() {
        let mut user_position = UserPosition::default();
        user_position.liquidity = u128::MAX;

        assert_eq!(
            user_position
                .update_range_adjustment_diff(u128::MAX, 1)
                .unwrap_err(),
            SurfError::LiquidityDiffTooLow.into(),
        )
    }

    #[test]
    fn success_position_not_rem_update_range_adjustment_diff() {
        let mut user_position = UserPosition::default();
        user_position.liquidity = 100;

        assert_eq!(
            user_position.update_range_adjustment_diff(200, -100),
            Ok(())
        );
        assert_eq!(user_position.liquidity, 50)
    }
}
