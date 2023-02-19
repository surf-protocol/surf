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

    #[msg("Hedge position id overflow")]
    HedgePositionIdOverflow,

    #[msg("Position can not be open on inactive vault")]
    UserPositionCanNotBeOpen,
    #[msg("Vault position is already fully hedged")]
    UserPositionAlreadyHedged,
    #[msg("Position is not synced to current state, call sync_user_position first")]
    UserPositionNotSynced,

    #[msg("Can not adjust hedge of position with 0 hedged liquidity")]
    VaultPositionNotHedged,
    #[msg("Position is already open")]
    VaultPositionAlreadyOpen,
    #[msg("Provided vault position is not opened")]
    VaultPositionNotOpened,
    #[msg("Vault position fees are not updated, call collect_vault_fees")]
    VaultPositionNotUpdated,
    #[msg("Can not update user position without providing previous vault positions")]
    MissingPreviousVaultPositions,

    #[msg("Collateral interest overflow")]
    CollateralInterestOverflow,
    #[msg("Borrow interest overflow")]
    BorrowInterestOverflow,

    // Math
    #[msg("Input quote amount is too high")]
    BaseTokenOverflow,
    #[msg("Liquidity overflow")]
    LiquidityOverflow,
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

    // Drift Errors
    #[msg("Drift math error")]
    MathError,
}
