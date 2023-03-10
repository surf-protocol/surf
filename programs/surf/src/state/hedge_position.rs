use std::borrow::BorrowMut;

use anchor_lang::prelude::*;

use crate::errors::SurfError;

#[zero_copy]
#[repr(packed)]
#[derive(Default, Debug)]
pub struct BorrowPosition {
    pub borrowed_amount: u64,      // 8
    pub borrowed_amount_diff: i64, // 8

    pub borrowed_amount_notional: u64,      // 8
    pub borrowed_amount_notional_diff: i64, // 8

    pub borrow_interest_growth: u128,            // 16
    pub borrow_interest_growth_checkpoint: u128, // 16
}

#[account(zero_copy)]
#[repr(packed)]
pub struct HedgePosition {
    pub bump: u8, // 1

    pub vault_state: Pubkey, // 32
    pub id: u64,             // 8

    pub current_borrow_position_index: u8,       // 1
    pub borrow_positions: [BorrowPosition; 150], // 9600
}

impl Default for HedgePosition {
    fn default() -> HedgePosition {
        HedgePosition {
            bump: 0,
            vault_state: Pubkey::default(),
            id: 0,
            current_borrow_position_index: 0,
            borrow_positions: [BorrowPosition::default(); 150],
        }
    }
}

impl HedgePosition {
    pub const LEN: usize = 8 + 9656;
    pub const NAMESPACE: &'static [u8; 14] = b"hedge_position";

    pub fn initialize(&mut self, bump: u8, vault_state: Pubkey, id: u64) -> () {
        self.bump = bump;
        self.vault_state = vault_state;
        self.id = id;
    }

    pub fn increase_hedge(
        &mut self,
        borrowed_amount: u64,
        borrowed_amount_notional: u64,
    ) -> Result<()> {
        let borrow_position = self.get_current_position_mut();

        borrow_position.borrowed_amount = borrow_position
            .borrowed_amount
            .checked_add(borrowed_amount)
            .ok_or(SurfError::BorrowOverflow)?;
        borrow_position.borrowed_amount_notional = borrow_position
            .borrowed_amount_notional
            .checked_add(borrowed_amount_notional)
            .ok_or(SurfError::BorrowNotionalOverflow)?;

        Ok(())
    }

    pub fn decrease_hedge(
        &mut self,
        borrowed_amount: u64,
        borrowed_amount_notional: u64,
    ) -> Result<()> {
        let borrow_position = self.get_current_position_mut();

        borrow_position.borrowed_amount = borrow_position
            .borrowed_amount
            .checked_sub(borrowed_amount)
            .ok_or(SurfError::BorrowOverflow)?;
        borrow_position.borrowed_amount_notional = borrow_position
            .borrowed_amount_notional
            .checked_sub(borrowed_amount_notional)
            .ok_or(SurfError::BorrowNotionalOverflow)?;

        Ok(())
    }

    pub fn update_current_position_id(&mut self) -> Option<()> {
        if self.current_borrow_position_index == 149 {
            return None;
        }

        self.current_borrow_position_index = self.current_borrow_position_index + 1;

        Some(())
    }

    pub fn update_interest_growth(&mut self, borrow_interest_growth: u128) -> () {
        let borrow_position = self.get_current_position_mut();

        let growth_checkpoint = borrow_position.borrow_interest_growth_checkpoint;
        borrow_position.borrow_interest_growth = borrow_interest_growth + growth_checkpoint;
    }

    pub fn claim_user_borrow_interest(&mut self, claimed_interest: u64) -> Result<()> {
        let borrow_position = self.get_current_position_mut();
        let claimed_interest_shl = (claimed_interest as u128) << 64;

        borrow_position.borrow_interest_growth_checkpoint = borrow_position
            .borrow_interest_growth_checkpoint
            .checked_add(claimed_interest_shl)
            .ok_or(SurfError::BorrowInterestOverflow)?;

        Ok(())
    }

    pub fn update_diffs(
        &mut self,
        borrowed_diff: i64,
        borrowed_diff_notional: i64,
    ) -> Result<(u64, u64)> {
        let borrow_position = self.get_current_position_mut();

        borrow_position.borrowed_amount_diff = borrow_position
            .borrowed_amount_diff
            .checked_add(borrowed_diff)
            .ok_or(SurfError::BorrowOverflow)?;
        borrow_position.borrowed_amount_notional_diff = borrow_position
            .borrowed_amount_notional_diff
            .checked_add(borrowed_diff_notional)
            .ok_or(SurfError::BorrowNotionalOverflow)?;

        let new_borrowed_amount =
            calculate_new_amount(borrow_position.borrowed_amount, borrowed_diff);
        let new_borrowed_amount_notional = calculate_new_amount(
            borrow_position.borrowed_amount_notional,
            borrowed_diff_notional,
        );

        Ok((new_borrowed_amount, new_borrowed_amount_notional))
    }

    pub fn get_current_position(&self) -> BorrowPosition {
        self.borrow_positions[self.current_borrow_position_index as usize]
    }

    pub fn get_current_position_mut(&mut self) -> &mut BorrowPosition {
        let ci = self.current_borrow_position_index as usize;
        self.borrow_positions[ci].borrow_mut()
    }
}

fn calculate_new_amount(old_amount: u64, diff: i64) -> u64 {
    let diff_abs = diff.unsigned_abs();
    if diff.is_negative() {
        old_amount - diff_abs
    } else {
        old_amount + diff_abs
    }
}
