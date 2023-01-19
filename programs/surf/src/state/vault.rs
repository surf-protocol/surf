use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Vault {
    pub whirlpool: Pubkey,          // 32
    pub whirlpool_position: Pubkey, // 32

    pub token_mint_a: Pubkey,  // 32
    pub token_vault_a: Pubkey, // 32

    pub token_mint_b: Pubkey,  // 32
    pub token_vault_b: Pubkey, // 32

    pub drift_account_stats: Pubkey, // 32
    pub drift_subaccount: Pubkey,    // 32
}

impl Vault {
    pub const LEN: usize = 8 + 256;
    pub const SEED: &'static [u8; 5] = b"vault";
}
