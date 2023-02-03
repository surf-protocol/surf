use anchor_lang::prelude::*;
use std::ops::Shr;
use whirlpools_client::{
    errors::ErrorCode as WhirlpoolsErrorCode,
    math::{get_amount_delta_a, get_amount_delta_b, mul_u256, U256Muldiv},
};

use crate::errors::SurfError;

pub fn get_whirlpool_input_tokens_deltas(
    liquidity_input: u128,
    current_sqrt_price: u128,
    upper_sqrt_price: u128,
    lower_sqrt_price: u128,
) -> Result<(u64, u64)> {
    let transform_whirlpool_error = |err: WhirlpoolsErrorCode| match err {
        WhirlpoolsErrorCode::MultiplicationOverflow => SurfError::MultiplicationOverflow,
        WhirlpoolsErrorCode::NumberDownCastError => SurfError::NumberDownCastError,
        WhirlpoolsErrorCode::TokenMaxExceeded => SurfError::TokenMaxExceeded,
        WhirlpoolsErrorCode::MultiplicationShiftRightOverflow => {
            SurfError::MultiplicationShiftRightOverflow
        }
        _ => unreachable!(),
    };

    let base_token_amount =
        get_amount_delta_a(current_sqrt_price, upper_sqrt_price, liquidity_input, true);
    let quote_token_amount =
        get_amount_delta_b(lower_sqrt_price, current_sqrt_price, liquidity_input, true);

    if let Err(err) = base_token_amount {
        return Err(transform_whirlpool_error(err).into());
    }
    if let Err(err) = quote_token_amount {
        return Err(transform_whirlpool_error(err).into());
    }

    Ok((base_token_amount.unwrap(), quote_token_amount.unwrap()))
}

// The following code is reference from orca-so whirlpools program
// https://github.com/orca-so/whirlpools/blob/0.8.0/sdk/src/utils/position-util.ts

pub fn get_liquidity_from_quote_token(
    amount: u64,
    sqrt_price_lower: u128,
    sqrt_price_upper: u128,
    round_up: bool,
) -> u128 {
    let numerator = (amount as u128) << 64;
    let denominator = sqrt_price_upper - sqrt_price_lower;
    if round_up && numerator % denominator > 0_u128 {
        return (numerator / denominator) + 1_u128;
    } else {
        return numerator / denominator;
    }
}

pub fn get_liquidity_from_base_token(
    amount: u64,
    sqrt_price_lower: u128,
    sqrt_price_upper: u128,
    round_up: bool,
) -> Result<u128> {
    let sqrt_price_range = sqrt_price_upper - sqrt_price_lower;
    // u256 is big enough to perform this calculation
    // Max sqrt price is 96 bits
    // 96 + 96 + 64 = 256
    let sqrt_price_mul = mul_u256(sqrt_price_lower, sqrt_price_upper);
    let (result_u256, remainder) = sqrt_price_mul
        .mul(U256Muldiv::new(0, amount as u128))
        .div(U256Muldiv::new(0, sqrt_price_range), true);
    let result = result_u256.try_into_u128();

    if let Err(_) = result {
        // TODO: Handle
        return Err(SurfError::BaseTokenOverflow.into());
    }

    dbg!(result.unwrap().shr(64));

    if round_up && !remainder.is_zero() {
        return Ok((result.unwrap().shr(64) as u128) + 1);
    } else {
        return Ok(result.unwrap().shr(64));
    }
}

#[cfg(test)]
mod test_liquidity_math {
    // Tests based on whirlpools sdk
    // https://github.com/orca-so/whirlpools/blob/0.8.0/sdk/src/utils/position-util.ts
    use crate::utils::orca::liquidity_math::{
        get_liquidity_from_base_token, get_liquidity_from_quote_token,
    };

    #[test]
    fn test_valid_get_liquidity_from_base_token() {
        let upper_sqrt_price = 2857757303569098241_u128;
        let lower_sqrt_price = 2608763565066556442_u128;
        assert_eq!(
            get_liquidity_from_base_token(1_000_000_000, lower_sqrt_price, upper_sqrt_price, false)
                .unwrap(),
            1623124806_u128,
        )
    }

    #[test]
    fn test_valid_get_liquidity_from_quote_token() {
        let upper_sqrt_price = 2857757303569098241_u128;
        let lower_sqrt_price = 2608763565066556442_u128;
        assert_eq!(
            get_liquidity_from_quote_token(
                1_000_000_000,
                lower_sqrt_price,
                upper_sqrt_price,
                false
            ),
            74085172521_u128,
        )
    }
}
