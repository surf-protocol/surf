use anchor_lang::prelude::*;

use crate::errors::SurfError;

#[account]
#[derive(Default)]
pub struct VaultState {
    pub bump: u8, // 1

    pub whirlpool: Pubkey, // 32

    pub base_token_mint: Pubkey,     // 32
    pub quote_token_mint: Pubkey,    // 32
    pub base_token_account: Pubkey,  // 32
    pub quote_token_account: Pubkey, // 32

    // 1 tick = 1 basis point
    pub full_tick_range: u32, // 4
    // Price range without adjusting price range
    pub vault_tick_range: u32, // 4
    // Price range without adjusting hedge
    pub hedge_tick_range: u32, // 4

    // WHIRLPOOL DATA
    pub whirlpool_positions_count: u64,             // 16
    pub current_whirlpool_position_id: Option<u64>, // 16

    // HEDGE DATA
    pub drift_stats: Pubkey,      // 32
    pub drift_subaccount: Pubkey, // 32

    pub collateral_amount: u64,                      // 8
    pub collateral_interest_growth: u128,            // 16
    pub collateral_interest_growth_checkpoint: u128, // 16

    pub hedge_positions_count: u64,             // 8
    pub current_hedge_position_id: Option<u64>, // 8
}

impl VaultState {
    pub const LEN: usize = 8 + 328;
    pub const NAMESPACE: &'static [u8; 11] = b"vault_state";

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

        self.full_tick_range = full_tick_range;
        self.vault_tick_range = vault_tick_range;
        self.hedge_tick_range = hedge_tick_range;

        // HEDGE DATA
        self.drift_stats = drift_stats;
        self.drift_subaccount = drift_subaccount;
    }

    pub fn open_hedge_position(&mut self) -> Result<()> {
        if None == self.current_hedge_position_id {
            self.current_hedge_position_id = Some(0);
        }
        self.hedge_positions_count = self
            .hedge_positions_count
            .checked_add(1)
            .ok_or(SurfError::HedgePositionIdOverflow)?;

        Ok(())
    }

    pub fn update_interest_growth(&mut self, collateral_interest_growth: u128) -> () {
        self.collateral_interest_growth =
            collateral_interest_growth + self.collateral_interest_growth_checkpoint;
    }

    pub fn claim_user_collateral_interest(&mut self, claimed_interest: u64) -> Result<()> {
        let claimed_interest_shl = (claimed_interest as u128) << 64;
        self.collateral_interest_growth_checkpoint = self
            .collateral_interest_growth_checkpoint
            .checked_add(claimed_interest_shl)
            .ok_or(SurfError::CollateralInterestOverflow)?;

        Ok(())
    }
}
