use anchor_lang::prelude::*;
use whirlpools::Whirlpool;
use whirlpools_client::math::sqrt_price_from_tick_index;

use crate::errors::SurfError;

// Need to store every vault position separately because liquidity changes
// with different boundaries even if token amounts are the same
#[account]
pub struct VaultPosition {
    pub bump: u8, // 1

    pub vault: Pubkey,              // 32
    pub whirlpool_position: Pubkey, // 32
    pub id: u64,                    // 8
    pub is_closed: bool,            // 1

    pub liquidity: u128, // 16

    pub close_sqrt_price: Option<u128>, // 24
    pub upper_sqrt_price: u128,         // 16
    pub lower_sqrt_price: u128,         // 16
    pub middle_sqrt_price: u128,        // 16

    // Growths and losses are stored per one unit of liquidity
    // Fee growth at time of close of the whirlpool position
    pub fee_growth_base_token: u128,  // 16
    pub fee_growth_quote_token: u128, // 16

    // Total vault liquidity from range_adjustment
    pub range_adjustment_liquidity_diff: i128,

    // Loss from hedge adjustments swaps per one unit of liquidity
    pub hedge_adjustment_loss_base_token: u128,  // 16
    pub hedge_adjustment_loss_quote_token: u128, // 16

    pub vault_upper_tick_index: i32,                   // 4
    pub vault_lower_tick_index: i32,                   // 4
    pub last_hedge_adjustment_tick_index: Option<i32>, // 8
}

impl VaultPosition {
    pub const LEN: usize = 8 + 272;
    pub const NAMESPACE: &'static [u8; 14] = b"vault_position";

    pub fn open(
        &mut self,
        bump: u8,
        vault: Pubkey,
        whirlpool_position: Pubkey,
        id: u64,
        liquidity: u128,

        current_fee_growth_base_token: u128,
        current_fee_growth_quote_token: u128,

        upper_tick_index: i32,
        lower_tick_index: i32,

        current_tick_index: i32,
        vault_tick_range: u32,
    ) -> () {
        self.bump = bump;
        self.vault = vault;
        self.whirlpool_position = whirlpool_position;
        self.id = id;
        self.is_closed = false;

        self.liquidity = liquidity;

        let middle_tick_index = (upper_tick_index + lower_tick_index) / 2;
        let middle_sqrt_price = sqrt_price_from_tick_index(middle_tick_index);
        let upper_sqrt_price = sqrt_price_from_tick_index(upper_tick_index);
        let lower_sqrt_price = sqrt_price_from_tick_index(lower_tick_index);

        self.middle_sqrt_price = middle_sqrt_price;
        self.upper_sqrt_price = upper_sqrt_price;
        self.lower_sqrt_price = lower_sqrt_price;
        self.close_sqrt_price = None;

        self.fee_growth_base_token = current_fee_growth_base_token;
        self.fee_growth_quote_token = current_fee_growth_quote_token;

        // Can be initialized to zero because it is specific to vault position
        self.range_adjustment_liquidity_diff = 0;

        self.hedge_adjustment_loss_base_token = 0;
        self.hedge_adjustment_loss_quote_token = 0;

        let half_vault_range = (vault_tick_range as i32) / 2;
        self.vault_upper_tick_index = current_tick_index + half_vault_range;
        self.vault_lower_tick_index = current_tick_index - half_vault_range;
        self.last_hedge_adjustment_tick_index = None;
    }

    /// Updates fee growths to match current whirlpool fee growths
    /// **Has to be called after whirlpool position was updated**
    pub fn update_fee_growths<'info>(&mut self, whirlpool: &Account<'info, Whirlpool>) -> () {
        self.fee_growth_base_token = whirlpool.fee_growth_global_a;
        self.fee_growth_quote_token = whirlpool.fee_growth_global_b;
    }

    /// **Has to be called after whirlpool position was updated**
    pub fn deposit_liquidity<'info>(
        &mut self,
        whirlpool: &Account<'info, Whirlpool>,
        liquidity_input: u128,
    ) -> Result<()> {
        self.liquidity
            .checked_add(liquidity_input)
            .ok_or(SurfError::LiquidityOverflow)?;

        self.update_fee_growths(whirlpool);

        Ok(())
    }
}
