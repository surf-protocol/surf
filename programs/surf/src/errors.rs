use anchor_lang::prelude::*;

// TODO: Comments with hex values
#[error_code]
pub enum SurfError {
    #[msg("admin account key does not correspond with admin_config admin_key")]
    InvalidAdmin,

    // Possibly change the amount of ticks later
    #[msg("Whirlpool position price range should be higher than 400 ticks")]
    FullTickRangeTooSmall,
    #[msg("Vault tick range should be higher than 200 ticks")]
    VaultTickRangeTooSmall,
    #[msg("Vault tick range should be lower or equal than 50% of full tick range")]
    VaultTickRangeTooBig,
    #[msg("Hegde tick range should be higher than 20 ticks")]
    HedgeTickRangeTooSmall,
    #[msg("Hegde tick range should be lower than vault tick range")]
    HedgeTickRangeTooBig,

    #[msg("Could not deserialize drift_account_stats")]
    InvalidDriftAccountStatsAccount,

    #[msg("Lower tick index must be lower than upper tick index")]
    InvalidTickIndexes,
    #[msg("Provided tick range does not correspond to vault preset")]
    InvalidProvidedTickRange,
    #[msg("Current tick index is shifted too many ticks from middle of full tick range")]
    CurrentTickIndexShiftedFromMidRange,

    #[msg("Tick index is either lower than -443636 or higher than 443636")]
    TickIndexOverflow,

    #[msg("Unable to down cast number")]
    NumberDownCastError,

    #[msg("Input quote amount is too high")]
    BaseTokenOverflow,
}
