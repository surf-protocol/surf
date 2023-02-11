use anchor_lang::prelude::*;
use whirlpools::Whirlpool;

use crate::state::{AdminConfig, Vault, VaultPosition};

pub fn is_admin<'info>(admin_config: &Account<'info, AdminConfig>, admin: &Signer<'info>) -> bool {
    admin_config.admin_key.eq(&admin.key())
}

pub fn have_matching_mints<'info>(
    whirlpool_a: &Account<'info, Whirlpool>,
    whirlpool_b: &Account<'info, Whirlpool>,
) -> bool {
    whirlpool_a.token_mint_a.eq(&whirlpool_b.token_mint_a)
        && whirlpool_b.token_mint_b.eq(&whirlpool_b.token_mint_b)
}

pub fn is_valid_whirlpool<'info>(
    whirlpool: &Account<'info, Whirlpool>,
    vault: &Account<'info, Vault>,
) -> bool {
    whirlpool.key().eq(&vault.whirlpool)
}

pub fn is_vault_position_updated<'info>(
    vault_position: &Account<'info, VaultPosition>,
    whirlpool: &Account<'info, Whirlpool>,
) -> bool {
    vault_position.fee_growth_base_token == whirlpool.fee_growth_global_a
        && vault_position.fee_growth_quote_token == whirlpool.fee_growth_global_b
}

pub fn is_position_open<'info>(vault_position: &Account<'info, VaultPosition>) -> bool {
    vault_position.whirlpool_position.ne(&Pubkey::default())
}
