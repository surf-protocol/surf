import { PublicKey } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import BN from 'bn.js'

import { SurfIDL } from './surf-idl.js'

// ----------
// initializeAdminConfig
// ----------

export type InitializeAdminConfigIxAccounts = {
	adminConfig: PublicKey
	admin: PublicKey
	systemProgram: PublicKey
}

export type InitializeAdminConfigIxParams = {
	accounts: InitializeAdminConfigIxAccounts
}

export const buildInitializeAdminConfigIx = async (
	program: Program<SurfIDL>,
	{ accounts }: InitializeAdminConfigIxParams,
) => {
	const ix = await program.methods.initializeAdminConfig().accountsStrict(accounts).instruction()
	return ix
}

// ----------
// initializeVaultState
// ----------

export type InitializeVaultStateIxAccounts = {
	admin: PublicKey
	adminConfig: PublicKey
	whirlpool: PublicKey
	baseTokenMint: PublicKey
	quoteTokenMint: PublicKey
	vaultState: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	driftState: PublicKey
	driftStats: PublicKey
	driftSubaccount: PublicKey
	driftProgram: PublicKey
	systemProgram: PublicKey
	tokenProgram: PublicKey
	associatedTokenProgram: PublicKey
	rent: PublicKey
}

export type InitializeVaultStateIxArgs = {
	fullTickRange: number
	vaultTickRange: number
	hedgeTickRange: number
}

export type InitializeVaultStateIxParams = {
	accounts: InitializeVaultStateIxAccounts
	args: InitializeVaultStateIxArgs
}

export const buildInitializeVaultStateIx = async (
	program: Program<SurfIDL>,
	{ accounts, args }: InitializeVaultStateIxParams,
) => {
	const ix = await program.methods
		.initializeVaultState(args.fullTickRange, args.vaultTickRange, args.hedgeTickRange)
		.accountsStrict(accounts)
		.instruction()
	return ix
}

// ----------
// openWhirlpoolPosition
// ----------

export type OpenWhirlpoolPositionIxAccounts = {
	payer: PublicKey
	vaultState: PublicKey
	vaultWhirlpoolPosition: PublicKey
	whirlpool: PublicKey
	whirlpoolPosition: PublicKey
	whirlpoolPositionMint: PublicKey
	whirlpoolPositionTokenAccount: PublicKey
	whirlpoolProgram: PublicKey
	systemProgram: PublicKey
	tokenProgram: PublicKey
	associatedTokenProgram: PublicKey
	rent: PublicKey
}

export type OpenWhirlpoolPositionIxArgs = {
	positionBump: number
}

export type OpenWhirlpoolPositionIxParams = {
	accounts: OpenWhirlpoolPositionIxAccounts
	args: OpenWhirlpoolPositionIxArgs
}

export const buildOpenWhirlpoolPositionIx = async (
	program: Program<SurfIDL>,
	{ accounts, args }: OpenWhirlpoolPositionIxParams,
) => {
	const ix = await program.methods
		.openWhirlpoolPosition(args.positionBump)
		.accountsStrict(accounts)
		.instruction()
	return ix
}

// ----------
// openHedgePosition
// ----------

export type OpenHedgePositionIxAccounts = {
	payer: PublicKey
	vaultState: PublicKey
	vaultHedgePosition: PublicKey
	systemProgram: PublicKey
}

export type OpenHedgePositionIxParams = {
	accounts: OpenHedgePositionIxAccounts
}

export const buildOpenHedgePositionIx = async (
	program: Program<SurfIDL>,
	{ accounts }: OpenHedgePositionIxParams,
) => {
	const ix = await program.methods.openHedgePosition().accountsStrict(accounts).instruction()
	return ix
}

// ----------
// syncWhirlpoolPosition
// ----------

export type SyncWhirlpoolPositionIxAccounts = {
	vaultState: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	vaultWhirlpoolPosition: PublicKey
	whirlpool: PublicKey
	whirlpoolBaseTokenVault: PublicKey
	whirlpoolQuoteTokenVault: PublicKey
	whirlpoolPosition: PublicKey
	whirlpoolPositionTokenAccount: PublicKey
	tickArrayLower: PublicKey
	tickArrayUpper: PublicKey
	whirlpoolProgram: PublicKey
	tokenProgram: PublicKey
}

export type SyncWhirlpoolPositionIxParams = {
	accounts: SyncWhirlpoolPositionIxAccounts
}

export const buildSyncWhirlpoolPositionIx = async (
	program: Program<SurfIDL>,
	{ accounts }: SyncWhirlpoolPositionIxParams,
) => {
	const ix = await program.methods.syncWhirlpoolPosition().accountsStrict(accounts).instruction()
	return ix
}

// ----------
// increaseLiquidity
// ----------

export type IncreaseLiquidityIxAccounts = {
	owner: PublicKey
	ownerBaseTokenAccount: PublicKey
	ownerQuoteTokenAccount: PublicKey
	userPosition: PublicKey
	vaultState: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	vaultWhirlpoolPosition: PublicKey
	whirlpoolPosition: PublicKey
	whirlpoolPositionTokenAccount: PublicKey
	whirlpool: PublicKey
	whirlpoolBaseTokenAccount: PublicKey
	whirlpoolQuoteTokenAccount: PublicKey
	tickArrayLower: PublicKey
	tickArrayUpper: PublicKey
	whirlpoolProgram: PublicKey
	tokenProgram: PublicKey
}

export type IncreaseLiquidityIxArgs = {
	liquidityInput: BN
	baseTokenMax: BN
	quoteTokenMax: BN
}

export type IncreaseLiquidityIxParams = {
	accounts: IncreaseLiquidityIxAccounts
	args: IncreaseLiquidityIxArgs
}

export const buildIncreaseLiquidityIx = async (
	program: Program<SurfIDL>,
	{ accounts, args }: IncreaseLiquidityIxParams,
) => {
	const ix = await program.methods
		.increaseLiquidity(args.liquidityInput, args.baseTokenMax, args.quoteTokenMax)
		.accountsStrict(accounts)
		.instruction()
	return ix
}

// ----------
// decreaseLiquidity
// ----------

export type DecreaseLiquidityIxAccounts = {
	owner: PublicKey
	ownerBaseTokenAccount: PublicKey
	ownerQuoteTokenAccount: PublicKey
	userPosition: PublicKey
	vaultState: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	vaultWhirlpoolPosition: PublicKey
	whirlpool: PublicKey
	whirlpoolBaseTokenVault: PublicKey
	whirlpoolQuoteTokenVault: PublicKey
	whirlpoolPosition: PublicKey
	whirlpoolPositionTokenAccount: PublicKey
	tickArrayLower: PublicKey
	tickArrayUpper: PublicKey
	whirlpoolProgram: PublicKey
	tokenProgram: PublicKey
}

export type DecreaseLiquidityIxArgs = {
	liquidity: BN
}

export type DecreaseLiquidityIxParams = {
	accounts: DecreaseLiquidityIxAccounts
	args: DecreaseLiquidityIxArgs
}

export const buildDecreaseLiquidityIx = async (
	program: Program<SurfIDL>,
	{ accounts, args }: DecreaseLiquidityIxParams,
) => {
	const ix = await program.methods
		.decreaseLiquidity(args.liquidity)
		.accountsStrict(accounts)
		.instruction()
	return ix
}

// ----------
// increaseLiquidityHedge
// ----------

export type IncreaseLiquidityHedgeIxAccounts = {
	owner: PublicKey
	ownerQuoteTokenAccount: PublicKey
	userPosition: PublicKey
	whirlpool: PublicKey
	vaultState: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	vaultWhirlpoolPosition: PublicKey
	vaultHedgePosition: PublicKey
	driftSigner: PublicKey
	driftState: PublicKey
	driftStats: PublicKey
	driftSubaccount: PublicKey
	driftBaseTokenOracle: PublicKey
	driftQuoteTokenOracle: PublicKey
	driftBorrowVault: PublicKey
	driftBorrowSpotMarket: PublicKey
	driftCollateralVault: PublicKey
	driftCollateralSpotMarket: PublicKey
	swapWhirlpool: PublicKey
	swapWhirlpoolBaseTokenVault: PublicKey
	swapWhirlpoolQuoteTokenVault: PublicKey
	swapTickArray0: PublicKey
	swapTickArray1: PublicKey
	swapTickArray2: PublicKey
	swapOracle: PublicKey
	driftProgram: PublicKey
	whirlpoolProgram: PublicKey
	tokenProgram: PublicKey
}

export type IncreaseLiquidityHedgeIxArgs = {
	borrowAmount: BN
}

export type IncreaseLiquidityHedgeIxParams = {
	accounts: IncreaseLiquidityHedgeIxAccounts
	args: IncreaseLiquidityHedgeIxArgs
}

export const buildIncreaseLiquidityHedgeIx = async (
	program: Program<SurfIDL>,
	{ accounts, args }: IncreaseLiquidityHedgeIxParams,
) => {
	const ix = await program.methods
		.increaseLiquidityHedge(args.borrowAmount)
		.accountsStrict(accounts)
		.instruction()
	return ix
}

// ----------
// decreaseLiquidityHedge
// ----------

export type DecreaseLiquidityHedgeIxAccounts = {
	owner: PublicKey
	ownerBaseTokenAccount: PublicKey
	ownerQuoteTokenAccount: PublicKey
	vaultState: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	userPosition: PublicKey
	hedgePosition: PublicKey
	driftSigner: PublicKey
	driftState: PublicKey
	driftSubaccount: PublicKey
	driftStats: PublicKey
	driftBorrowVault: PublicKey
	driftBorrowSpotMarket: PublicKey
	driftCollateralVault: PublicKey
	driftCollateralSpotMarket: PublicKey
	driftBaseTokenOracle: PublicKey
	driftQuoteTokenOracle: PublicKey
	swapWhirlpool: PublicKey
	swapWhirlpoolBaseTokenVault: PublicKey
	swapWhirlpoolQuoteTokenVault: PublicKey
	swapOracle: PublicKey
	swapTickArray0: PublicKey
	swapTickArray1: PublicKey
	swapTickArray2: PublicKey
	driftProgram: PublicKey
	whirlpoolProgram: PublicKey
	tokenProgram: PublicKey
}

export type DecreaseLiquidityHedgeIxArgs = {
	borrowAmount: BN
}

export type DecreaseLiquidityHedgeIxParams = {
	accounts: DecreaseLiquidityHedgeIxAccounts
	args: DecreaseLiquidityHedgeIxArgs
}

export const buildDecreaseLiquidityHedgeIx = async (
	program: Program<SurfIDL>,
	{ accounts, args }: DecreaseLiquidityHedgeIxParams,
) => {
	const ix = await program.methods
		.decreaseLiquidityHedge(args.borrowAmount)
		.accountsStrict(accounts)
		.instruction()
	return ix
}

// ----------
// syncUserWhirlpoolPosition
// ----------

export type SyncUserWhirlpoolPositionIxAccounts = {
	owner: PublicKey
	userPosition: PublicKey
	vaultState: PublicKey
}

export type SyncUserWhirlpoolPositionIxParams = {
	accounts: SyncUserWhirlpoolPositionIxAccounts
}

export const buildSyncUserWhirlpoolPositionIx = async (
	program: Program<SurfIDL>,
	{ accounts }: SyncUserWhirlpoolPositionIxParams,
) => {
	const ix = await program.methods
		.syncUserWhirlpoolPosition()
		.accountsStrict(accounts)
		.instruction()
	return ix
}

// ----------
// syncUserHedgePosition
// ----------

export type SyncUserHedgePositionIxAccounts = {
	owner: PublicKey
	userPosition: PublicKey
	vaultState: PublicKey
}

export type SyncUserHedgePositionIxParams = {
	accounts: SyncUserHedgePositionIxAccounts
}

export const buildSyncUserHedgePositionIx = async (
	program: Program<SurfIDL>,
	{ accounts }: SyncUserHedgePositionIxParams,
) => {
	const ix = await program.methods.syncUserHedgePosition().accountsStrict(accounts).instruction()
	return ix
}

// ----------
// collectUserFeesAndRewards
// ----------

export type CollectUserFeesAndRewardsIxAccounts = {
	owner: PublicKey
	ownerBaseTokenAccount: PublicKey
	ownerQuoteTokenAccount: PublicKey
	vaultState: PublicKey
	whirlpool: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	userPosition: PublicKey
	tokenProgram: PublicKey
}

export type CollectUserFeesAndRewardsIxParams = {
	accounts: CollectUserFeesAndRewardsIxAccounts
}

export const buildCollectUserFeesAndRewardsIx = async (
	program: Program<SurfIDL>,
	{ accounts }: CollectUserFeesAndRewardsIxParams,
) => {
	const ix = await program.methods
		.collectUserFeesAndRewards()
		.accountsStrict(accounts)
		.instruction()
	return ix
}

// ----------
// claimUserBorrowInterest
// ----------

export type ClaimUserBorrowInterestIxAccounts = {
	owner: PublicKey
	ownerBaseTokenAccount: PublicKey
	userPosition: PublicKey
	vaultState: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultHedgePosition: PublicKey
	driftState: PublicKey
	driftStats: PublicKey
	driftSubaccount: PublicKey
	driftBorrowVault: PublicKey
	driftBorrowSpotMarket: PublicKey
	driftBaseTokenOracle: PublicKey
	driftProgram: PublicKey
	tokenProgram: PublicKey
}

export type ClaimUserBorrowInterestIxParams = {
	accounts: ClaimUserBorrowInterestIxAccounts
}

export const buildClaimUserBorrowInterestIx = async (
	program: Program<SurfIDL>,
	{ accounts }: ClaimUserBorrowInterestIxParams,
) => {
	const ix = await program.methods
		.claimUserBorrowInterest()
		.accountsStrict(accounts)
		.instruction()
	return ix
}

// ----------
// claimUserCollateralInterest
// ----------

export type ClaimUserCollateralInterestIxAccounts = {
	owner: PublicKey
	ownerQuoteTokenAccount: PublicKey
	userPosition: PublicKey
	vaultState: PublicKey
	vaultQuoteTokenAccount: PublicKey
	driftState: PublicKey
	driftSigner: PublicKey
	driftStats: PublicKey
	driftSubaccount: PublicKey
	driftCollateralVault: PublicKey
	driftCollateralSpotMarket: PublicKey
	driftBorrowSpotMarket: PublicKey
	driftQuoteTokenOracle: PublicKey
	driftProgram: PublicKey
	tokenProgram: PublicKey
}

export type ClaimUserCollateralInterestIxParams = {
	accounts: ClaimUserCollateralInterestIxAccounts
}

export const buildClaimUserCollateralInterestIx = async (
	program: Program<SurfIDL>,
	{ accounts }: ClaimUserCollateralInterestIxParams,
) => {
	const ix = await program.methods
		.claimUserCollateralInterest()
		.accountsStrict(accounts)
		.instruction()
	return ix
}

// ----------
// adjustVaultHedgeAbove
// ----------

export type AdjustVaultHedgeAboveIxAccounts = {
	whirlpool: PublicKey
	vaultState: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	vaultWhirlpoolPosition: PublicKey
	currentVaultHedgePosition: PublicKey
	nextVaultHedgePosition: PublicKey
	swapWhirlpool: PublicKey
	swapWhirlpoolBaseTokenVault: PublicKey
	swapWhirlpoolQuoteTokenVault: PublicKey
	swapTickArray0: PublicKey
	swapTickArray1: PublicKey
	swapTickArray2: PublicKey
	swapOracle: PublicKey
	driftState: PublicKey
	driftStats: PublicKey
	driftSubaccount: PublicKey
	driftBorrowVault: PublicKey
	driftBorrowSpotMarket: PublicKey
	driftBaseTokenOracle: PublicKey
	driftProgram: PublicKey
	whirlpoolProgram: PublicKey
	tokenProgram: PublicKey
}

export type AdjustVaultHedgeAboveIxParams = {
	accounts: AdjustVaultHedgeAboveIxAccounts
}

export const buildAdjustVaultHedgeAboveIx = async (
	program: Program<SurfIDL>,
	{ accounts }: AdjustVaultHedgeAboveIxParams,
) => {
	const ix = await program.methods.adjustVaultHedgeAbove().accountsStrict(accounts).instruction()
	return ix
}

// ----------
// adjustVaultHedgeBelow
// ----------

export type AdjustVaultHedgeBelowIxAccounts = {
	whirlpool: PublicKey
	vaultState: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	vaultWhirlpoolPosition: PublicKey
	currentVaultHedgePosition: PublicKey
	nextVaultHedgePosition: PublicKey
	driftSigner: PublicKey
	driftState: PublicKey
	driftStats: PublicKey
	driftSubaccount: PublicKey
	driftBorrowVault: PublicKey
	driftBorrowSpotMarket: PublicKey
	driftCollateralSpotMarket: PublicKey
	driftBaseTokenOracle: PublicKey
	swapWhirlpool: PublicKey
	swapWhirlpoolBaseTokenVault: PublicKey
	swapWhirlpoolQuoteTokenVault: PublicKey
	swapTickArray0: PublicKey
	swapTickArray1: PublicKey
	swapTickArray2: PublicKey
	swapOracle: PublicKey
	driftProgram: PublicKey
	whirlpoolProgram: PublicKey
	tokenProgram: PublicKey
}

export type AdjustVaultHedgeBelowIxParams = {
	accounts: AdjustVaultHedgeBelowIxAccounts
}

export const buildAdjustVaultHedgeBelowIx = async (
	program: Program<SurfIDL>,
	{ accounts }: AdjustVaultHedgeBelowIxParams,
) => {
	const ix = await program.methods.adjustVaultHedgeBelow().accountsStrict(accounts).instruction()
	return ix
}

// ----------
// adjustWhirlpoolPosition
// ----------

export type AdjustWhirlpoolPositionIxAccounts = {
	payer: PublicKey
	vaultState: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	vaultWhirlpoolPosition: PublicKey
	whirlpoolPosition: PublicKey
	whirlpoolPositionTokenAccount: PublicKey
	positionTickArrayLower: PublicKey
	positionTickArrayUpper: PublicKey
	nextVaultWhirlpoolPosition: PublicKey
	nextWhirlpoolPosition: PublicKey
	nextWhirlpoolPositionTokenAccount: PublicKey
	nextWhirlpoolPositionMint: PublicKey
	nextPositionTickArrayLower: PublicKey
	nextPositionTickArrayUpper: PublicKey
	whirlpool: PublicKey
	whirlpoolBaseTokenVault: PublicKey
	whirlpoolQuoteTokenVault: PublicKey
	swapWhirlpool: PublicKey
	swapWhirlpoolBaseTokenVault: PublicKey
	swapWhirlpoolQuoteTokenVault: PublicKey
	swapWhirlpoolOracle: PublicKey
	swapTickArray0: PublicKey
	swapTickArray1: PublicKey
	swapTickArray2: PublicKey
	whirlpoolProgram: PublicKey
	tokenProgram: PublicKey
	systemProgram: PublicKey
	associatedTokenProgram: PublicKey
	rent: PublicKey
}

export type AdjustWhirlpoolPositionIxArgs = {
	nextPositionBump: number
}

export type AdjustWhirlpoolPositionIxParams = {
	accounts: AdjustWhirlpoolPositionIxAccounts
	args: AdjustWhirlpoolPositionIxArgs
}

export const buildAdjustWhirlpoolPositionIx = async (
	program: Program<SurfIDL>,
	{ accounts, args }: AdjustWhirlpoolPositionIxParams,
) => {
	const ix = await program.methods
		.adjustWhirlpoolPosition(args.nextPositionBump)
		.accountsStrict(accounts)
		.instruction()
	return ix
}
