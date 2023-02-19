use anchor_lang::prelude::*;
use drift::{state::spot_market::SpotMarket, state::user::User};
use whirlpools::{
    cpi::{self as whirlpool_cpi, accounts::UpdateFeesAndRewards},
    program::Whirlpool as WhirlpoolProgram,
    Position as WhirlpoolPosition, TickArray, Whirlpool,
};

use crate::{
    state::{HedgePosition, VaultState, WhirlpoolPosition as VaultWhirlpoolPosition},
    utils::drift::get_interest,
};

pub fn sync_whirlpool_position<'info>(
    vault_whirlpool_position: &mut Account<'info, VaultWhirlpoolPosition>,
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

    vault_whirlpool_position.base_token_fee_growth = whirlpool.fee_growth_global_a;
    vault_whirlpool_position.quote_token_fee_growth = whirlpool.fee_growth_global_b;

    Ok(())
}

pub fn sync_interest_growths<'info>(
    vault_state: &mut Account<'info, VaultState>,
    hedge_position: &mut HedgePosition,
    drift_subaccount: &User,
    collateral_spot_market: &SpotMarket,
    borrow_spot_market: &SpotMarket,
) -> Result<()> {
    let collateral_interest = get_interest(
        vault_state.collateral_amount,
        drift_subaccount,
        collateral_spot_market,
        crate::utils::drift::DriftMarket::Collateral,
    )?;
    vault_state.update_interest_growth(collateral_interest << 64);

    let current_hedge_position = hedge_position.get_current_position();
    let borrow_interest = get_interest(
        current_hedge_position.borrowed_amount,
        drift_subaccount,
        borrow_spot_market,
        crate::utils::drift::DriftMarket::Borrow,
    )?;
    hedge_position.update_interest_growth(borrow_interest << 64);

    Ok(())
}
