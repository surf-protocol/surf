use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct UserPosition {
    pub bump: u8, // 1

    pub vault: Pubkey, // 32

    pub liquidity: u128, // 16

    pub fee_growth_checkpoint_base_token: u128,  // 16
    pub fee_growth_checkpoint_quote_token: u128, // 16
    pub fee_unclaimed_base_token: u64,           // 8
    pub fee_unclaimed_quote_token: u64,          // 8
}

impl UserPosition {
    pub const LEN: usize = 8 + 104;
    pub const NAMESPACE: &'static [u8; 13] = b"user_position";

    pub fn initialize(
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

        self.fee_growth_checkpoint_base_token = current_fee_growth_base_token;
        self.fee_growth_checkpoint_quote_token = current_fee_growth_quote_token;
        self.fee_unclaimed_base_token = 0;
        self.fee_unclaimed_quote_token = 0;
    }
}
