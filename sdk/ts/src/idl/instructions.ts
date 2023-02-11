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
// openVaultPosition
// ----------

export type OpenVaultPositionIxAccounts = {
	payer: PublicKey
	whirlpool: PublicKey
	vault: PublicKey
	vaultPosition: PublicKey
	whirlpoolPosition: PublicKey
	whirlpoolPositionMint: PublicKey
	whirlpoolPositionTokenAccount: PublicKey
	whirlpoolProgram: PublicKey
	tokenProgram: PublicKey
	systemProgram: PublicKey
	rent: PublicKey
	associatedTokenProgram: PublicKey
}

export type OpenVaultPositionIxArgs = {
	positionBump: number
}

export type OpenVaultPositionIxParams = {
	accounts: OpenVaultPositionIxAccounts
	args: OpenVaultPositionIxArgs
}

export const buildOpenVaultPositionIx = async (
	program: Program<SurfIDL>,
	{ accounts, args }: OpenVaultPositionIxParams,
) => {
	const ix = await program.methods
		.openVaultPosition(args.positionBump)
		.accountsStrict(accounts)
		.instruction()
	return ix
}

// ----------
// collectVaultFees
// ----------

export type CollectVaultFeesIxAccounts = {
	payer: PublicKey
	whirlpool: PublicKey
	whirlpoolBaseTokenVault: PublicKey
	whirlpoolQuoteTokenVault: PublicKey
	tickArrayLower: PublicKey
	tickArrayUpper: PublicKey
	whirlpoolPosition: PublicKey
	whirlpoolPositionTokenAccount: PublicKey
	vault: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	vaultPosition: PublicKey
	whirlpoolProgram: PublicKey
	tokenProgram: PublicKey
}

export type CollectVaultFeesIxParams = {
	accounts: CollectVaultFeesIxAccounts
}

export const buildCollectVaultFeesIx = async (
	program: Program<SurfIDL>,
	{ accounts }: CollectVaultFeesIxParams,
) => {
	const ix = await program.methods.collectVaultFees().accountsStrict(accounts).instruction()
	return ix
}

// ----------
// openUserPosition
// ----------

export type OpenUserPositionIxAccounts = {
	positionAuthority: PublicKey
	whirlpool: PublicKey
	vault: PublicKey
	vaultPosition: PublicKey
	userPosition: PublicKey
	systemProgram: PublicKey
}

export type OpenUserPositionIxParams = {
	accounts: OpenUserPositionIxAccounts
}

export const buildOpenUserPositionIx = async (
	program: Program<SurfIDL>,
	{ accounts }: OpenUserPositionIxParams,
) => {
	const ix = await program.methods.openUserPosition().accountsStrict(accounts).instruction()
	return ix
}

// ----------
// syncUserPosition
// ----------

export type SyncUserPositionIxAccounts = {
	authority: PublicKey
	vault: PublicKey
	userPosition: PublicKey
	currentVaultPosition: PublicKey
}

export type SyncUserPositionIxParams = {
	accounts: SyncUserPositionIxAccounts
}

export const buildSyncUserPositionIx = async (
	program: Program<SurfIDL>,
	{ accounts }: SyncUserPositionIxParams,
) => {
	const ix = await program.methods.syncUserPosition().accountsStrict(accounts).instruction()
	return ix
}

// ----------
// collectUserFees
// ----------

export type CollectUserFeesIxAccounts = {
	authority: PublicKey
	authorityBaseTokenAccount: PublicKey
	authorityQuoteTokenAccount: PublicKey
	vault: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	userPosition: PublicKey
	tokenProgram: PublicKey
}

export type CollectUserFeesIxParams = {
	accounts: CollectUserFeesIxAccounts
}

export const buildCollectUserFeesIx = async (
	program: Program<SurfIDL>,
	{ accounts }: CollectUserFeesIxParams,
) => {
	const ix = await program.methods.collectUserFees().accountsStrict(accounts).instruction()
	return ix
}

// ----------
// depositLiquidity
// ----------

export type DepositLiquidityIxAccounts = {
	payer: PublicKey
	payerBaseTokenAccount: PublicKey
	payerQuoteTokenAccount: PublicKey
	userPosition: PublicKey
	vaultPosition: PublicKey
	vault: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	whirlpoolPosition: PublicKey
	whirlpoolPositionTokenAccount: PublicKey
	whirlpool: PublicKey
	tickArrayLower: PublicKey
	tickArrayUpper: PublicKey
	swapWhirlpool: PublicKey
	swapWhirlpoolBaseTokenAccount: PublicKey
	swapWhirlpoolQuoteTokenAccount: PublicKey
	tickArray0: PublicKey
	tickArray1: PublicKey
	tickArray2: PublicKey
	swapOracle: PublicKey
	whirlpoolProgram: PublicKey
	tokenProgram: PublicKey
}

export type DepositLiquidityIxArgs = {
	liquidityInput: BN
	depositQuoteInputMax: BN
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
		.depositLiquidity(args.liquidityInput, args.depositQuoteInputMax)
		.accountsStrict(accounts)
		.instruction()
	return ix
}
