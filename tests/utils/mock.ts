import { PDA } from '@orca-so/common-sdk'
import { ORCA_WHIRLPOOL_PROGRAM_ID, TickUtil, WhirlpoolData } from '@orca-so/whirlpools-sdk'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { ComputeBudgetProgram, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import BN from 'bn.js'

import { DRIFT_PROGRAM_ID_MAINNET } from '../../sdk/ts/src/constants.js'
import {
	buildInitializeAdminConfigIx,
	buildInitializeVaultStateIx,
	buildOpenHedgePositionIx,
	buildOpenWhirlpoolPositionIx,
} from '../../sdk/ts/src/idl/instructions.js'
import {
	getAdminConfigProgramAddress,
	getHedgePositionAddress,
	getUserPositionAddress,
	getVaultDriftAccountsAddresses,
	getVaultStateProgramAddress,
	getVaultTokenAccountsAddresses,
	getVaultWhirlpoolPositionAddress,
	getWhirlpoolPositionAccountsAddresses,
} from '../../sdk/ts/src/pda.js'
import { driftStateKey } from './cpi/drift.js'
import { DEFAULT_TICK_SPACING, initProvidedTickArrays } from './cpi/whirlpool.js'
import { connection, surfProgram, wallet } from './load-config.js'
import { baseTokenUserATA, baseTokenMint, quoteTokenUserATA, quoteTokenMint } from './mint.js'
import { buildAndSendTx } from './transaction.js'

export const mockAdminConfig = async () => {
	const [adminConfigPDA] = getAdminConfigProgramAddress()
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
	const [vaultStateAddress] = getVaultStateProgramAddress(whirlpoolAddress)
	const [vaultBaseTokenAccountAddress, vaultQuoteTokenAccountAddress] =
		getVaultTokenAccountsAddresses(vaultStateAddress, baseTokenMint, quoteTokenMint)
	const { driftStats, driftSubaccount } = getVaultDriftAccountsAddresses(vaultStateAddress)

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

			driftState: driftStateKey,
			driftSubaccount,
			driftStats,

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
	}
}

type DepositLiquidityConfig = {
	liquidityAmount: number
	whirlpoolData: WhirlpoolData
	tickArrays: Record<number, PDA>
	oracleKey: PublicKey
	vaultBaseTokenAccount: PublicKey
	vaultQuoteTokenAccount: PublicKey
	upperTickIndex: number
	lowerTickIndex: number
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

	return res
}

type MockHedgePositionParams = {
	vaultStateAddress: PublicKey
	id: number
}

export const mockHedgePosition = async ({ vaultStateAddress, id }: MockHedgePositionParams) => {
	const [hedgePositionAddress] = getHedgePositionAddress(vaultStateAddress, id)
	const ix = await buildOpenHedgePositionIx(surfProgram, {
		accounts: {
			payer: wallet.publicKey,
			vaultHedgePosition: hedgePositionAddress,
			vaultState: vaultStateAddress,
			systemProgram: SystemProgram.programId,
		},
	})
	const res = await buildAndSendTx(connection, [wallet], [ix])
	return res
}

// export const mockVaultPosition = async (
// 	vault: PublicKey,
// 	whirlpool: PublicKey,
// 	depositLiqConfig?: DepositLiquidityConfig,
// ) => {
// 	const {
// 		whirlpoolPositionBump,
// 		whirlpoolPositionMintKeyPair,
// 		whirlpoolPositionPDA,
// 		whirlpoolPositionVaultTokenAccount,
// 	} = getVaultWhirlpoolPositionAccountsAddresses(vault)

// 	const ix = await buildOpenVaultPositionIx(surfProgram, {
// 		args: {
// 			positionBump: whirlpoolPositionBump,
// 		},
// 		accounts: {
// 			payer: wallet.publicKey,
// 			whirlpool,
// 			vault: vault,
// 			whirlpoolPosition: whirlpoolPositionPDA,
// 			whirlpoolPositionMint: whirlpoolPositionMintKeyPair.publicKey,
// 			whirlpoolPositionTokenAccount: whirlpoolPositionVaultTokenAccount,

// 			whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
// 			tokenProgram: TOKEN_PROGRAM_ID,
// 			associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
// 			systemProgram: SystemProgram.programId,
// 			rent: SYSVAR_RENT_PUBKEY,
// 		},
// 	})

// 	await buildAndSendTx(connection, [wallet, whirlpoolPositionMintKeyPair], [ix])

// 	const [userPosition] = getUserPositionAddress(vault, wallet.publicKey)

// 	if (depositLiqConfig) {
// 		const {
// 			whirlpoolData,
// 			tickArrays,
// 			oracleKey,
// 			liquidityAmount,
// 			vaultBaseTokenAccount,
// 			vaultQuoteTokenAccount,
// 			upperTickIndex,
// 			lowerTickIndex,
// 		} = depositLiqConfig

// 		const upperInitializableTickIndex = TickUtil.getStartTickIndex(
// 			TickUtil.getInitializableTickIndex(upperTickIndex, DEFAULT_TICK_SPACING),
// 			DEFAULT_TICK_SPACING,
// 		)
// 		const lowerInitializableTickIndex = TickUtil.getStartTickIndex(
// 			TickUtil.getInitializableTickIndex(lowerTickIndex, DEFAULT_TICK_SPACING),
// 			DEFAULT_TICK_SPACING,
// 		)
// 		const [{ tickArrayPda: upperTickArrayPDA }, { tickArrayPda: lowerTickArrayPDA }] =
// 			await initProvidedTickArrays(
// 				[upperInitializableTickIndex, lowerInitializableTickIndex],
// 				whirlpool,
// 			)

// 		const depositLiquidityIx = await buildDepositLiquidityIx(surfProgram, {
// 			args: {
// 				whirlpoolDepositQuoteAmount: new BN(liquidityAmount * 10 ** 6),
// 				whirlpoolDepositQuoteAmountMax: new BN(liquidityAmount * 1.1 * 10 ** 6),
// 			},
// 			accounts: {
// 				userPosition,
// 				payer: wallet.publicKey,
// 				payerBaseTokenAccount: baseTokenUserATA,
// 				payerQuoteTokenAccount: quoteTokenUserATA,
// 				vault: vault,
// 				vaultBaseTokenAccount,
// 				vaultQuoteTokenAccount,
// 				prepareSwapWhirlpool: whirlpool,
// 				prepareSwapWhirlpoolBaseTokenVault: whirlpoolData.tokenVaultA,
// 				prepareSwapWhirlpoolQuoteTokenVault: whirlpoolData.tokenVaultB,
// 				prepareSwapTickArray0: tickArrays[0].publicKey,
// 				prepareSwapTickArray1: tickArrays[1].publicKey,
// 				prepareSwapTickArray2: tickArrays[2].publicKey,
// 				prepareSwapOracle: oracleKey,
// 				whirlpoolPosition: whirlpoolPositionPDA,
// 				whirlpoolPositionTokenAccount: whirlpoolPositionVaultTokenAccount,
// 				whirlpoolPositionTickArrayLower: lowerTickArrayPDA.publicKey,
// 				whirlpoolPositionTickArrayUpper: upperTickArrayPDA.publicKey,
// 				whirlpool: whirlpool,
// 				whirlpoolBaseTokenVault: whirlpoolData.tokenVaultA,
// 				whirlpoolQuoteTokenVault: whirlpoolData.tokenVaultB,
// 				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
// 				tokenProgram: TOKEN_PROGRAM_ID,
// 				systemProgram: SystemProgram.programId,
// 			},
// 		})

// 		await buildAndSendTx(
// 			connection,
// 			[wallet],
// 			[ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), depositLiquidityIx],
// 		)
// 	}

// 	return {
// 		whirlpoolPositionMintKeyPair,
// 		whirlpoolPositionPDA,
// 		whirlpoolPositionVaultTokenAccount,
// 		userPosition,
// 	}
// }
