use anchor_lang::prelude::*;

// TODO: Comments with hex values
#[error_code]
pub enum SurfError {
    #[msg("")]
    CustomError,

    #[msg("admin account key does not correspond with admin_config admin_key")]
    InvalidAdmin,

    #[msg("Quote token mint has to be USDC")]
    InvalidQuoteTokenMint,

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

    #[msg("Position can not be open on inactive vault")]
    PositionCanNotBeOpen,
    #[msg("Position is already open")]
    PositionAlreadyOpen,
    #[msg("Invalid vault position id")]
    InvalidVaultPositionId,
    #[msg("Lower tick index is lower than -443636")]
    LowerTickIndexOutOfBounds,
    #[msg("Upper tick index is higher than 443636")]
    UpperTickIndexOutOfBounds,

    #[msg("Deposit amount is higher than max amount allowed")]
    SlippageExceeded,
    #[msg("Token mints of whirlpools are not matching")]
    WhirlpoolMintsNotMatching,
    #[msg("Whirlpool does not correspond to vault whirlpool")]
    InvalidWhirlpool,
    #[msg("Whirlpool position does not correspond to vault whirlpool position")]
    InvalidWhirlpoolPosition,

    #[msg("Position is not synce to current state, call sync_user_position first")]
    PositionNotSynced,
    #[msg("Whirlpool position is not open")]
    PositionNotOpen,
    #[msg("User position is already hedged")]
    PositionAlreadyHedged,

    #[msg("Can not update user position without providing previous vault positions")]
    MissingPreviousVaultPositions,

    // Math
    #[msg("Input quote amount is too high")]
    BaseTokenOverflow,
    #[msg("Liquidity diff is too high")]
    LiquidityDiffTooHigh,

    // Whirlpool errors
    // https://github.com/orca-so/whirlpools/blob/main/programs/whirlpool/src/errors.rs
    #[msg("Exceeded token max")]
    TokenMaxExceeded,
    #[msg("Unable to down cast number")]
    NumberDownCastError,
    #[msg("Multiplication overflow")]
    MultiplicationOverflow,
    #[msg("Multiplication with shift right overflow")]
    MultiplicationShiftRightOverflow,
}
