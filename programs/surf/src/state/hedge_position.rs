use std::borrow::BorrowMut;

use anchor_lang::prelude::*;

#[zero_copy]
#[derive(Default)]
pub struct BorrowPosition {
    pub borrowed_amount: u64,            // 8
    pub borrowed_amount_diff_above: u64, // 8
    pub borrowed_amount_diff_below: u64, // 8

    pub borrowed_amount_notional: u64,            // 8
    pub borrowed_amount_notional_diff_above: u64, // 8
    pub borrowed_amount_notional_diff_below: u64, // 8

    pub borrow_interest_growth: u128,            // 16
    pub borrow_interest_growth_checkpoint: u128, // 16
}

#[account(zero_copy)]
pub struct HedgePosition {
    pub bump: u8, // 1

    pub id: u64, // 8

    pub current_borrow_position_index: u8,       // 1
    pub borrow_positions: [BorrowPosition; 120], // 9600
}

impl Default for HedgePosition {
    fn default() -> HedgePosition {
        HedgePosition {
            bump: 0,
            id: 0,
            current_borrow_position_index: 0,
            borrow_positions: [BorrowPosition::default(); 120],
        }
    }
}

impl HedgePosition {
    pub const LEN: usize = 8 + 9624;
    pub const NAMESPACE: &[u8; 14] = b"hedge_position";

    pub fn initialize(&mut self, bump: u8, id: u64) -> () {
        self.bump = bump;
        self.id = id;
    }

    pub fn borrow(&mut self, borrowed_amount: u64, borrowed_amount_notional: u64) -> Result<()> {
        let ci = self.current_borrow_position_index as usize;

        self.borrow_positions[ci].borrowed_amount = borrowed_amount;
        self.borrow_positions[ci].borrowed_amount_notional = borrowed_amount_notional;

        Ok(())
    }

    pub fn update_interest_growth(&mut self, borrow_interest_growth: u128) -> () {
        let current_position =
            self.borrow_positions[self.current_borrow_position_index as usize].borrow_mut();

        let growth_checkpoint = current_position.borrow_interest_growth_checkpoint;
        current_position.borrow_interest_growth = borrow_interest_growth + growth_checkpoint;
    }

    pub fn get_current_position(&self) -> BorrowPosition {
        self.borrow_positions[self.current_borrow_position_index as usize]
    }
}
