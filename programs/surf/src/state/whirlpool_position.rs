use anchor_lang::prelude::*;

use crate::errors::SurfError;

#[account]
#[derive(Default)]
pub struct WhirlpoolPosition {
    pub bump: u8, // 1

    pub vault_state: Pubkey,        // 32
    pub id: u64,                    // 8
    pub whirlpool_position: Pubkey, // 32

    pub liquidity: u128,      // 16
    pub liquidity_diff: i128, // 16

    pub base_token_fee_growth: u128,  // 16
    pub quote_token_fee_growth: u128, // 16

    pub upper_sqrt_price: u128, // 16
    pub lower_sqrt_price: u128, // 16
}

impl WhirlpoolPosition {
    pub const LEN: usize = 8 + 176;
    pub const NAMESPACE: &'static [u8; 18] = b"whirlpool_position";

    pub fn open(
        &mut self,
        bump: u8,
        vault_state: Pubkey,
        id: u64,
        whirlpool_position: Pubkey,
        liquidity: u128,
        base_token_fee_growth: u128,
        quote_token_fee_growth: u128,
        upper_sqrt_price: u128,
        lower_sqrt_price: u128,
    ) -> () {
        self.bump = bump;
        self.vault_state = vault_state;
        self.id = id;
        self.whirlpool_position = whirlpool_position;

        self.liquidity = liquidity;

        self.base_token_fee_growth = base_token_fee_growth;
        self.quote_token_fee_growth = quote_token_fee_growth;

        self.upper_sqrt_price = upper_sqrt_price;
        self.lower_sqrt_price = lower_sqrt_price;
    }

    pub fn deposit_liquidity(&mut self, liquidity_input: u128) -> Result<()> {
        self.liquidity = self
            .liquidity
            .checked_add(liquidity_input)
            .ok_or(SurfError::LiquidityOverflow)?;

        Ok(())
    }
}
