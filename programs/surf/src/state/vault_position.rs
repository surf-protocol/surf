use anchor_lang::prelude::*;

// Need to store every vault position separately because liquidity changes
// with different boundaries even if token amounts are the same
#[account]
pub struct VaultPosition {
    pub bump: u8, // 1

    pub id: u64,                    // 8
    pub whirlpool_position: Pubkey, // 32
    pub is_closed: bool,            // 1

    pub liquidity: u128, // 16

    pub close_sqrt_price: Option<u128>, // 24
    pub upper_sqrt_price: u128,         // 16
    pub lower_sqrt_price: u128,         // 16

    // Loss from price range adjustment swap per one unit of liquidity
    pub base_token_price_range_adjustment_loss: u128, // 16
    pub quote_token_price_range_adjustment_loss: u128, // 16

    // Loss from hedge adjustments swap per one unit of liquidity
    pub base_token_hedge_adjustment_loss: u128,  // 16
    pub quote_token_hedge_adjustment_loss: u128, // 16

    // Fee growth at time of close of the whirlpool position
    pub base_token_fee_growth: u128,  // 16
    pub quote_token_fee_growth: u128, // 16

    pub base_token_fee_growth_unclaimed: u128,  // 16
    pub quote_token_fee_growth_unclaimed: u128, // 16

    pub vault_upper_tick_index: i32,                   // 4
    pub vault_lower_tick_index: i32,                   // 4
    pub last_hedge_adjustment_tick_index: Option<i32>, // 8
}

impl VaultPosition {
    pub const LEN: usize = 8 + 264;
    pub const NAMESPACE: &'static [u8; 14] = b"vault_position";

    pub fn open(
        &mut self,
        bump: u8,
        id: u64,
        whirlpool_position: Pubkey,
        liquidity: u128,

        upper_sqrt_price: u128,
        lower_sqrt_price: u128,

        current_tick_index: i32,
        vault_tick_range: u32,
    ) -> () {
        self.bump = bump;
        self.id = id;
        self.whirlpool_position = whirlpool_position;
        self.is_closed = false;

        self.liquidity = liquidity;

        self.upper_sqrt_price = upper_sqrt_price;
        self.lower_sqrt_price = lower_sqrt_price;
        self.close_sqrt_price = None;

        self.base_token_price_range_adjustment_loss = 0;
        self.quote_token_price_range_adjustment_loss = 0;
        self.base_token_hedge_adjustment_loss = 0;
        self.quote_token_hedge_adjustment_loss = 0;

        self.base_token_fee_growth_unclaimed = 0;
        self.quote_token_fee_growth_unclaimed = 0;

        let half_vault_range = (vault_tick_range as i32) / 2;
        self.vault_upper_tick_index = current_tick_index + half_vault_range;
        self.vault_lower_tick_index = current_tick_index - half_vault_range;
        self.last_hedge_adjustment_tick_index = None;
    }

    pub fn close(
        &mut self,
        close_sqrt_price: u128,
        base_token_fee_growth: u128,
        quote_token_fee_growth: u128,
    ) -> () {
        self.close_sqrt_price = Some(close_sqrt_price);
        self.whirlpool_position = Pubkey::default();
        self.is_closed = true;

        self.base_token_fee_growth = base_token_fee_growth;
        self.quote_token_fee_growth = quote_token_fee_growth;
    }

    pub fn update_hedge_adjustment(
        &mut self,
        current_tick_index: i32,
        base_token_loss: u128,
        quote_token_loss: u128,
    ) -> () {
        self.last_hedge_adjustment_tick_index = Some(current_tick_index);

        self.base_token_hedge_adjustment_loss =
            self.base_token_hedge_adjustment_loss + base_token_loss;
        self.quote_token_hedge_adjustment_loss =
            self.quote_token_hedge_adjustment_loss + quote_token_loss;
    }
}
