import { ComputeBudgetProgram, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { describe, it, beforeAll, expect } from 'vitest'
import BN from 'bn.js'
import { Percentage } from '@orca-so/common-sdk'
import { ORCA_WHIRLPOOL_PROGRAM_ID } from '@orca-so/whirlpools-sdk'
import { AccountLayout, TOKEN_PROGRAM_ID, RawAccount } from '@solana/spl-token'
import { Structure } from '@solana/buffer-layout'

import {
	buildIncreaseLiquidityHedgeIx,
	DRIFT_PROGRAM_ID_MAINNET,
	getVaultStateDriftAccountsAddresses,
	parseHedgePositionAccount,
	parseUserPositionAccount,
	parseVaultStateAccount,
	parseWhirlpoolPositionAccount,
} from '../sdk/ts/src'
import {
	driftOracleAddress,
	driftSignerAddress,
	driftStateAddress,
	mockDrift,
} from './utils/cpi/drift'
import { initUser } from './utils/init-user'
import { connection, surfProgram, wallet } from './utils/load-config'
import { mockAdminConfig, mockHedgePosition } from './utils/mock'
import { buildAndSendTx } from './utils/transaction'
import { mockEnv } from './helpers'
import { quoteTokenUserATA } from './utils/mint'
import { mockWhirlpool } from './utils/cpi/whirlpool'
import { getQuoteTokenFromLiquidity } from '../sdk/ts/src/helpers/liquidity'

describe('open_hedge_position', () => {
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

	it('succeeds', async () => {
		const {
			vaultStateAddress,
			userPositionAddress,
			whirlpoolAddress,
			vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccountAddress,
			vaultWhirlpoolPositionAddress,
			swapTickArraysAddresses,
			whirlpoolBaseTokenVaultAddress,
			whirlpoolQuoteTokenVaultAddress,
			swapOracleAddress,
		} = await mockEnv(adminConfigAddress, {
			baseTokenAmount: new BN(1 * LAMPORTS_PER_SOL),
			slippageTolerance,
		})

		const { hedgePositionAddress } = await mockHedgePosition({ vaultStateAddress, id: 0 })
		const { driftStatsAddress, driftSubaccountAddress } =
			getVaultStateDriftAccountsAddresses(vaultStateAddress)

		const borrowAmount = new BN(1 * LAMPORTS_PER_SOL)
		const ix = await buildIncreaseLiquidityHedgeIx(surfProgram, {
			args: {
				borrowAmount,
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

				swapWhirlpool: whirlpoolAddress,
				swapWhirlpoolBaseTokenVault: whirlpoolBaseTokenVaultAddress,
				swapWhirlpoolQuoteTokenVault: whirlpoolQuoteTokenVaultAddress,
				swapTickArray0: swapTickArraysAddresses[0].publicKey,
				swapTickArray1: swapTickArraysAddresses[-1].publicKey,
				swapTickArray2: swapTickArraysAddresses[-2].publicKey,
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

		expect(res.status).toBe('SUCCESS')

		const [
			userPositionAi,
			vaultWhirlpoolPositionAi,
			vaultStateAi,
			hedgePositionAi,
			vaultQuoteTokenAccountAi,
		] = await connection.getMultipleAccountsInfo([
			userPositionAddress,
			vaultWhirlpoolPositionAddress,
			vaultStateAddress,
			hedgePositionAddress,
			vaultQuoteTokenAccountAddress,
		])
		const userPosition = parseUserPositionAccount(surfProgram, userPositionAi.data)
		const vaultWhirlpoolPosition = parseWhirlpoolPositionAccount(
			surfProgram,
			vaultWhirlpoolPositionAi.data,
		)
		const vaultState = parseVaultStateAccount(surfProgram, vaultStateAi.data)

		expect(userPosition.borrowAmount.eq(borrowAmount)).toBe(true)

		const collateralAmount = getQuoteTokenFromLiquidity(
			userPosition.liquidity,
			vaultWhirlpoolPosition.lowerSqrtPrice,
			vaultWhirlpoolPosition.middleSqrtPrice,
			true,
		).mul(new BN(2))

		expect(userPosition.collateralAmount.eq(collateralAmount)).toBe(true)

		const hedgePosition = parseHedgePositionAccount(surfProgram, hedgePositionAi.data)
		const currentBorrowPosition =
			hedgePosition.borrowPositions[hedgePosition.currentBorrowPositionIndex]

		expect(vaultState.collateralAmount.eq(collateralAmount)).toBe(true)
		expect(currentBorrowPosition.borrowedAmount.eq(borrowAmount)).toBe(true)

		const vaultQuoteTokenAccount = (AccountLayout as Structure<RawAccount>).decode(
			vaultQuoteTokenAccountAi.data,
		)
		expect(vaultQuoteTokenAccount.amount.toString()).toBe(
			userPosition.borrowAmountNotional.toString(),
		)
		expect(userPosition.borrowAmountNotional.toString()).toBe(
			currentBorrowPosition.borrowedAmountNotional.toString(),
		)
	})

	it('succeeds with partial hedge increase and subsequent hedge increase', async () => {
		const {
			vaultStateAddress,
			userPositionAddress,
			whirlpoolAddress,
			vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccountAddress,
			vaultWhirlpoolPositionAddress,
			swapTickArraysAddresses,
			whirlpoolBaseTokenVaultAddress,
			whirlpoolQuoteTokenVaultAddress,
			swapOracleAddress,
		} = await mockEnv(adminConfigAddress, {
			baseTokenAmount: new BN(1 * LAMPORTS_PER_SOL),
			slippageTolerance,
		})

		const { hedgePositionAddress } = await mockHedgePosition({ vaultStateAddress, id: 0 })
		const { driftStatsAddress, driftSubaccountAddress } =
			getVaultStateDriftAccountsAddresses(vaultStateAddress)

		const buildIx = async (ba: BN) =>
			buildIncreaseLiquidityHedgeIx(surfProgram, {
				args: {
					borrowAmount: ba,
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

					swapWhirlpool: whirlpoolAddress,
					swapWhirlpoolBaseTokenVault: whirlpoolBaseTokenVaultAddress,
					swapWhirlpoolQuoteTokenVault: whirlpoolQuoteTokenVaultAddress,
					swapTickArray0: swapTickArraysAddresses[0].publicKey,
					swapTickArray1: swapTickArraysAddresses[-1].publicKey,
					swapTickArray2: swapTickArraysAddresses[-2].publicKey,
					swapOracle: swapOracleAddress,

					driftProgram: DRIFT_PROGRAM_ID_MAINNET,
					whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
					tokenProgram: TOKEN_PROGRAM_ID,
				},
			})

		const res = await buildAndSendTx(
			connection,
			[wallet],
			[
				ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 }),
				await buildIx(new BN(0.5 * LAMPORTS_PER_SOL)),
				await buildIx(new BN(0.5 * LAMPORTS_PER_SOL)),
			],
			true,
		)

		expect(res.status).toBe('SUCCESS')

		const [vaultStateAi, hedgePositionAi, userPositionAi, vaultWhirlpoolPositionAi] =
			await connection.getMultipleAccountsInfo([
				vaultStateAddress,
				hedgePositionAddress,
				userPositionAddress,
				vaultWhirlpoolPositionAddress,
			])
		const vaultState = parseVaultStateAccount(surfProgram, vaultStateAi.data)
		const hedgePosition = parseHedgePositionAccount(surfProgram, hedgePositionAi.data)
		const userPosition = parseUserPositionAccount(surfProgram, userPositionAi.data)
		const vaultWhirlpoolPosition = parseWhirlpoolPositionAccount(
			surfProgram,
			vaultWhirlpoolPositionAi.data,
		)

		const collateralAmount = getQuoteTokenFromLiquidity(
			userPosition.liquidity,
			vaultWhirlpoolPosition.lowerSqrtPrice,
			vaultWhirlpoolPosition.middleSqrtPrice,
			true,
		).mul(new BN(2))
		expect(vaultState.collateralAmount.toString()).toBe(collateralAmount.toString())

		const borrowPosition =
			hedgePosition.borrowPositions[hedgePosition.currentBorrowPositionIndex]
		expect(borrowPosition.borrowedAmount.toString()).toBe(`${1 * LAMPORTS_PER_SOL}`)
		expect(borrowPosition.borrowedAmount.toString()).toBe(userPosition.borrowAmount.toString())
	})

	it('succeeds with different pools', async () => {
		const {
			vaultStateAddress,
			userPositionAddress,
			whirlpoolAddress,
			vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccountAddress,
			vaultWhirlpoolPositionAddress,
		} = await mockEnv(adminConfigAddress, {
			baseTokenAmount: new BN(1 * LAMPORTS_PER_SOL),
			slippageTolerance,
		})
		const { hedgePositionAddress } = await mockHedgePosition({ vaultStateAddress, id: 0 })
		const { driftStatsAddress, driftSubaccountAddress } =
			getVaultStateDriftAccountsAddresses(vaultStateAddress)

		const {
			whirlpoolAddress: swapWhirlpoolAddress,
			whirlpoolBaseTokenVaultAddress: swapWhirlpoolBaseTokenVaultAddress,
			whirlpoolQuoteTokenVaultAddress: swapWhirlpoolQuoteTokenVaultAddress,
			oracleAddress: swapOracleAddress,
			tickArrays: swapTickArrays,
		} = await mockWhirlpool({
			tickSpacing: 64,
			mockBaseTokenAmount: new BN(50 * LAMPORTS_PER_SOL),
		})

		const ix = await buildIncreaseLiquidityHedgeIx(surfProgram, {
			args: {
				borrowAmount: new BN(1 * LAMPORTS_PER_SOL),
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
				swapTickArray0: swapTickArrays[0].publicKey,
				swapTickArray1: swapTickArrays[-1].publicKey,
				swapTickArray2: swapTickArrays[-2].publicKey,
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

		expect(res.status).toBe('SUCCESS')
	})

	it('fails if borrow amount is higher than pool base amount', async () => {
		const {
			vaultStateAddress,
			userPositionAddress,
			whirlpoolAddress,
			vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccountAddress,
			vaultWhirlpoolPositionAddress,
			swapTickArraysAddresses,
			whirlpoolBaseTokenVaultAddress,
			whirlpoolQuoteTokenVaultAddress,
			swapOracleAddress,
		} = await mockEnv(adminConfigAddress, {
			baseTokenAmount: new BN(1 * LAMPORTS_PER_SOL),
			slippageTolerance,
		})

		const { hedgePositionAddress } = await mockHedgePosition({ vaultStateAddress, id: 0 })
		const { driftStatsAddress, driftSubaccountAddress } =
			getVaultStateDriftAccountsAddresses(vaultStateAddress)

		const ix = await buildIncreaseLiquidityHedgeIx(surfProgram, {
			args: {
				borrowAmount: new BN(1.01 * LAMPORTS_PER_SOL),
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

				swapWhirlpool: whirlpoolAddress,
				swapWhirlpoolBaseTokenVault: whirlpoolBaseTokenVaultAddress,
				swapWhirlpoolQuoteTokenVault: whirlpoolQuoteTokenVaultAddress,
				swapTickArray0: swapTickArraysAddresses[0].publicKey,
				swapTickArray1: swapTickArraysAddresses[-1].publicKey,
				swapTickArray2: swapTickArraysAddresses[-2].publicKey,
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

		expect(res.status).toBe('ERROR')
	})
})
