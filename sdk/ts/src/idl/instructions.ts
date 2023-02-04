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
// initializeVault
// ----------

export type InitializeVaultIxAccounts = {
	admin: PublicKey
	adminConfig: PublicKey
	whirlpool: PublicKey
	vault: PublicKey
	baseTokenMint: PublicKey
	quoteTokenMint: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	driftStats: PublicKey
	driftSubaccount: PublicKey
	driftState: PublicKey
	whirlpoolProgram: PublicKey
	driftProgram: PublicKey
	systemProgram: PublicKey
	tokenProgram: PublicKey
	associatedTokenProgram: PublicKey
	rent: PublicKey
}

export type InitializeVaultIxArgs = {
	fullTickRange: number
	vaultTickRange: number
	hedgeTickRange: number
}

export type InitializeVaultIxParams = {
	accounts: InitializeVaultIxAccounts
	args: InitializeVaultIxArgs
}

export const buildInitializeVaultIx = async (
	program: Program<SurfIDL>,
	{ accounts, args }: InitializeVaultIxParams,
) => {
	const ix = await program.methods
		.initializeVault(args.fullTickRange, args.vaultTickRange, args.hedgeTickRange)
		.accountsStrict(accounts)
		.instruction()
	return ix
}

// ----------
// openWhirlpoolPosition
// ----------

export type OpenWhirlpoolPositionIxAccounts = {
	payer: PublicKey
	whirlpool: PublicKey
	vault: PublicKey
	whirlpoolPosition: PublicKey
	whirlpoolPositionMint: PublicKey
	whirlpoolPositionTokenAccount: PublicKey
	whirlpoolProgram: PublicKey
	tokenProgram: PublicKey
	systemProgram: PublicKey
	rent: PublicKey
	associatedTokenProgram: PublicKey
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
// depositLiquidity
// ----------

export type DepositLiquidityIxAccounts = {
	payer: PublicKey
	payerBaseTokenAccount: PublicKey
	payerQuoteTokenAccount: PublicKey
	vault: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	userPosition: PublicKey
	prepareSwapWhirlpool: PublicKey
	prepareSwapWhirlpoolBaseTokenVault: PublicKey
	prepareSwapWhirlpoolQuoteTokenVault: PublicKey
	prepareSwapTickArray0: PublicKey
	prepareSwapTickArray1: PublicKey
	prepareSwapTickArray2: PublicKey
	prepareSwapOracle: PublicKey
	whirlpoolPosition: PublicKey
	whirlpoolPositionTokenAccount: PublicKey
	whirlpoolPositionTickArrayLower: PublicKey
	whirlpoolPositionTickArrayUpper: PublicKey
	whirlpool: PublicKey
	whirlpoolBaseTokenVault: PublicKey
	whirlpoolQuoteTokenVault: PublicKey
	whirlpoolProgram: PublicKey
	tokenProgram: PublicKey
	systemProgram: PublicKey
}

export type DepositLiquidityIxArgs = {
	whirlpoolDepositQuoteAmount: BN
	whirlpoolDepositQuoteAmountMax: BN
}

export type DepositLiquidityIxParams = {
	accounts: DepositLiquidityIxAccounts
	args: DepositLiquidityIxArgs
}

export const buildDepositLiquidityIx = async (
	program: Program<SurfIDL>,
	{ accounts, args }: DepositLiquidityIxParams,
) => {
	const ix = await program.methods
		.depositLiquidity(args.whirlpoolDepositQuoteAmount, args.whirlpoolDepositQuoteAmountMax)
		.accountsStrict(accounts)
		.instruction()
	return ix
}

// ----------
// hedgeLiquidity
// ----------

export type HedgeLiquidityIxAccounts = {
	payer: PublicKey
	payerBaseTokenAccount: PublicKey
	payerQuoteTokenAccount: PublicKey
	userPosition: PublicKey
	vault: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	whirlpool: PublicKey
	whirlpoolPosition: PublicKey
	driftState: PublicKey
	driftSigner: PublicKey
	driftQuoteSpotMarketVault: PublicKey
	driftBaseSpotMarketVault: PublicKey
	driftBaseTokenOracle: PublicKey
	driftBaseSpotMarket: PublicKey
	driftQuoteSpotMarket: PublicKey
	driftStats: PublicKey
	driftSubaccount: PublicKey
	hedgeSwapWhirlpool: PublicKey
	hedgeSwapWhirlpoolBaseTokenVault: PublicKey
	hedgeSwapWhirlpoolQuoteTokenVault: PublicKey
	hedgeSwapTickArray0: PublicKey
	hedgeSwapTickArray1: PublicKey
	hedgeSwapTickArray2: PublicKey
	hedgeSwapOracle: PublicKey
	driftProgram: PublicKey
	whirlpoolProgram: PublicKey
	tokenProgram: PublicKey
}

export type HedgeLiquidityIxParams = {
	accounts: HedgeLiquidityIxAccounts
}

export const buildHedgeLiquidityIx = async (
	program: Program<SurfIDL>,
	{ accounts }: HedgeLiquidityIxParams,
) => {
	const ix = await program.methods.hedgeLiquidity().accountsStrict(accounts).instruction()
	return ix
}
