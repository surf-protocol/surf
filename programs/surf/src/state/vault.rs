use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Vault {
    pub bump: u8, // 1

    pub whirlpool: Pubkey, // 32

    pub base_token_mint: Pubkey,    // 32
    pub base_token_account: Pubkey, // 32

    pub quote_token_mint: Pubkey,    // 32
    pub quote_token_account: Pubkey, // 32

    pub drift_stats: Pubkey,      // 32
    pub drift_subaccount: Pubkey, // 32

    pub liquidity: u128, // 16
    // Total fee per one unit of liquidity over the lifetime of vault
    pub base_token_total_fee_growth: u128,  // 16
    pub quote_token_total_fee_growth: u128, // 16

    // Unclaimed fee per one unit of liquidity from previous position after price range adjustment
    pub base_token_fee_unclaimed: u128,  // 16
    pub quote_token_fee_unclaimed: u128, // 16

    // Full position price range in ticks
    // 1 tick = 1 basis point
    pub full_tick_range: u32, // 4
    // Price range without adjusting price range
    pub vault_tick_range: u32, // 4
    // Price range without adjusting hedge
    pub hedge_tick_range: u32, // 4

    pub is_active: bool,

    // If vault is not active set these to defaults
    pub whirlpool_position: Pubkey, // 32

    // If vault is not active set to zero
    pub vault_upper_tick_index: i32,           // 4
    pub vault_lower_tick_index: i32,           // 4
    pub last_hedge_adjustment_tick_index: i32, // 4
}

impl Vault {
    pub const LEN: usize = 8 + 368;
    pub const NAMESPACE: &'static [u8; 5] = b"vault";

    pub fn initialize(
        &mut self,
        bump: u8,
        whirlpool: Pubkey,
        base_token_mint: Pubkey,
        quote_token_mint: Pubkey,
        base_token_account: Pubkey,
        quote_token_account: Pubkey,
        drift_stats: Pubkey,
        drift_subaccount: Pubkey,
        full_tick_range: u32,
        vault_tick_range: u32,
        hedge_tick_range: u32,
    ) -> () {
        self.bump = bump;
        self.whirlpool = whirlpool;

        self.base_token_mint = base_token_mint;
        self.quote_token_mint = quote_token_mint;
        self.base_token_account = base_token_account;
        self.quote_token_account = quote_token_account;

        self.drift_stats = drift_stats;
        self.drift_subaccount = drift_subaccount;

        self.liquidity = 0;

        self.base_token_total_fee_growth = 0;
        self.quote_token_total_fee_growth = 0;
        self.base_token_fee_unclaimed = 0;
        self.quote_token_fee_unclaimed = 0;

        self.full_tick_range = full_tick_range;
        self.vault_tick_range = vault_tick_range;
        self.hedge_tick_range = hedge_tick_range;

        self.is_active = false;
        self.whirlpool_position = Pubkey::default();

        self.vault_upper_tick_index = 0;
        self.vault_lower_tick_index = 0;
        self.last_hedge_adjustment_tick_index = 0;
    }

    pub fn open_position(&mut self, tick_current_index: i32, whirlpool_position: Pubkey) -> () {
        self.is_active = true;
        self.whirlpool_position = whirlpool_position;

        let vault_tick_range = self.vault_tick_range;
        let half_vault_range = (vault_tick_range / 2) as i32;

        self.vault_lower_tick_index = tick_current_index - half_vault_range;
        self.vault_upper_tick_index = tick_current_index + half_vault_range;
        self.last_hedge_adjustment_tick_index = tick_current_index;
    }

    pub fn close_position(&mut self) -> () {
        self.is_active = false;

        self.vault_lower_tick_index = 0;
        self.vault_upper_tick_index = 0;
        self.last_hedge_adjustment_tick_index = 0;
    }
}
