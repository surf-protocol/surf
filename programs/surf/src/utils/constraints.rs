use anchor_lang::prelude::*;
use whirlpools::Whirlpool;

use crate::state::AdminConfig;

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
