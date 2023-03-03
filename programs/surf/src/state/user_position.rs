use anchor_lang::prelude::*;

use crate::errors::SurfError;

#[account]
#[derive(Default)]
pub struct UserPosition {
    pub bump: u8,

    // WHIRLPOOL DATA
    pub liquidity: u128,

    pub fee_growth_checkpoint_base_token: u128,
    pub fee_growth_checkpoint_quote_token: u128,

    pub fee_unclaimed_base_token: u64,
    pub fee_unclaimed_quote_token: u64,

    // HEDGE DATA
    // amounts
    pub collateral_amount: u64,
    pub borrow_amount: u64,
    pub borrow_amount_notional: u64,

    // interest growth
    pub collateral_interest_growth_checkpoint: u128,
    pub borrow_interest_growth_checkpoint: u128,

    pub collateral_interest_unclaimed: u64,
    pub borrow_interest_unclaimed: u64,

    // ADJUSTMENTS DATA
    pub whirlpool_position_id: u64,
    pub hedge_position_id: u64,
    pub borrow_position_index: u8,
}

/// Seeds = [
///     "user_position",
///     vault key,
///     owner key,
/// ]
impl UserPosition {
    pub const LEN: usize = 8 + 160;
    pub const NAMESPACE: &'static [u8; 13] = b"user_position";

    pub fn open(&mut self, bump: u8) -> () {
        self.bump = bump;
    }

    pub fn deposit_liquidity(&mut self, liquidity_input: u128) -> Result<()> {
        self.liquidity = self
            .liquidity
            .checked_add(liquidity_input)
            .ok_or(SurfError::LiquidityOverflow)?;

        Ok(())
    }

    pub fn increase_hedge(
        &mut self,
        collateral_amount: u64,
        borrow_amount: u64,
        borrow_amount_notional: u64,
    ) -> Result<()> {
        self.collateral_amount = self
            .collateral_amount
            .checked_add(collateral_amount)
            .ok_or(SurfError::CollateralOverflow)?;
        self.borrow_amount = self
            .borrow_amount
            .checked_add(borrow_amount)
            .ok_or(SurfError::BorrowOverflow)?;
        self.borrow_amount_notional = self
            .borrow_amount_notional
            .checked_add(borrow_amount_notional)
            .ok_or(SurfError::BorrowNotionalOverflow)?;

        Ok(())
    }

    pub fn decrease_hedge(
        &mut self,
        collateral_amount: u64,
        borrow_amount: u64,
        borrow_amount_notional: u64,
    ) -> Result<()> {
        self.collateral_amount = self
            .collateral_amount
            .checked_sub(collateral_amount)
            .ok_or(SurfError::CollateralOverflow)?;
        self.borrow_amount = self
            .borrow_amount
            .checked_sub(borrow_amount)
            .ok_or(SurfError::BorrowOverflow)?;
        self.borrow_amount_notional = self
            .borrow_amount_notional
            .checked_sub(borrow_amount_notional)
            .ok_or(SurfError::BorrowNotionalOverflow)?;

        self.collateral_interest_unclaimed = 0;
        self.borrow_interest_unclaimed = 0;

        Ok(())
    }

    pub fn update_borrow_amounts(&mut self, borrow_amount: u64, borrow_amount_notional: u64) -> () {
        self.borrow_amount = borrow_amount;
        self.borrow_amount_notional = borrow_amount_notional;
    }

    pub fn update_borrow_interest(
        &mut self,
        interest_unclaimed_diff: u64,
        interest_growth_checkpoint: u128,
    ) -> Result<()> {
        self.borrow_interest_unclaimed = self
            .borrow_interest_unclaimed
            .checked_add(interest_unclaimed_diff)
            .ok_or(SurfError::BorrowInterestOverflow)?;
        self.borrow_interest_growth_checkpoint = interest_growth_checkpoint;

        Ok(())
    }

    pub fn update_collateral_interest(
        &mut self,
        interest_unclaimed_diff: u64,
        interest_growth_checkpoint: u128,
    ) -> Result<()> {
        self.collateral_interest_unclaimed = self
            .collateral_interest_unclaimed
            .checked_add(interest_unclaimed_diff)
            .ok_or(SurfError::CollateralInterestOverflow)?;
        self.collateral_interest_growth_checkpoint = interest_growth_checkpoint;

        Ok(())
    }

    pub fn claim_borrow_interest(&mut self) -> () {
        self.borrow_interest_unclaimed = 0;
    }

    pub fn claim_collateral_interest(&mut self) -> () {
        self.collateral_interest_unclaimed = 0;
    }
}
