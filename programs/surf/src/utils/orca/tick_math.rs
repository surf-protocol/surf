// https://github.com/orca-so/whirlpools
pub const MAX_TICK_INDEX: i32 = 443636;
pub const MIN_TICK_INDEX: i32 = -443636;

pub fn get_initializable_tick_index(tick_index: i32, tick_spacing: u16) -> i32 {
    tick_index - (tick_index % tick_spacing as i32)
}

#[cfg(test)]
mod test_tick_math {

    mod get_initializable_tick_index {
        use crate::utils::orca::tick_math::get_initializable_tick_index;

        #[test]
        fn rounds_down_positive() {
            assert_eq!(get_initializable_tick_index(4, 8), 0);
            assert_eq!(get_initializable_tick_index(1299, 64), 1280);
        }

        #[test]
        fn rounds_up_negative() {
            assert_eq!(get_initializable_tick_index(-5, 8), 0);
            assert_eq!(get_initializable_tick_index(-1299, 64), -1280);
        }
    }
}
