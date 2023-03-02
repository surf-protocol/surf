use whirlpools_client::math::{MAX_SQRT_PRICE_X64, MIN_SQRT_PRICE_X64};

pub fn get_default_sqrt_price_limit(a_to_b: bool) -> u128 {
    if a_to_b {
        MIN_SQRT_PRICE_X64
    } else {
        MAX_SQRT_PRICE_X64
    }
}

pub fn get_default_other_amount_threshold(amount_specified_is_input: bool) -> u64 {
    if amount_specified_is_input {
        0
    } else {
        u64::MAX
    }
}
