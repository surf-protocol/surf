use anchor_lang::prelude::*;
use whirlpools::Whirlpool;
use whirlpools_client::math::sqrt_price_from_tick_index;

use crate::{
    errors::SurfError,
    state::VaultState,
    utils::orca::tick_math::{MAX_TICK_INDEX, MIN_TICK_INDEX},
};

use super::orca::tick_math::get_initializable_tick_index;

pub struct RangeBounds {
    pub upper_tick_index: i32,
    pub lower_tick_index: i32,
    pub upper_sqrt_price: u128,
    pub lower_sqrt_price: u128,
}

pub type WhirlpoolRangeBounds = RangeBounds;
pub type InnerRangeBounds = RangeBounds;

pub fn calculate_whirlpool_and_inner_bounds<'info>(
    vault_state: &Account<'info, VaultState>,
    whirlpool: &Account<'info, Whirlpool>,
) -> (WhirlpoolRangeBounds, InnerRangeBounds, u128) {
    let current_tick = whirlpool.tick_current_index;

    let estimated_whirlpool_tick_range_bounds =
        calculate_range_bounds(current_tick, vault_state.full_tick_range as i32);
    let upper_whirlpool_tick_index = get_initializable_tick_index(
        estimated_whirlpool_tick_range_bounds.0,
        whirlpool.tick_spacing,
    );
    let lower_whirlpool_tick_index = get_initializable_tick_index(
        estimated_whirlpool_tick_range_bounds.1,
        whirlpool.tick_spacing,
    );
    let whirlpool_range_bounds = WhirlpoolRangeBounds {
        upper_sqrt_price: sqrt_price_from_tick_index(upper_whirlpool_tick_index),
        lower_sqrt_price: sqrt_price_from_tick_index(lower_whirlpool_tick_index),
        upper_tick_index: upper_whirlpool_tick_index,
        lower_tick_index: lower_whirlpool_tick_index,
    };

    let inner_tick_range_bounds =
        calculate_range_bounds(current_tick, vault_state.vault_tick_range as i32);
    let inner_range_bounds = InnerRangeBounds {
        upper_sqrt_price: sqrt_price_from_tick_index(inner_tick_range_bounds.0),
        lower_sqrt_price: sqrt_price_from_tick_index(inner_tick_range_bounds.1),
        upper_tick_index: inner_tick_range_bounds.0,
        lower_tick_index: inner_tick_range_bounds.1,
    };

    let middle_tick_index =
        (whirlpool_range_bounds.lower_tick_index + whirlpool_range_bounds.upper_tick_index) / 2;
    let middle_sqrt_price = sqrt_price_from_tick_index(middle_tick_index);

    (
        whirlpool_range_bounds,
        inner_range_bounds,
        middle_sqrt_price,
    )
}

fn calculate_range_bounds(current_tick: i32, tick_range: i32) -> (i32, i32) {
    let upper_tick = current_tick + tick_range / 2;
    let lower_tick = current_tick - tick_range / 2;

    (upper_tick, lower_tick)
}

pub fn validate_bounds(
    whirlpool_range_bounds: &WhirlpoolRangeBounds,
    inner_range_bounds: &InnerRangeBounds,
) -> Result<()> {
    require!(
        MAX_TICK_INDEX > whirlpool_range_bounds.upper_tick_index,
        SurfError::UpperTickIndexOutOfBounds
    );
    require!(
        MIN_TICK_INDEX < whirlpool_range_bounds.lower_tick_index,
        SurfError::LowerTickIndexOutOfBounds
    );

    require_neq!(
        inner_range_bounds.upper_tick_index,
        whirlpool_range_bounds.upper_tick_index
    );
    require_neq!(
        inner_range_bounds.lower_tick_index,
        whirlpool_range_bounds.lower_tick_index
    );

    Ok(())
}
