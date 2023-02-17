use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct WhirlpoolPosition {
    pub bump: u8, // 1

    pub id: u64,                    // 8
    pub whirlpool_position: Pubkey, // 32

    pub liquidity: u128,      // 16
    pub liquidity_diff: i128, // 16

    pub base_token_fee_growth: u128,  // 16
    pub quote_token_fee_growth: u128, // 16
}

impl WhirlpoolPosition {
    pub const LEN: usize = 8 + 112;
    pub const NAMESPACE: &[u8; 18] = b"whirlpool_position";

    pub fn open(
        &mut self,
        bump: u8,
        id: u64,
        whirlpool_position: Pubkey,
        liquidity: u128,
        base_token_fee_growth: u128,
        quote_token_fee_growth: u128,
    ) -> () {
        self.bump = bump;
        self.id = id;
        self.whirlpool_position = whirlpool_position;

        self.liquidity = liquidity;

        self.base_token_fee_growth = base_token_fee_growth;
        self.quote_token_fee_growth = quote_token_fee_growth;
    }
}
