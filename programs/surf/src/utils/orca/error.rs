use whirlpools_client::errors::ErrorCode as WhirlpoolErrorCode;

use crate::errors::SurfError;

pub fn transform_error(err: WhirlpoolErrorCode) -> SurfError {
    match err {
        WhirlpoolErrorCode::MultiplicationOverflow => SurfError::MultiplicationOverflow,
        WhirlpoolErrorCode::NumberDownCastError => SurfError::NumberDownCastError,
        WhirlpoolErrorCode::TokenMaxExceeded => SurfError::TokenMaxExceeded,
        WhirlpoolErrorCode::MultiplicationShiftRightOverflow => {
            SurfError::MultiplicationShiftRightOverflow
        }
        _ => unreachable!(),
    }
}
