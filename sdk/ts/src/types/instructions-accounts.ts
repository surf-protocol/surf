import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

// ----------
// initializeAdminConfig
// ----------

export type initializeAdminConfigIxAccounts = {
	adminConfig: PublicKey
	admin: PublicKey
	systemProgram: PublicKey
}

// ----------
// initializeVault
// ----------

export type initializeVaultIxAccounts = {
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

export type initializeVaultIxArgs = {
	driftSubaccountId: number
	fullTickRange: number
	vaultTickRange: number
	hedgeTickRange: number
}

// ----------
// openWhirlpoolPosition
// ----------

export type openWhirlpoolPositionIxAccounts = {
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

export type openWhirlpoolPositionIxArgs = {
	positionBump: number
	tickLowerIndex: number
	tickUpperIndex: number
}

// ----------
// deposit
// ----------

export type depositIxAccounts = {
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

export type depositIxArgs = {
	inputQuoteAmount: BN
}
