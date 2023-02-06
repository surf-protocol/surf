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

    // Growths and losses are stored per one unit of liquidity
    // Fee growth at time of close of the whirlpool position
    pub fee_growth_base_token: u128,  // 16
    pub fee_growth_quote_token: u128, // 16

    // Loss from price range adjustment swap per one unit of liquidity
    pub range_adjustment_loss_base_token: u128,  // 16
    pub range_adjustment_loss_quote_token: u128, // 16

    // Loss from hedge adjustments swap per one unit of liquidity
    pub hedge_adjustment_loss_base_token: u128,  // 16
    pub hedge_adjustment_loss_quote_token: u128, // 16

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

        current_fee_growth_base_token: u128,
        current_fee_growth_quote_token: u128,

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

        self.fee_growth_base_token = current_fee_growth_base_token;
        self.fee_growth_quote_token = current_fee_growth_quote_token;

        // Can be initialized to zero because it is specific to vault position
        self.range_adjustment_loss_base_token = 0;
        self.range_adjustment_loss_quote_token = 0;

        self.hedge_adjustment_loss_base_token = 0;
        self.hedge_adjustment_loss_quote_token = 0;

        let half_vault_range = (vault_tick_range as i32) / 2;
        self.vault_upper_tick_index = current_tick_index + half_vault_range;
        self.vault_lower_tick_index = current_tick_index - half_vault_range;
        self.last_hedge_adjustment_tick_index = None;
    }
}
