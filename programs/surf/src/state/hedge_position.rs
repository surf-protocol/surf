use std::borrow::BorrowMut;

use anchor_lang::prelude::*;

use crate::errors::SurfError;

#[zero_copy]
#[derive(Default)]
pub struct BorrowPosition {
    pub borrowed_amount: u64,      // 8
    pub borrowed_amount_diff: i64, // 8

    pub borrowed_amount_notional: u64,      // 8
    pub borrowed_amount_notional_diff: i64, // 8

    pub borrow_interest_growth: u128,            // 16
    pub borrow_interest_growth_checkpoint: u128, // 16
}

#[account(zero_copy)]
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

    pub fn hedge(&mut self, borrowed_amount: u64, borrowed_amount_notional: u64) -> Result<()> {
        let ci = self.current_borrow_position_index as usize;
        let mut borrow_position = self.borrow_positions[ci].borrow_mut();

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
