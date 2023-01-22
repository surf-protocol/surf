use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Vault {
    pub bump: u8, // 1

    pub whirlpool: Pubkey, // 32
    // Only assigned if position is opened
    pub vault_position: Pubkey, // 32

    pub token_mint_a: Pubkey,  // 32
    pub token_vault_a: Pubkey, // 32

    pub token_mint_b: Pubkey,  // 32
    pub token_vault_b: Pubkey, // 32

    pub drift_stats: Pubkey,      // 32
    pub drift_subaccount: Pubkey, // 32

    pub liquidity: u128, // 16
    // Total fee per one unit of liquidity over the lifetime of vault
    pub total_fee_growth_a: u128, // 16
    pub total_fee_growth_b: u128, // 16

    // Unclaimed fee per one unit of liquidity from previous position after price range adjustment
    pub fee_unclaimed_a: u128, // 16
    pub fee_unclaimed_b: u128, // 16

    // Full position price range in ticks
    // 1 tick = 1 basis point
    pub full_tick_range: u32, // 4
    // Price range without adjusting price range
    pub vault_tick_range: u32, // 4
    // Price range without adjusting hedge
    pub hedge_tick_range: u32, // 4
}

impl Vault {
    pub const LEN: usize = 8 + 352;
    pub const NAMESPACE: &'static [u8; 5] = b"vault";

    pub fn initialize(
        &mut self,
        bump: u8,
        whirlpool: Pubkey,
        token_mint_a: Pubkey,
        token_mint_b: Pubkey,
        token_vault_a: Pubkey,
        token_vault_b: Pubkey,
        drift_stats: Pubkey,
        drift_subaccount: Pubkey,
        full_tick_range: u32,
        vault_tick_range: u32,
        hedge_tick_range: u32,
    ) -> () {
        self.bump = bump;
        self.whirlpool = whirlpool;
        self.vault_position = Pubkey::default();

        self.token_mint_a = token_mint_a;
        self.token_mint_b = token_mint_b;
        self.token_vault_a = token_vault_a;
        self.token_vault_b = token_vault_b;

        self.drift_stats = drift_stats;
        self.drift_subaccount = drift_subaccount;

        self.liquidity = 0;
        self.total_fee_growth_a = 0;
        self.total_fee_growth_b = 0;

        self.fee_unclaimed_a = 0;
        self.fee_unclaimed_b = 0;

        self.full_tick_range = full_tick_range;
        self.vault_tick_range = vault_tick_range;
        self.hedge_tick_range = hedge_tick_range;
    }
}
