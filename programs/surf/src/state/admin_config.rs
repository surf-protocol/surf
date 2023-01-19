use anchor_lang::prelude::{Pubkey, *};

#[account]
#[derive(Default)]
pub struct AdminConfig {
    pub admin_key: Pubkey, // 32
    pub bump: u8,          // 1
}

impl AdminConfig {
    pub const LEN: usize = 8 + 33;
    pub const SEED: &'static [u8; 12] = b"admin_config";
}
