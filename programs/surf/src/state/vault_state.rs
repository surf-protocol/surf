use anchor_lang::prelude::{borsh, *};

use crate::errors::SurfError;

#[derive(AnchorDeserialize, AnchorSerialize, Clone, Copy, PartialEq)]
pub enum WhirlpoolAdjustmentState {
    None,
    Above,
    Below,
}

impl Default for WhirlpoolAdjustmentState {
    fn default() -> Self {
        WhirlpoolAdjustmentState::None
    }
}

#[account]
#[derive(Default)]
pub struct VaultState {
    pub bump: [u8; 1], // 1

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
    pub whirlpool_positions_count: u64,                       // 16
    pub current_whirlpool_position_id: Option<u64>,           // 16
    pub whirlpool_adjustment_state: WhirlpoolAdjustmentState, // 1

    // HEDGE DATA
    pub drift_stats: Pubkey,      // 32
    pub drift_subaccount: Pubkey, // 32

    pub collateral_amount: u64,                      // 8
    pub collateral_interest_growth: u128,            // 16
    pub collateral_interest_growth_checkpoint: u128, // 16

    pub hedge_positions_count: u64,             // 8
    pub current_hedge_position_id: Option<u64>, // 16

    pub last_hedge_adjustment_tick: Option<i32>, // 4
}

impl VaultState {
    pub const LEN: usize = 8 + 336;
    pub const NAMESPACE: &'static [u8; 11] = b"vault_state";

    pub fn get_signer_seeds(&self) -> [&[u8]; 3] {
        [
            Self::NAMESPACE.as_ref(),
            self.whirlpool.as_ref(),
            self.bump.as_ref(),
        ]
    }

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
        self.bump = [bump];

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

    pub fn open_whirlpool_position(&mut self) -> Result<()> {
        self.current_whirlpool_position_id = Some(self.whirlpool_positions_count);
        self.whirlpool_positions_count = self
            .whirlpool_positions_count
            .checked_add(1)
            .ok_or(SurfError::WhirlpoolPositionIdOverflow)?;

        Ok(())
    }

    pub fn update_whirlpool_adjustment_state(
        &mut self,
        updated_state: WhirlpoolAdjustmentState,
    ) -> () {
        self.whirlpool_adjustment_state = updated_state;
    }

    pub fn initialize_hedge_position(&mut self) -> Result<()> {
        self.hedge_positions_count = self
            .hedge_positions_count
            .checked_add(1)
            .ok_or(SurfError::HedgePositionIdOverflow)?;

        Ok(())
    }

    pub fn set_initial_hedge_position_id(&mut self) -> () {
        self.current_hedge_position_id = Some(0);
    }

    /// Assumes initial position has already been set
    /// as it should be called only post initial id set
    pub fn update_hedge_position_id(&mut self) -> Result<()> {
        let current_id = self.current_hedge_position_id;
        self.current_hedge_position_id = Some(
            current_id
                .unwrap()
                .checked_add(1)
                .ok_or(SurfError::HedgePositionIdOverflow)?,
        );

        Ok(())
    }

    pub fn update_hedge_adjustment_tick(&mut self, tick: i32) -> () {
        self.last_hedge_adjustment_tick = Some(tick);
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
