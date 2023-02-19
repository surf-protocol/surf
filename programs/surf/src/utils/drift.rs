use anchor_lang::prelude::*;
use drift::{
    math::spot_balance::get_token_amount,
    state::{
        spot_market::{SpotBalanceType, SpotMarket},
        user::User,
    },
};

use crate::errors::SurfError;

pub fn get_token_amount_wrapped(
    balance: u128,
    spot_market: &SpotMarket,
    balance_type: &SpotBalanceType,
) -> Result<u128> {
    let token_amount = get_token_amount(balance, spot_market, balance_type);
    if let Err(_) = token_amount {
        return Err(SurfError::MathError.into());
    }
    Ok(token_amount.unwrap())
}

pub enum DriftMarket {
    Collateral,
    Borrow,
}

pub fn get_interest<'info>(
    token_amount_without_interest: u64,
    drift_subaccount: &User,
    spot_market: &SpotMarket,
    drift_market: DriftMarket,
) -> Result<u128> {
    let position_idx = match drift_market {
        DriftMarket::Borrow => 1,
        DriftMarket::Collateral => 0,
    };

    let drift_position = drift_subaccount.spot_positions[position_idx];
    let token_amount_with_interest = get_token_amount_wrapped(
        drift_position.scaled_balance.into(),
        &spot_market,
        &SpotBalanceType::Deposit,
    )?;
    let interest = token_amount_with_interest - token_amount_without_interest as u128;

    if interest > u64::MAX as u128 {
        return match drift_market {
            DriftMarket::Borrow => Err(SurfError::BorrowInterestOverflow.into()),
            DriftMarket::Collateral => Err(SurfError::CollateralInterestOverflow.into()),
        };
    }

    Ok(interest)
}
