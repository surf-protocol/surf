use anchor_lang::prelude::*;
use whirlpools_client::math::checked_mul_shift_right;

#[account]
#[derive(Default)]
pub struct UserPosition {
    pub bump: u8, // 1

    pub vault: Pubkey, // 32

    pub liquidity: u128, // 16

    pub is_hedged: bool,              // 1
    pub collateral_quote_amount: u64, // 8
    pub borrow_base_amount: u64,      // 8

    pub fee_growth_checkpoint_base_token: u128,  // 16
    pub fee_growth_checkpoint_quote_token: u128, // 16
    pub fee_unclaimed_base_token: u64,           // 8
    pub fee_unclaimed_quote_token: u64,          // 8
}

impl UserPosition {
    pub const LEN: usize = 8 + 104;
    pub const NAMESPACE: &'static [u8; 13] = b"user_position";

    pub fn open(
        &mut self,
        bump: u8,
        vault_key: Pubkey,
        liquidity: u128,
        current_fee_growth_base_token: u128,
        current_fee_growth_quote_token: u128,
    ) -> () {
        self.bump = bump;
        self.vault = vault_key;

        self.liquidity = liquidity;

        self.is_hedged = false;
        self.collateral_quote_amount = 0;
        self.borrow_base_amount = 0;

        self.fee_growth_checkpoint_base_token = current_fee_growth_base_token;
        self.fee_growth_checkpoint_quote_token = current_fee_growth_quote_token;
        self.fee_unclaimed_base_token = 0;
        self.fee_unclaimed_quote_token = 0;
    }

    pub fn update_hedge(&mut self, collateral_quote_amount: u64, borrow_base_amount: u64) -> () {
        self.is_hedged = true;
        self.collateral_quote_amount = collateral_quote_amount;
        self.borrow_base_amount = borrow_base_amount;
    }

    pub fn update_fees(
        &mut self,
        current_fee_growth_base_token: u128,
        current_fee_growth_quote_token: u128,
    ) -> () {
        let base_token_fee_growth_delta =
            current_fee_growth_base_token - self.fee_growth_checkpoint_base_token;
        let quote_token_fee_growth_delta =
            current_fee_growth_quote_token - self.fee_growth_checkpoint_quote_token;

        let fee_unclaimed_base_token =
            checked_mul_shift_right(self.liquidity, base_token_fee_growth_delta).unwrap_or(0);
        let fee_unclaimed_quote_token =
            checked_mul_shift_right(self.liquidity, quote_token_fee_growth_delta).unwrap_or(0);

        self.fee_growth_checkpoint_base_token = current_fee_growth_base_token;
        self.fee_growth_checkpoint_quote_token = current_fee_growth_quote_token;
        self.fee_unclaimed_base_token = fee_unclaimed_base_token;
        self.fee_unclaimed_quote_token = fee_unclaimed_quote_token;
    }
}
