use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use drift::state::{spot_market::SpotMarket, user::User};

use crate::{
    errors::SurfError,
    state::{BorrowPosition, HedgePosition, UserPosition, VaultState},
    utils::drift::get_global_interest,
};

pub fn sync_vault_collateral_interest_growth<'info>(
    vault_state: &mut Account<'info, VaultState>,
    drift_subaccount: &User,
    collateral_spot_market: &SpotMarket,
) -> Result<()> {
    let global_collateral_interest = get_global_interest(
        vault_state.collateral_amount,
        drift_subaccount,
        collateral_spot_market,
        crate::utils::drift::DriftMarket::Collateral,
    )?;
    let collateral_interest_growth =
        calculate_interest_per_unit(vault_state.collateral_amount, global_collateral_interest)?;
    vault_state.update_interest_growth(collateral_interest_growth);

    Ok(())
}

pub fn sync_vault_borrow_interest_growth(
    hedge_position: &mut HedgePosition,
    drift_subaccount: &User,
    borrow_spot_market: &SpotMarket,
) -> Result<()> {
    let current_borrow_position = hedge_position.get_current_position();
    let global_borrow_interest = get_global_interest(
        current_borrow_position.borrowed_amount,
        drift_subaccount,
        borrow_spot_market,
        crate::utils::drift::DriftMarket::Borrow,
    )?;
    let borrow_interest_growth = calculate_interest_per_unit(
        current_borrow_position.borrowed_amount,
        global_borrow_interest,
    )?;
    hedge_position.update_interest_growth(borrow_interest_growth);

    Ok(())
}

pub fn sync_vault_interest_growths<'info>(
    vault_state: &mut Account<'info, VaultState>,
    hedge_position: &mut HedgePosition,
    drift_subaccount: &User,
    collateral_spot_market: &SpotMarket,
    borrow_spot_market: &SpotMarket,
) -> Result<()> {
    sync_vault_collateral_interest_growth(vault_state, drift_subaccount, collateral_spot_market)?;
    sync_vault_borrow_interest_growth(hedge_position, drift_subaccount, borrow_spot_market)?;

    Ok(())
}

pub fn update_user_borrow_interest<'info>(
    user_position: &mut Account<'info, UserPosition>,
    borrow_position: &BorrowPosition,
) -> Result<()> {
    let borrow_interest_delta =
        borrow_position.borrow_interest_growth - user_position.borrow_interest_growth_checkpoint;

    let user_interest_unclaimed =
        calculate_user_interest(user_position.borrow_amount, borrow_interest_delta)?;

    user_position.borrow_interest_unclaimed =
        user_position.borrow_interest_unclaimed + user_interest_unclaimed;
    user_position.borrow_interest_growth_checkpoint = borrow_position.borrow_interest_growth;

    Ok(())
}

pub fn update_user_collateral_interest<'info>(
    user_position: &mut Account<'info, UserPosition>,
    vault_state: &Account<'info, VaultState>,
) -> Result<()> {
    let interest_delta = vault_state.collateral_interest_growth
        - user_position.collateral_interest_growth_checkpoint;
    let interest_unclaimed =
        calculate_user_interest(user_position.collateral_amount, interest_delta)?;

    user_position.collateral_interest_unclaimed =
        user_position.collateral_interest_unclaimed + interest_unclaimed;
    user_position.collateral_interest_growth_checkpoint = vault_state.collateral_interest_growth;

    Ok(())
}

pub fn update_user_interests<'info>(
    user_position: &mut Account<'info, UserPosition>,
    vault_state: &Account<'info, VaultState>,
    borrow_position: &BorrowPosition,
) -> Result<()> {
    update_user_borrow_interest(user_position, borrow_position)?;
    update_user_collateral_interest(user_position, vault_state)?;

    Ok(())
}

/// u64 << 64 = 64 int bits + 64 fractional bits (Q64.64)
/// Q64.64 / u64 = Q64.64
pub fn calculate_interest_per_unit(global_total: u64, global_interest: u64) -> Result<u128> {
    if global_total < global_interest {
        return Err(SurfError::MathError.into());
    }

    let interest_per_unit_shl = (global_interest as u128) << 64;
    let interest_per_unit = interest_per_unit_shl / (global_total as u128);
    Ok(interest_per_unit)
}

/// u64 * u128 (Q64.64) = u128 (u196 but can not be higher than u128)
/// u128 >> 64 = u64
pub fn calculate_user_interest(user_total: u64, interest_per_unit: u128) -> Result<u64> {
    let user_interest_shl = (user_total as u128)
        .checked_mul(interest_per_unit)
        .ok_or(SurfError::MathError)?;
    let user_interest = user_interest_shl >> 64;
    Ok(user_interest as u64)
}

pub fn update_user_borrow_amounts<'info>(
    user_position: &mut Account<'info, UserPosition>,
    borrow_position: &BorrowPosition,
) -> Result<()> {
    let user_borrowed_amount = user_position.borrow_amount;
    let global_borrowed_amount = borrow_position.borrowed_amount;
    let global_borrowed_amount_diff = borrow_position.borrowed_amount_diff;

    let new_user_borrowed_amount = calculate_user_amount_diff(
        global_borrowed_amount,
        global_borrowed_amount_diff,
        user_borrowed_amount,
    )?;

    user_position.borrow_amount = new_user_borrowed_amount;

    let user_borrowed_amount_notional = user_position.borrow_amount_notional;
    let global_borrowed_amount_notional = borrow_position.borrowed_amount_notional;
    let global_borrowed_amount_notional_diff = borrow_position.borrowed_amount_notional_diff;

    let new_user_borrowed_amount_notional = calculate_user_amount_diff(
        global_borrowed_amount_notional,
        global_borrowed_amount_notional_diff,
        user_borrowed_amount_notional,
    )?;

    user_position.borrow_amount_notional = new_user_borrowed_amount_notional;

    Ok(())
}

pub fn calculate_user_amount_diff(
    global_amount: u64,
    global_diff: i64,
    user_amount: u64,
) -> Result<u64> {
    let is_negative = global_diff < 0;
    let global_diff_abs = global_diff.unsigned_abs();

    if global_diff_abs > global_amount {
        return Err(SurfError::MathError.into());
    }

    let new_global_amount = if is_negative {
        global_amount - global_diff_abs
    } else {
        // Diff overflow
        global_amount
            .checked_add(global_diff_abs)
            .ok_or(SurfError::MathError)?
    };

    // u64 * u64 / u64 = u64
    let new_user_amount =
        (user_amount as u128) * (global_diff_abs as u128) / (new_global_amount as u128);

    Ok(new_user_amount as u64)
}

pub fn get_hedged_notional_amount<'info>(
    vault_quote_token_account: &mut Account<'info, TokenAccount>,
) -> Result<u64> {
    let pre_amount = vault_quote_token_account.amount;
    vault_quote_token_account.reload()?;
    let post_amount = vault_quote_token_account.amount;

    Ok(post_amount - pre_amount)
}

pub fn increase_vault_hedge_token_amounts<'info>(
    vault_state: &mut Account<'info, VaultState>,
    hedge_position: &mut HedgePosition,
    collateral_amount: u64,
    borrow_amount: u64,
    borrow_amount_notional: u64,
) -> Result<()> {
    vault_state.collateral_amount = vault_state
        .collateral_amount
        .checked_add(collateral_amount)
        .ok_or(SurfError::CollateralOverflow)?;

    hedge_position.hedge(borrow_amount, borrow_amount_notional)?;

    Ok(())
}
