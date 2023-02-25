use anchor_lang::prelude::*;
use drift::{
    cpi::{self as drift_cpi, accounts::UpdateSpotMarketCumulativeInterest},
    program::Drift,
    state::{spot_market::SpotMarket, state::State as DriftState, user::User as DriftSubaccount},
};
use whirlpools::Whirlpool;

use crate::{
    errors::SurfError,
    helpers::hedge::sync_vault_borrow_interest_growth,
    state::{HedgePosition, VaultState, WhirlpoolPosition},
    utils::orca::liquidity_math::get_amount_delta_a_wrapped,
};

pub fn validate_next_hedge_position(
    hedge_position: &HedgePosition,
    next_hedge_position_key: Pubkey,
) -> Result<()> {
    if hedge_position.current_borrow_position_index == 149 {
        require_keys_neq!(
            next_hedge_position_key,
            Pubkey::default(),
            SurfError::MissingNextHedgePositionAccount,
        );
    }

    Ok(())
}

pub fn update_spot_market_and_sync_borrow_interest_growth<'info>(
    drift_state: &Account<'info, DriftState>,
    drift_spot_market: &AccountLoader<'info, SpotMarket>,
    drift_oracle: &UncheckedAccount<'info>,
    drift_program: &Program<'info, Drift>,
    hedge_position: &mut HedgePosition,
    drift_subaccount: &DriftSubaccount,
) -> Result<()> {
    drift_cpi::update_spot_market_cumulative_interest(CpiContext::new(
        drift_program.to_account_info(),
        UpdateSpotMarketCumulativeInterest {
            state: drift_state.to_account_info(),
            spot_market: drift_spot_market.to_account_info(),
            oracle: drift_oracle.to_account_info(),
        },
    ))?;

    let spot_market = drift_spot_market.load()?;
    sync_vault_borrow_interest_growth(hedge_position, &drift_subaccount, &spot_market)?;

    Ok(())
}

pub fn get_borrowed_amount_diff<'info>(
    whirlpool: &Account<'info, Whirlpool>,
    whirlpool_position: &Account<'info, WhirlpoolPosition>,
    hedge_position: &HedgePosition,
    is_above: bool,
) -> Result<u64> {
    let upper_sqrt_price = whirlpool_position.upper_sqrt_price;
    let current_sqrt_price = whirlpool.sqrt_price;

    let required_borrowed_amount = get_amount_delta_a_wrapped(
        current_sqrt_price,
        upper_sqrt_price,
        whirlpool_position.liquidity,
        true,
    )?;

    let current_borrow_position = hedge_position.get_current_position();
    let current_borrowed_amount = current_borrow_position.borrowed_amount;

    if is_above {
        Ok(current_borrowed_amount - required_borrowed_amount)
    } else {
        Ok(required_borrowed_amount - current_borrowed_amount)
    }
}

pub fn update_program_accounts<'info>(
    borrowed_amount_diff: i64,
    borrowed_amount_diff_notional: i64,
    current_tick: i32,
    hedge_position: &mut HedgePosition,
    vault_state: &mut Account<'info, VaultState>,
    next_hedge_position_ai: &UncheckedAccount<'info>,
) -> Result<()> {
    let (updated_borrowed_amount, updated_borrowed_amount_notional) =
        hedge_position.update_diffs(borrowed_amount_diff, borrowed_amount_diff_notional)?;

    let update_id_res = hedge_position.update_current_position_id();

    if let Some(_) = update_id_res {
        hedge_position
            .hedge(updated_borrowed_amount, updated_borrowed_amount_notional)
            .ok();
    } else {
        let next_hedge_position_loader =
            AccountLoader::<HedgePosition>::try_from(&next_hedge_position_ai)?;
        let mut next_hedge_position = next_hedge_position_loader.load_mut()?;

        next_hedge_position
            .hedge(updated_borrowed_amount, updated_borrowed_amount_notional)
            .ok();

        vault_state.update_hedge_position_id()?;
    }

    vault_state.update_hedge_adjustment_tick(current_tick);

    Ok(())
}
