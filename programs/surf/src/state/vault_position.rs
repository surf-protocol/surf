use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct VaultPosition {
    bump: u8, // 1

    whirlpool_position: Pubkey, // 32

    vault_upper_tick_index: i32, // 4
    vault_lower_tick_index: i32, // 4

    last_hedge_adjustment_tick_index: i32, // 4
}

impl<'info> VaultPosition {
    pub const LEN: usize = 8 + 48;
    pub const NAMESPACE: &'static [u8; 14] = b"vault_position";

    pub fn initialize(
        &mut self,
        bump: u8,
        whirlpool_position: Pubkey,
        vault_tick_range: u32,
        tick_current_index: i32,
    ) -> () {
        self.bump = bump;
        self.whirlpool_position = whirlpool_position;

        let half_vault_range = (vault_tick_range / 2) as i32;

        self.vault_lower_tick_index = tick_current_index - half_vault_range;
        self.vault_upper_tick_index = tick_current_index + half_vault_range;
        self.last_hedge_adjustment_tick_index = tick_current_index;
    }
}
