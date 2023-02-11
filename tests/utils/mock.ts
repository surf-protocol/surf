import { PDA } from '@orca-so/common-sdk'
import { ORCA_WHIRLPOOL_PROGRAM_ID, TickUtil, WhirlpoolData } from '@orca-so/whirlpools-sdk'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { ComputeBudgetProgram, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import BN from 'bn.js'

import { DRIFT_PROGRAM_ID_MAINNET } from '../../sdk/ts/src/constants.js'
import {
	buildInitializeAdminConfigIx,
	buildInitializeVaultIx,
	buildDepositLiquidityIx,
	buildOpenVaultPositionIx,
} from '../../sdk/ts/src/idl/instructions.js'
import {
	getAdminConfigProgramAddress,
	getUserPositionAddress,
	getVaultDriftAccountsAddresses,
	getVaultProgramAddress,
	getVaultTokenAccountsAddresses,
	getVaultWhirlpoolPositionAccountsAddresses,
} from '../../sdk/ts/src/pda.js'
import { driftStateKey } from './cpi/drift.js'
import { DEFAULT_TICK_SPACING, initProvidedTickArrays } from './cpi/whirlpool.js'
import { connection, program, wallet } from './load-config.js'
import { baseTokenATA, baseTokenMint, quoteTokenATA, quoteTokenMint } from './mint.js'
import { buildAndSendTx } from './transaction.js'

export const mockAdminConfig = async () => {
	const [adminConfigPDA] = getAdminConfigProgramAddress()
	const initAdminConfigIx = await buildInitializeAdminConfigIx(program, {
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
	whirlpool: PublicKey
	adminConfigPDA: PublicKey
}

type MockVaultParams = {
	fullTickRange?: number
	vaultTickRange?: number
	hedgeTickRange?: number
}

export const mockVault = async (
	{ whirlpool, adminConfigPDA }: MockVaultAccounts,
	{ fullTickRange = 800, vaultTickRange = 400, hedgeTickRange = 20 }: MockVaultParams = {
		fullTickRange: 800,
		vaultTickRange: 400,
		hedgeTickRange: 20,
	},
) => {
	const [vaultPDA] = getVaultProgramAddress(whirlpool)
	const [vaultBaseTokenAccount, vaultQuoteTokenAccount] = getVaultTokenAccountsAddresses(
		vaultPDA,
		baseTokenMint,
		quoteTokenMint,
	)
	const { driftStats, driftSubaccount } = getVaultDriftAccountsAddresses(vaultPDA)

	const initVaultIx = await buildInitializeVaultIx(program, {
		args: {
			fullTickRange,
			vaultTickRange,
			hedgeTickRange,
		},
		accounts: {
			vaultBaseTokenAccount,
			vaultQuoteTokenAccount,
			baseTokenMint,
			quoteTokenMint,
			whirlpool,

			admin: wallet.publicKey,
			adminConfig: adminConfigPDA,
			vault: vaultPDA,

			driftState: driftStateKey,
			driftSubaccount,
			driftStats,

			whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
			driftProgram: DRIFT_PROGRAM_ID_MAINNET,
			systemProgram: SystemProgram.programId,
			tokenProgram: TOKEN_PROGRAM_ID,
			rent: SYSVAR_RENT_PUBKEY,
			associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
		},
	})

	await buildAndSendTx(connection, [wallet], [initVaultIx])

	return {
		adminConfigPDA,
		vaultPDA,
		vaultBaseTokenAccount,
		vaultQuoteTokenAccount,
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

export const mockVaultPosition = async (
	vault: PublicKey,
	whirlpool: PublicKey,
	depositLiqConfig?: DepositLiquidityConfig,
) => {
	const {
		whirlpoolPositionBump,
		whirlpoolPositionMintKeyPair,
		whirlpoolPositionPDA,
		whirlpoolPositionVaultTokenAccount,
	} = getVaultWhirlpoolPositionAccountsAddresses(vault)

	const ix = await buildOpenVaultPositionIx(program, {
		args: {
			positionBump: whirlpoolPositionBump,
		},
		accounts: {
			payer: wallet.publicKey,
			whirlpool,
			vault: vault,
			whirlpoolPosition: whirlpoolPositionPDA,
			whirlpoolPositionMint: whirlpoolPositionMintKeyPair.publicKey,
			whirlpoolPositionTokenAccount: whirlpoolPositionVaultTokenAccount,

			whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
			tokenProgram: TOKEN_PROGRAM_ID,
			associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
			systemProgram: SystemProgram.programId,
			rent: SYSVAR_RENT_PUBKEY,
		},
	})

	await buildAndSendTx(connection, [wallet, whirlpoolPositionMintKeyPair], [ix])

	const [userPosition] = getUserPositionAddress(vault, wallet.publicKey)

	if (depositLiqConfig) {
		const {
			whirlpoolData,
			tickArrays,
			oracleKey,
			liquidityAmount,
			vaultBaseTokenAccount,
			vaultQuoteTokenAccount,
			upperTickIndex,
			lowerTickIndex,
		} = depositLiqConfig

		const upperInitializableTickIndex = TickUtil.getStartTickIndex(
			TickUtil.getInitializableTickIndex(upperTickIndex, DEFAULT_TICK_SPACING),
			DEFAULT_TICK_SPACING,
		)
		const lowerInitializableTickIndex = TickUtil.getStartTickIndex(
			TickUtil.getInitializableTickIndex(lowerTickIndex, DEFAULT_TICK_SPACING),
			DEFAULT_TICK_SPACING,
		)
		const [{ tickArrayPda: upperTickArrayPDA }, { tickArrayPda: lowerTickArrayPDA }] =
			await initProvidedTickArrays(
				[upperInitializableTickIndex, lowerInitializableTickIndex],
				whirlpool,
			)

		const depositLiquidityIx = await buildDepositLiquidityIx(program, {
			args: {
				whirlpoolDepositQuoteAmount: new BN(liquidityAmount * 10 ** 6),
				whirlpoolDepositQuoteAmountMax: new BN(liquidityAmount * 1.1 * 10 ** 6),
			},
			accounts: {
				userPosition,
				payer: wallet.publicKey,
				payerBaseTokenAccount: baseTokenATA,
				payerQuoteTokenAccount: quoteTokenATA,
				vault: vault,
				vaultBaseTokenAccount,
				vaultQuoteTokenAccount,
				prepareSwapWhirlpool: whirlpool,
				prepareSwapWhirlpoolBaseTokenVault: whirlpoolData.tokenVaultA,
				prepareSwapWhirlpoolQuoteTokenVault: whirlpoolData.tokenVaultB,
				prepareSwapTickArray0: tickArrays[0].publicKey,
				prepareSwapTickArray1: tickArrays[1].publicKey,
				prepareSwapTickArray2: tickArrays[2].publicKey,
				prepareSwapOracle: oracleKey,
				whirlpoolPosition: whirlpoolPositionPDA,
				whirlpoolPositionTokenAccount: whirlpoolPositionVaultTokenAccount,
				whirlpoolPositionTickArrayLower: lowerTickArrayPDA.publicKey,
				whirlpoolPositionTickArrayUpper: upperTickArrayPDA.publicKey,
				whirlpool: whirlpool,
				whirlpoolBaseTokenVault: whirlpoolData.tokenVaultA,
				whirlpoolQuoteTokenVault: whirlpoolData.tokenVaultB,
				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
				tokenProgram: TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
			},
		})

		await buildAndSendTx(
			connection,
			[wallet],
			[ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), depositLiquidityIx],
		)
	}

	return {
		whirlpoolPositionMintKeyPair,
		whirlpoolPositionPDA,
		whirlpoolPositionVaultTokenAccount,
		userPosition,
	}
}
