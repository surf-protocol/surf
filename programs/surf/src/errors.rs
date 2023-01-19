use anchor_lang::prelude::*;

#[error_code]
pub enum SurfError {
    #[msg("Could not deserialize drift user stats")]
    InvalidDriftUserStatsAccount,
}
