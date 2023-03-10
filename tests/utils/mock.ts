import { Percentage } from '@orca-so/common-sdk'
import {
	increaseLiquidityQuoteByInputTokenWithParams,
	ORCA_WHIRLPOOL_PROGRAM_ID,
	WhirlpoolData,
} from '@orca-so/whirlpools-sdk'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { ComputeBudgetProgram, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import BN from 'bn.js'

import { DRIFT_PROGRAM_ID_MAINNET } from '../../sdk/ts/src/constants'
import {
	getFullRangeBoundaries,
	getTickArraysAddresses,
	buildInitializeAdminConfigIx,
	buildInitializeVaultStateIx,
	buildOpenHedgePositionIx,
	buildOpenUserPositionIx,
	buildOpenWhirlpoolPositionIx,
	buildIncreaseLiquidityIx,
	getAdminConfigAddress,
	getHedgePositionAddress,
	getUserPositionAddress,
	getVaultStateDriftAccountsAddresses,
	getVaultStateAddress,
	getVaultStateTokenAccountsAddresses,
	getVaultWhirlpoolPositionAddress,
	getWhirlpoolPositionAccountsAddresses,
	buildIncreaseLiquidityHedgeIx,
} from '../../sdk/ts/src'
import { driftOracleAddress, driftSignerAddress, driftStateAddress } from './cpi/drift'
import { connection, surfProgram, wallet } from './load-config'
import { baseTokenUserATA, baseTokenMint, quoteTokenUserATA, quoteTokenMint } from './mint'
import { buildAndSendTx } from './transaction'

export const mockAdminConfig = async () => {
	const [adminConfigPDA] = getAdminConfigAddress()
	const initAdminConfigIx = await buildInitializeAdminConfigIx(surfProgram, {
		accounts: {
			adminConfig: adminConfigPDA,
			admin: wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	})
	await buildAndSendTx(connection, [wallet], [initAdminConfigIx])
	return adminConfigPDA
}

type MockVaultAccounts = {
	whirlpoolAddress: PublicKey
	adminConfigAddress: PublicKey
}

type MockVaultParams = {
	fullTickRange?: number
	vaultTickRange?: number
	hedgeTickRange?: number
}

export const mockVaultState = async (
	{ whirlpoolAddress, adminConfigAddress }: MockVaultAccounts,
	{ fullTickRange = 800, vaultTickRange = 400, hedgeTickRange = 20 }: MockVaultParams = {
		fullTickRange: 800,
		vaultTickRange: 400,
		hedgeTickRange: 20,
	},
) => {
	const [vaultStateAddress] = getVaultStateAddress(whirlpoolAddress)
	const [vaultBaseTokenAccountAddress, vaultQuoteTokenAccountAddress] =
		getVaultStateTokenAccountsAddresses(vaultStateAddress, baseTokenMint, quoteTokenMint)
	const { driftStatsAddress, driftSubaccountAddress } =
		getVaultStateDriftAccountsAddresses(vaultStateAddress)

	const initVaultIx = await buildInitializeVaultStateIx(surfProgram, {
		args: {
			fullTickRange,
			vaultTickRange,
			hedgeTickRange,
		},
		accounts: {
			vaultBaseTokenAccount: vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccount: vaultQuoteTokenAccountAddress,
			baseTokenMint,
			quoteTokenMint,
			whirlpool: whirlpoolAddress,

			admin: wallet.publicKey,
			adminConfig: adminConfigAddress,
			vaultState: vaultStateAddress,

			driftState: driftStateAddress,
			driftSubaccount: driftSubaccountAddress,
			driftStats: driftStatsAddress,

			driftProgram: DRIFT_PROGRAM_ID_MAINNET,
			systemProgram: SystemProgram.programId,
			tokenProgram: TOKEN_PROGRAM_ID,
			rent: SYSVAR_RENT_PUBKEY,
			associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
		},
	})

	await buildAndSendTx(connection, [wallet], [initVaultIx])

	return {
		vaultStateAddress,
		vaultBaseTokenAccountAddress,
		vaultQuoteTokenAccountAddress,
		vaultRangeParams: {
			fullTickRange,
			vaultTickRange,
			hedgeTickRange,
		},
		driftStatsAddress,
		driftSubaccountAddress,
	}
}

type MockVaultWhirlpoolPositionParams = {
	vaultStateAddress: PublicKey
	whirlpoolAddress: PublicKey
	id: number
}

export const mockVaultWhirlpoolPosition = async ({
	vaultStateAddress,
	whirlpoolAddress,
	id,
}: MockVaultWhirlpoolPositionParams) => {
	const {
		whirlpoolPositionBump,
		whirlpoolPositionMintKeyPair,
		whirlpoolPositionAddress,
		whirlpoolPositionVaultTokenAccountAddress,
	} = getWhirlpoolPositionAccountsAddresses(vaultStateAddress)
	const [vaultWhirlpoolPositionAddress] = getVaultWhirlpoolPositionAddress(vaultStateAddress, id)

	const ix = await buildOpenWhirlpoolPositionIx(surfProgram, {
		accounts: {
			payer: wallet.publicKey,
			vaultState: vaultStateAddress,

			whirlpool: whirlpoolAddress,
			whirlpoolPositionMint: whirlpoolPositionMintKeyPair.publicKey,
			whirlpoolPosition: whirlpoolPositionAddress,
			whirlpoolPositionTokenAccount: whirlpoolPositionVaultTokenAccountAddress,
			vaultWhirlpoolPosition: vaultWhirlpoolPositionAddress,

			whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
			systemProgram: SystemProgram.programId,
			tokenProgram: TOKEN_PROGRAM_ID,
			associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
			rent: SYSVAR_RENT_PUBKEY,
		},
		args: {
			positionBump: whirlpoolPositionBump,
		},
	})

	const res = await buildAndSendTx(connection, [wallet, whirlpoolPositionMintKeyPair], [ix])

	return {
		res,
		vaultWhirlpoolPositionAddress,
		whirlpoolPositionBump,
		whirlpoolPositionMintKeyPair,
		whirlpoolPositionAddress,
		whirlpoolPositionVaultTokenAccountAddress,
	}
}

type MockHedgePositionParams = {
	vaultStateAddress: PublicKey
	id: number
}

export const mockHedgePosition = async ({ vaultStateAddress, id }: MockHedgePositionParams) => {
	const [hedgePositionAddress] = getHedgePositionAddress(vaultStateAddress, id)
	const ix = await buildOpenHedgePositionIx(surfProgram, {
		accounts: {
			owner: wallet.publicKey,
			vaultHedgePosition: hedgePositionAddress,
			vaultState: vaultStateAddress,
			systemProgram: SystemProgram.programId,
		},
	})
	const res = await buildAndSendTx(connection, [wallet], [ix])
	return { res, hedgePositionAddress }
}

export const mockUserPosition = async (vaultStateAddress: PublicKey) => {
	const [userPositionAddress, userPositionBump] = getUserPositionAddress(
		vaultStateAddress,
		wallet.publicKey,
	)

	const ix = await buildOpenUserPositionIx(surfProgram, {
		accounts: {
			owner: wallet.publicKey,
			userPosition: userPositionAddress,
			vaultState: vaultStateAddress,
			systemProgram: SystemProgram.programId,
		},
	})

	const res = await buildAndSendTx(connection, [wallet], [ix])

	return {
		res,
		userPositionAddress,
		userPositionBump,
	}
}

type MockUserPositionWithLiquidityParams = {
	slippageTolerance: Percentage
	baseTokenAmount: BN
	fullTickRange: number
	whirlpoolData: WhirlpoolData
	whirlpoolAddress: PublicKey
	whirlpoolBaseTokenVaultAddress: PublicKey
	whirlpoolQuoteTokenVaultAddress: PublicKey
	whirlpoolPositionAddress: PublicKey
	whirlpoolPositionVaultTokenAccountAddress: PublicKey
	vaultStateAddress: PublicKey
	vaultBaseTokenAccountAddress: PublicKey
	vaultQuoteTokenAccountAddress: PublicKey
	vaultWhirlpoolPositionAddress: PublicKey
}

export const mockUserPositionWithLiquidity = async ({
	slippageTolerance,
	baseTokenAmount,
	fullTickRange,
	whirlpoolData,
	whirlpoolAddress,
	whirlpoolBaseTokenVaultAddress,
	whirlpoolQuoteTokenVaultAddress,
	whirlpoolPositionAddress,
	whirlpoolPositionVaultTokenAccountAddress,
	vaultStateAddress,
	vaultBaseTokenAccountAddress,
	vaultQuoteTokenAccountAddress,
	vaultWhirlpoolPositionAddress,
}: MockUserPositionWithLiquidityParams) => {
	const { userPositionAddress } = await mockUserPosition(vaultStateAddress)

	const { upperTickInitializable, lowerTickInitializable } = getFullRangeBoundaries(
		fullTickRange,
		whirlpoolData.tickCurrentIndex,
		whirlpoolData.tickSpacing,
	)
	const { upperTickArrayAddress, lowerTickArrayAddress } = getTickArraysAddresses(
		{ upperTickIndex: upperTickInitializable, lowerTickIndex: lowerTickInitializable },
		whirlpoolData.tickSpacing,
		whirlpoolAddress,
	)

	const { tokenMaxA, tokenMaxB, liquidityAmount, tokenEstB } =
		increaseLiquidityQuoteByInputTokenWithParams({
			inputTokenAmount: baseTokenAmount,
			inputTokenMint: baseTokenMint,
			tokenMintA: baseTokenMint,
			tokenMintB: quoteTokenMint,
			tickCurrentIndex: whirlpoolData.tickCurrentIndex,
			sqrtPrice: whirlpoolData.sqrtPrice,
			tickLowerIndex: lowerTickInitializable,
			tickUpperIndex: upperTickInitializable,
			slippageTolerance,
		})

	const ix = await buildIncreaseLiquidityIx(surfProgram, {
		args: {
			liquidityInput: liquidityAmount,
			baseTokenMax: tokenMaxA,
			quoteTokenMax: tokenMaxB,
		},
		accounts: {
			owner: wallet.publicKey,
			ownerBaseTokenAccount: baseTokenUserATA,
			ownerQuoteTokenAccount: quoteTokenUserATA,
			userPosition: userPositionAddress,
			vaultState: vaultStateAddress,
			vaultBaseTokenAccount: vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccount: vaultQuoteTokenAccountAddress,
			vaultWhirlpoolPosition: vaultWhirlpoolPositionAddress,
			whirlpool: whirlpoolAddress,
			whirlpoolBaseTokenAccount: whirlpoolBaseTokenVaultAddress,
			whirlpoolQuoteTokenAccount: whirlpoolQuoteTokenVaultAddress,
			whirlpoolPosition: whirlpoolPositionAddress,
			whirlpoolPositionTokenAccount: whirlpoolPositionVaultTokenAccountAddress,
			tickArrayLower: lowerTickArrayAddress,
			tickArrayUpper: upperTickArrayAddress,
			whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
			tokenProgram: TOKEN_PROGRAM_ID,
		},
	})

	const res = await buildAndSendTx(connection, [wallet], [ix])

	return {
		quoteTokenAmount: tokenEstB,
		liquidityAmount,
		baseTokenAmount,
		upperTickInitializable,
		lowerTickInitializable,
		upperTickArrayAddress,
		lowerTickArrayAddress,
		userPositionAddress,
		res,
	}
}

type MockIncreaseLiquidityHedgeParams = {
	borrowAmount: BN
	userPositionAddress: PublicKey
	vaultStateAddress: PublicKey
	vaultBaseTokenAccountAddress: PublicKey
	vaultQuoteTokenAccountAddress: PublicKey
	hedgePositionAddress: PublicKey
	vaultWhirlpoolPositionAddress: PublicKey
	whirlpoolAddress: PublicKey
	driftStatsAddress: PublicKey
	driftSubaccountAddress: PublicKey
	driftBaseSpotMarketAddress: PublicKey
	driftBaseSpotMarketVaultAddress: PublicKey
	driftQuoteSpotMarketAddress: PublicKey
	driftQuoteSpotMarketVaultAddress: PublicKey
	swapWhirlpoolAddress: PublicKey
	swapWhirlpoolBaseTokenVaultAddress: PublicKey
	swapWhirlpoolQuoteTokenVaultAddress: PublicKey
	swapTickArray0Address: PublicKey
	swapTickArray1Address: PublicKey
	swapTickArray2Address: PublicKey
	swapOracleAddress: PublicKey
}

export const mockIncreaseLiquidityHedge = async ({
	borrowAmount,
	userPositionAddress,
	vaultStateAddress,
	vaultBaseTokenAccountAddress,
	vaultQuoteTokenAccountAddress,
	hedgePositionAddress,
	vaultWhirlpoolPositionAddress,
	whirlpoolAddress,
	driftStatsAddress,
	driftSubaccountAddress,
	driftBaseSpotMarketAddress,
	driftBaseSpotMarketVaultAddress,
	driftQuoteSpotMarketAddress,
	driftQuoteSpotMarketVaultAddress,
	swapWhirlpoolAddress,
	swapWhirlpoolBaseTokenVaultAddress,
	swapWhirlpoolQuoteTokenVaultAddress,
	swapTickArray0Address,
	swapTickArray1Address,
	swapTickArray2Address,
	swapOracleAddress,
}: MockIncreaseLiquidityHedgeParams) => {
	const ix = await buildIncreaseLiquidityHedgeIx(surfProgram, {
		args: {
			borrowAmount: borrowAmount,
		},
		accounts: {
			owner: wallet.publicKey,
			ownerQuoteTokenAccount: quoteTokenUserATA,
			userPosition: userPositionAddress,
			vaultState: vaultStateAddress,
			vaultBaseTokenAccount: vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccount: vaultQuoteTokenAccountAddress,
			vaultHedgePosition: hedgePositionAddress,
			vaultWhirlpoolPosition: vaultWhirlpoolPositionAddress,
			whirlpool: whirlpoolAddress,
			driftSigner: driftSignerAddress,
			driftBaseTokenOracle: driftOracleAddress,
			driftQuoteTokenOracle: PublicKey.default,
			driftState: driftStateAddress,
			driftStats: driftStatsAddress,
			driftSubaccount: driftSubaccountAddress,
			driftBorrowSpotMarket: driftBaseSpotMarketAddress,
			driftBorrowVault: driftBaseSpotMarketVaultAddress,
			driftCollateralSpotMarket: driftQuoteSpotMarketAddress,
			driftCollateralVault: driftQuoteSpotMarketVaultAddress,

			swapWhirlpool: swapWhirlpoolAddress,
			swapWhirlpoolBaseTokenVault: swapWhirlpoolBaseTokenVaultAddress,
			swapWhirlpoolQuoteTokenVault: swapWhirlpoolQuoteTokenVaultAddress,
			swapTickArray0: swapTickArray0Address,
			swapTickArray1: swapTickArray1Address,
			swapTickArray2: swapTickArray2Address,
			swapOracle: swapOracleAddress,

			driftProgram: DRIFT_PROGRAM_ID_MAINNET,
			whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
			tokenProgram: TOKEN_PROGRAM_ID,
		},
	})

	const res = await buildAndSendTx(
		connection,
		[wallet],
		[ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 }), ix],
	)

	return {
		res,
	}
}
