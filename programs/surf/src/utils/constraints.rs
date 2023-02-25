use anchor_lang::prelude::*;
use whirlpools::Whirlpool;

use crate::{
    errors::SurfError,
    state::{AdminConfig, HedgePosition, VaultState},
};

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

pub fn validate_hedge_position<'info>(
    vault_state: Account<'info, VaultState>,
    hedge_position: AccountLoader<'info, HedgePosition>,
    program_id: &Pubkey,
) -> Result<()> {
    require!(
        vault_state.hedge_positions_count > 0,
        SurfError::InvalidHedgePosition
    );

    let (required_pk, _) = Pubkey::find_program_address(
        &[
            HedgePosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            vault_state
                .current_hedge_position_id
                .unwrap()
                .to_le_bytes()
                .as_ref(),
        ],
        program_id,
    );

    require_keys_eq!(
        hedge_position.key(),
        required_pk,
        SurfError::InvalidHedgePosition
    );

    Ok(())
}
