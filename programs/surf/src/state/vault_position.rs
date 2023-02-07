use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use whirlpools::{
    cpi::{
        self as whirlpool_cpi,
        accounts::{CollectFees, UpdateFeesAndRewards},
    },
    program::Whirlpool as WhirlpoolProgram,
    Position as WhirlpoolPosition, TickArray, Whirlpool,
};

use super::Vault;

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

    // Loss from price range adjustment as percentage
    // Next vault position liquidity is lower by
    // liquidity - liquidity * range_adjustment_liquidity_loss
    pub range_adjustment_liquidity_loss: u128, // 16

    // Loss from hedge adjustments swaps per one unit of liquidity
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
        self.range_adjustment_liquidity_loss = 0;

        self.hedge_adjustment_loss_base_token = 0;
        self.hedge_adjustment_loss_quote_token = 0;

        let half_vault_range = (vault_tick_range as i32) / 2;
        self.vault_upper_tick_index = current_tick_index + half_vault_range;
        self.vault_lower_tick_index = current_tick_index - half_vault_range;
        self.last_hedge_adjustment_tick_index = None;
    }

    pub fn update_fees_and_rewards<'info>(
        &mut self,
        whirlpool: &mut Account<'info, Whirlpool>,
        whirlpool_position: &Account<'info, WhirlpoolPosition>,
        tick_array_lower: &AccountLoader<'info, TickArray>,
        tick_array_upper: &AccountLoader<'info, TickArray>,
        whirlpool_program: &Program<'info, WhirlpoolProgram>,
    ) -> Result<()> {
        whirlpool_cpi::update_fees_and_rewards(CpiContext::new(
            whirlpool_program.to_account_info(),
            UpdateFeesAndRewards {
                whirlpool: whirlpool.to_account_info(),
                position: whirlpool_position.to_account_info(),
                tick_array_lower: tick_array_lower.to_account_info(),
                tick_array_upper: tick_array_upper.to_account_info(),
            },
        ))?;

        whirlpool.reload()?;

        self.fee_growth_base_token = whirlpool.fee_growth_global_a;
        self.fee_growth_quote_token = whirlpool.fee_growth_global_b;

        Ok(())
    }

    pub fn transfer_fees_and_rewards_to_vault<'info>(
        &mut self,
        whirlpool: &Account<'info, Whirlpool>,
        whirlpool_base_token_vault: &Account<'info, TokenAccount>,
        whirlpool_quote_token_vault: &Account<'info, TokenAccount>,
        vault: &Account<'info, Vault>,
        vault_base_token_account: &Account<'info, TokenAccount>,
        vault_quote_token_account: &Account<'info, TokenAccount>,
        whirlpool_position: &Account<'info, WhirlpoolPosition>,
        whirlpool_position_token_account: &Account<'info, TokenAccount>,
        token_program: &Program<'info, Token>,
        whirlpool_program: &Program<'info, WhirlpoolProgram>,
    ) -> Result<()> {
        whirlpool_cpi::collect_fees(CpiContext::new(
            whirlpool_program.to_account_info(),
            CollectFees {
                whirlpool: whirlpool.to_account_info(),
                token_vault_a: whirlpool_base_token_vault.to_account_info(),
                token_vault_b: whirlpool_quote_token_vault.to_account_info(),
                position_authority: vault.to_account_info(),
                token_owner_account_a: vault_base_token_account.to_account_info(),
                token_owner_account_b: vault_quote_token_account.to_account_info(),
                position: whirlpool_position.to_account_info(),
                position_token_account: whirlpool_position_token_account.to_account_info(),
                token_program: token_program.to_account_info(),
            },
        ))?;
        Ok(())
    }
}
