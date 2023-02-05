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

    pub is_active: bool,                        // 1
    pub vault_positions_count: u64,             // 16
    pub current_vault_position_id: Option<u64>, // 16

    // Full position price range in ticks
    // 1 tick = 1 basis point
    pub full_tick_range: u32, // 4
    // Price range without adjusting price range
    pub vault_tick_range: u32, // 4
    // Price range without adjusting hedge
    pub hedge_tick_range: u32, // 4
}

impl Vault {
    pub const LEN: usize = 8 + 264;
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

        self.is_active = false;
        self.vault_positions_count = 0;
        self.current_vault_position_id = None;

        self.full_tick_range = full_tick_range;
        self.vault_tick_range = vault_tick_range;
        self.hedge_tick_range = hedge_tick_range;
    }

    pub fn open_position(&mut self, vault_position_id: u64) -> () {
        self.is_active = true;
        self.vault_positions_count = self.vault_positions_count + 1;
        self.current_vault_position_id = Some(vault_position_id);
    }

    pub fn close_position(&mut self) -> () {
        self.is_active = false;
    }
}
