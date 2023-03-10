import { ComputeBudgetProgram, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { describe, it, beforeAll, expect } from 'vitest'
import BN from 'bn.js'
import { Percentage } from '@orca-so/common-sdk'

import { mockEnv } from './helpers'
import {
	driftOracleAddress,
	driftSignerAddress,
	driftStateAddress,
	mockDrift,
} from './utils/cpi/drift'
import { initUser } from './utils/init-user'
import { mockAdminConfig } from './utils/mock'
import {
	buildDecreaseLiquidityHedgeIx,
	DRIFT_PROGRAM_ID_MAINNET,
	parseHedgePositionAccount,
	parseUserPositionAccount,
	parseVaultStateAccount,
} from '../sdk/ts/src'
import { connection, surfProgram, wallet } from './utils/load-config'
import { baseTokenUserATA, quoteTokenUserATA } from './utils/mint'
import { ORCA_WHIRLPOOL_PROGRAM_ID } from '@orca-so/whirlpools-sdk'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { buildAndSendTx } from './utils/transaction'

describe('decrease_liquidity_hedge', () => {
	const slippageTolerance = new Percentage(new BN(10), new BN(1000))
	let adminConfigAddress: PublicKey
	let driftBaseSpotMarketAddress: PublicKey
	let driftBaseSpotMarketVaultAddress: PublicKey
	let driftQuoteSpotMarketAddress: PublicKey
	let driftQuoteSpotMarketVaultAddress: PublicKey

	beforeAll(async () => {
		await initUser()
		;[
			adminConfigAddress,
			{
				driftBaseSpotMarketAddress,
				driftBaseSpotMarketVaultAddress,
				driftQuoteSpotMarketAddress,
				driftQuoteSpotMarketVaultAddress,
			},
		] = await Promise.all([mockAdminConfig(), mockDrift()])
	})

	const fetchAccounts = async (
		userPositionAddress: PublicKey,
		vaultStateAddress: PublicKey,
		hedgePositionAddress: PublicKey,
	) => {
		const [userPosition, vaultState, hedgePosition] = await Promise.all([
			connection
				.getAccountInfo(userPositionAddress)
				.then((ai) => parseUserPositionAccount(surfProgram, ai.data)),
			connection
				.getAccountInfo(vaultStateAddress)
				.then((ai) => parseVaultStateAccount(surfProgram, ai.data)),
			connection
				.getAccountInfo(hedgePositionAddress)
				.then((ai) => parseHedgePositionAccount(surfProgram, ai.data)),
		])

		return { userPosition, vaultState, hedgePosition }
	}

	it('succeeds', async () => {
		const initialBaseTokenAmount = new BN(1 * LAMPORTS_PER_SOL)
		const {
			vaultStateAddress,
			vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccountAddress,
			userPositionAddress,
			hedgePositionAddress,
			driftStatsAddress,
			driftSubaccountAddress,
			whirlpoolAddress,
			whirlpoolBaseTokenVaultAddress,
			whirlpoolQuoteTokenVaultAddress,
			swapOracleAddress,
			swapTickArraysAddresses,
		} = await mockEnv(
			adminConfigAddress,
			{ baseTokenAmount: initialBaseTokenAmount, slippageTolerance },
			{
				increaseConfig: {
					borrowAmount: initialBaseTokenAmount,
					driftBaseSpotMarketAddress,
					driftBaseSpotMarketVaultAddress,
					driftQuoteSpotMarketAddress,
					driftQuoteSpotMarketVaultAddress,
				},
			},
		)

		const ix = await buildDecreaseLiquidityHedgeIx(surfProgram, {
			args: { factor: 10000 },
			accounts: {
				owner: wallet.publicKey,
				ownerBaseTokenAccount: baseTokenUserATA,
				ownerQuoteTokenAccount: quoteTokenUserATA,
				vaultState: vaultStateAddress,
				vaultBaseTokenAccount: vaultBaseTokenAccountAddress,
				vaultQuoteTokenAccount: vaultQuoteTokenAccountAddress,
				userPosition: userPositionAddress,
				hedgePosition: hedgePositionAddress,
				driftSigner: driftSignerAddress,
				driftState: driftStateAddress,
				driftSubaccount: driftSubaccountAddress,
				driftStats: driftStatsAddress,
				driftBorrowVault: driftBaseSpotMarketVaultAddress,
				driftBorrowSpotMarket: driftBaseSpotMarketAddress,
				driftCollateralVault: driftQuoteSpotMarketVaultAddress,
				driftCollateralSpotMarket: driftQuoteSpotMarketAddress,
				driftBaseTokenOracle: driftOracleAddress,
				driftQuoteTokenOracle: PublicKey.default,
				swapWhirlpool: whirlpoolAddress,
				swapWhirlpoolBaseTokenVault: whirlpoolBaseTokenVaultAddress,
				swapWhirlpoolQuoteTokenVault: whirlpoolQuoteTokenVaultAddress,
				swapOracle: swapOracleAddress,
				swapTickArray0: swapTickArraysAddresses[-1].publicKey,
				swapTickArray1: swapTickArraysAddresses[0].publicKey,
				swapTickArray2: swapTickArraysAddresses[1].publicKey,
				driftProgram: DRIFT_PROGRAM_ID_MAINNET,
				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
				tokenProgram: TOKEN_PROGRAM_ID,
			},
		})

		const res = await buildAndSendTx(
			connection,
			[wallet],
			[ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 }), ix],
			true,
		)

		expect(res.status).toBe('SUCCESS')

		const { userPosition, vaultState, hedgePosition } = await fetchAccounts(
			userPositionAddress,
			vaultStateAddress,
			hedgePositionAddress,
		)

		expect(userPosition.borrowAmount.toString()).toBe('0')
		expect(userPosition.borrowAmountNotional.toString()).toBe('0')
		expect(userPosition.collateralAmount.toString()).toBe('0')

		expect(vaultState.collateralAmount.toString()).toBe('0')

		const currentBorrowPosition =
			hedgePosition.borrowPositions[hedgePosition.currentBorrowPositionIndex]
		expect(currentBorrowPosition.borrowedAmount.toString()).toBe('0')
	})

	it('succeeds with partial decrease', async () => {
		const initialBaseTokenAmount = new BN(1 * LAMPORTS_PER_SOL)
		const {
			vaultStateAddress,
			vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccountAddress,
			userPositionAddress,
			hedgePositionAddress,
			driftStatsAddress,
			driftSubaccountAddress,
			whirlpoolAddress,
			whirlpoolBaseTokenVaultAddress,
			whirlpoolQuoteTokenVaultAddress,
			swapOracleAddress,
			swapTickArraysAddresses,
		} = await mockEnv(
			adminConfigAddress,
			{ baseTokenAmount: initialBaseTokenAmount, slippageTolerance },
			{
				increaseConfig: {
					borrowAmount: initialBaseTokenAmount,
					driftBaseSpotMarketAddress,
					driftBaseSpotMarketVaultAddress,
					driftQuoteSpotMarketAddress,
					driftQuoteSpotMarketVaultAddress,
				},
			},
		)

		const initialUserPosition = await connection
			.getAccountInfo(userPositionAddress)
			.then((ai) => parseUserPositionAccount(surfProgram, ai.data))

		const factor = 5000
		const ix = await buildDecreaseLiquidityHedgeIx(surfProgram, {
			args: { factor },
			accounts: {
				owner: wallet.publicKey,
				ownerBaseTokenAccount: baseTokenUserATA,
				ownerQuoteTokenAccount: quoteTokenUserATA,
				vaultState: vaultStateAddress,
				vaultBaseTokenAccount: vaultBaseTokenAccountAddress,
				vaultQuoteTokenAccount: vaultQuoteTokenAccountAddress,
				userPosition: userPositionAddress,
				hedgePosition: hedgePositionAddress,
				driftSigner: driftSignerAddress,
				driftState: driftStateAddress,
				driftSubaccount: driftSubaccountAddress,
				driftStats: driftStatsAddress,
				driftBorrowVault: driftBaseSpotMarketVaultAddress,
				driftBorrowSpotMarket: driftBaseSpotMarketAddress,
				driftCollateralVault: driftQuoteSpotMarketVaultAddress,
				driftCollateralSpotMarket: driftQuoteSpotMarketAddress,
				driftBaseTokenOracle: driftOracleAddress,
				driftQuoteTokenOracle: PublicKey.default,
				swapWhirlpool: whirlpoolAddress,
				swapWhirlpoolBaseTokenVault: whirlpoolBaseTokenVaultAddress,
				swapWhirlpoolQuoteTokenVault: whirlpoolQuoteTokenVaultAddress,
				swapOracle: swapOracleAddress,
				swapTickArray0: swapTickArraysAddresses[-1].publicKey,
				swapTickArray1: swapTickArraysAddresses[0].publicKey,
				swapTickArray2: swapTickArraysAddresses[1].publicKey,
				driftProgram: DRIFT_PROGRAM_ID_MAINNET,
				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
				tokenProgram: TOKEN_PROGRAM_ID,
			},
		})

		const res = await buildAndSendTx(
			connection,
			[wallet],
			[ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 }), ix],
			true,
		)

		expect(res.status).toBe('SUCCESS')

		const { userPosition, vaultState, hedgePosition } = await fetchAccounts(
			userPositionAddress,
			vaultStateAddress,
			hedgePositionAddress,
		)

		const borrowAmountDiff = initialBaseTokenAmount.mul(new BN(factor)).div(new BN(10000))
		const borrowAmountNotionalDiff = initialUserPosition.borrowAmountNotional
			.mul(new BN(factor))
			.div(new BN(10000))

		const updatedBorrowAmount = initialBaseTokenAmount.sub(borrowAmountDiff)
		const updatedBorrowAmountNotional =
			initialUserPosition.borrowAmountNotional.sub(borrowAmountNotionalDiff)

		expect(userPosition.borrowAmount.toString()).toBe(updatedBorrowAmount.toString())
		expect(userPosition.borrowAmountNotional.toString()).toBe(
			updatedBorrowAmountNotional.toString(),
		)
		expect(userPosition.collateralAmount.toString()).toBe(
			initialUserPosition.collateralAmount.toString(),
		)

		expect(vaultState.collateralAmount.toString()).toBe(
			initialUserPosition.collateralAmount.toString(),
		)
		const currentBorrowPosition =
			hedgePosition.borrowPositions[hedgePosition.currentBorrowPositionIndex]
		expect(currentBorrowPosition.borrowedAmount.toString()).toBe(
			userPosition.borrowAmount.toString(),
		)
		expect(currentBorrowPosition.borrowedAmountNotional.toString()).toBe(
			userPosition.borrowAmountNotional.toString(),
		)
	})

	it('fails if factor is too small', async () => {
		const initialBorrowAmount = new BN(0.001 * 10 ** 6)
		const {
			vaultStateAddress,
			vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccountAddress,
			userPositionAddress,
			hedgePositionAddress,
			driftStatsAddress,
			driftSubaccountAddress,
			whirlpoolAddress,
			whirlpoolBaseTokenVaultAddress,
			whirlpoolQuoteTokenVaultAddress,
			swapOracleAddress,
			swapTickArraysAddresses,
		} = await mockEnv(
			adminConfigAddress,
			{ baseTokenAmount: new BN(1 * LAMPORTS_PER_SOL), slippageTolerance },
			{
				increaseConfig: {
					borrowAmount: initialBorrowAmount,
					driftBaseSpotMarketAddress,
					driftBaseSpotMarketVaultAddress,
					driftQuoteSpotMarketAddress,
					driftQuoteSpotMarketVaultAddress,
				},
			},
		)

		const factor = 1
		const ix = await buildDecreaseLiquidityHedgeIx(surfProgram, {
			args: { factor },
			accounts: {
				owner: wallet.publicKey,
				ownerBaseTokenAccount: baseTokenUserATA,
				ownerQuoteTokenAccount: quoteTokenUserATA,
				vaultState: vaultStateAddress,
				vaultBaseTokenAccount: vaultBaseTokenAccountAddress,
				vaultQuoteTokenAccount: vaultQuoteTokenAccountAddress,
				userPosition: userPositionAddress,
				hedgePosition: hedgePositionAddress,
				driftSigner: driftSignerAddress,
				driftState: driftStateAddress,
				driftSubaccount: driftSubaccountAddress,
				driftStats: driftStatsAddress,
				driftBorrowVault: driftBaseSpotMarketVaultAddress,
				driftBorrowSpotMarket: driftBaseSpotMarketAddress,
				driftCollateralVault: driftQuoteSpotMarketVaultAddress,
				driftCollateralSpotMarket: driftQuoteSpotMarketAddress,
				driftBaseTokenOracle: driftOracleAddress,
				driftQuoteTokenOracle: PublicKey.default,
				swapWhirlpool: whirlpoolAddress,
				swapWhirlpoolBaseTokenVault: whirlpoolBaseTokenVaultAddress,
				swapWhirlpoolQuoteTokenVault: whirlpoolQuoteTokenVaultAddress,
				swapOracle: swapOracleAddress,
				swapTickArray0: swapTickArraysAddresses[-1].publicKey,
				swapTickArray1: swapTickArraysAddresses[0].publicKey,
				swapTickArray2: swapTickArraysAddresses[1].publicKey,
				driftProgram: DRIFT_PROGRAM_ID_MAINNET,
				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
				tokenProgram: TOKEN_PROGRAM_ID,
			},
		})

		const res = await buildAndSendTx(
			connection,
			[wallet],
			[ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 }), ix],
			true,
		)

		expect(res.status).toBe('ERROR')
	})
})
