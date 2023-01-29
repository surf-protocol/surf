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
	tokenMintA: PublicKey
	tokenVaultA: PublicKey
	tokenMintB: PublicKey
	tokenVaultB: PublicKey
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
	driftSubaccountId: number
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
		.initializeVault(
			args.driftSubaccountId,
			args.fullTickRange,
			args.vaultTickRange,
			args.hedgeTickRange,
		)
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
	tickLowerIndex: number
	tickUpperIndex: number
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
		.openWhirlpoolPosition(args.positionBump, args.tickLowerIndex, args.tickUpperIndex)
		.accountsStrict(accounts)
		.instruction()
	return ix
}

// ----------
// deposit
// ----------

export type DepositIxAccounts = {
	payer: PublicKey
	payerBaseTokenAccount: PublicKey
	payerQuoteTokenAccount: PublicKey
	adminConfig: PublicKey
	prepareSwapWhirlpool: PublicKey
	prepareSwapWhirlpoolBaseTokenVault: PublicKey
	prepareSwapWhirlpoolQuoteTokenVault: PublicKey
	prepareSwapTickArray0: PublicKey
	prepareSwapTickArray1: PublicKey
	prepareSwapTickArray2: PublicKey
	prepareSwapOracle: PublicKey
	vault: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	whirlpoolPosition: PublicKey
	whirlpoolPositionTokenAccount: PublicKey
	whirlpoolPositionTickArrayLower: PublicKey
	whirlpoolPositionTickArrayUpper: PublicKey
	whirlpool: PublicKey
	whirlpoolBaseTokenVault: PublicKey
	whirlpoolQuoteTokenVault: PublicKey
	driftState: PublicKey
	driftSigner: PublicKey
	driftQuoteSpotMarketVault: PublicKey
	driftBaseSpotMarketVault: PublicKey
	driftBaseTokenOracle: PublicKey
	driftBaseSpotMarket: PublicKey
	driftQuoteSpotMarket: PublicKey
	driftStats: PublicKey
	driftSubaccount: PublicKey
	whirlpoolProgram: PublicKey
	driftProgram: PublicKey
	tokenProgram: PublicKey
	systemProgram: PublicKey
}

export type DepositIxArgs = {
	inputQuoteAmount: BN
}

export type DepositIxParams = {
	accounts: DepositIxAccounts
	args: DepositIxArgs
}

export const buildDepositIx = async (
	program: Program<SurfIDL>,
	{ accounts, args }: DepositIxParams,
) => {
	const ix = await program.methods
		.deposit(args.inputQuoteAmount)
		.accountsStrict(accounts)
		.instruction()
	return ix
}
