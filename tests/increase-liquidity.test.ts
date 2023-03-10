import { Percentage } from '@orca-so/common-sdk'
import { Structure } from '@solana/buffer-layout'
import {
	increaseLiquidityQuoteByInputTokenWithParams,
	ORCA_WHIRLPOOL_PROGRAM_ID,
	ParsablePosition,
} from '@orca-so/whirlpools-sdk'
import { AccountLayout, RawAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { BN } from 'bn.js'
import { beforeAll, describe, expect, it } from 'vitest'

import {
	buildIncreaseLiquidityIx,
	getTickArraysAddresses,
	getFullRangeBoundaries,
	parseUserPositionAccount,
	parseWhirlpoolPositionAccount,
} from '../sdk/ts/src'
import { mockDrift } from './utils/cpi/drift'
import { mockWhirlpool } from './utils/cpi/whirlpool'
import { initUser } from './utils/init-user'
import { connection, surfProgram, wallet } from './utils/load-config'
import { baseTokenMint, baseTokenUserATA, quoteTokenMint, quoteTokenUserATA } from './utils/mint'
import { mockAdminConfig, mockVaultState } from './utils/mock'
import { buildAndSendTx } from './utils/transaction'
import { mockEnv } from './helpers'

const accountLayout = AccountLayout as Structure<RawAccount>

describe('increase_liquidity', () => {
	const slippageTolerance = new Percentage(new BN(10), new BN(1000))
	let adminConfigAddress: PublicKey

	beforeAll(async () => {
		await initUser()
		;[adminConfigAddress] = await Promise.all([mockAdminConfig(), mockDrift()])
	})

	it('succeeds', async () => {
		const {
			whirlpoolAddress,
			whirlpoolData,
			whirlpoolBaseTokenVaultAddress,
			whirlpoolQuoteTokenVaultAddress,
			vaultStateAddress,
			vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccountAddress,
			fullTickRange,
			vaultWhirlpoolPositionAddress,
			whirlpoolPositionAddress,
			whirlpoolPositionVaultTokenAccountAddress,
			userPositionAddress,
		} = await mockEnv(adminConfigAddress)

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

		const baseTokenAmount = new BN(1 * LAMPORTS_PER_SOL)
		const { tokenEstA, tokenEstB, tokenMaxA, tokenMaxB, liquidityAmount } =
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
		expect(res.status).toBe('SUCCESS')

		const [
			userPosition,
			vaultWhirlpoolPosition,
			whirlpoolPosition,
			[
				vaultBaseTokenAccount,
				vaultQuoteTokenAccount,
				whirlpoolBaseTokenVault,
				whirlpoolQuoteTokenVault,
			],
		] = await Promise.all([
			connection
				.getAccountInfo(userPositionAddress)
				.then((ai) => parseUserPositionAccount(surfProgram, ai.data)),
			connection
				.getAccountInfo(vaultWhirlpoolPositionAddress)
				.then((ai) => parseWhirlpoolPositionAccount(surfProgram, ai.data)),
			connection
				.getAccountInfo(whirlpoolPositionAddress)
				.then((ai) => ParsablePosition.parse(ai.data)),
			connection
				.getMultipleAccountsInfo([
					vaultBaseTokenAccountAddress,
					vaultQuoteTokenAccountAddress,
					whirlpoolBaseTokenVaultAddress,
					whirlpoolQuoteTokenVaultAddress,
				])
				.then((ais) => ais.map((ai) => accountLayout.decode(ai.data))),
		])

		expect(userPosition.liquidity.eq(liquidityAmount)).toBe(true)
		expect(userPosition.whirlpoolPositionId.toNumber()).toBe(0)
		expect(userPosition.feeGrowthCheckpointBaseToken.eq(whirlpoolData.feeGrowthGlobalA)).toBe(
			true,
		)
		expect(userPosition.feeGrowthCheckpointQuoteToken.eq(whirlpoolData.feeGrowthGlobalB)).toBe(
			true,
		)

		expect(vaultWhirlpoolPosition.liquidity.eq(liquidityAmount)).toBe(true)
		expect(vaultWhirlpoolPosition.baseTokenFeeGrowth.eq(whirlpoolData.feeGrowthGlobalA)).toBe(
			true,
		)
		expect(vaultWhirlpoolPosition.quoteTokenFeeGrowth.eq(whirlpoolData.feeGrowthGlobalB)).toBe(
			true,
		)

		expect(whirlpoolPosition.liquidity.eq(liquidityAmount)).toBe(true)

		expect(vaultBaseTokenAccount.amount).toBe(0n)
		expect(vaultQuoteTokenAccount.amount).toBe(0n)
		expect(whirlpoolBaseTokenVault.amount).toBe(BigInt(tokenEstA.toString()))
		expect(whirlpoolQuoteTokenVault.amount).toBe(BigInt(tokenEstB.toString()))
	})

	it('fails with invalid vault state account or invalid whirlpool', async () => {
		const {
			fullTickRange,
			whirlpoolAddress,
			whirlpoolData,
			whirlpoolBaseTokenVaultAddress,
			whirlpoolQuoteTokenVaultAddress,
			whirlpoolPositionAddress,
			whirlpoolPositionVaultTokenAccountAddress,
			userPositionAddress,
			vaultStateAddress,
			vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccountAddress,
			vaultWhirlpoolPositionAddress,
		} = await mockEnv(adminConfigAddress)

		const { whirlpoolAddress: invalidWhirlpoolAddress } = await mockWhirlpool({
			tickSpacing: 64,
		})
		const { vaultStateAddress: invalidVaultStateAddress } = await mockVaultState({
			whirlpoolAddress: invalidWhirlpoolAddress,
			adminConfigAddress,
		})

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

		const baseTokenAmount = new BN(1 * LAMPORTS_PER_SOL)
		const { tokenMaxA, tokenMaxB, liquidityAmount } =
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

		const res = await Promise.all([
			buildIncreaseLiquidityIx(surfProgram, {
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
					vaultState: invalidVaultStateAddress,
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
			}).then((ix) => buildAndSendTx(connection, [wallet], [ix])),
			buildIncreaseLiquidityIx(surfProgram, {
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
					whirlpool: invalidWhirlpoolAddress,
					whirlpoolBaseTokenAccount: whirlpoolBaseTokenVaultAddress,
					whirlpoolQuoteTokenAccount: whirlpoolQuoteTokenVaultAddress,
					whirlpoolPosition: whirlpoolPositionAddress,
					whirlpoolPositionTokenAccount: whirlpoolPositionVaultTokenAccountAddress,
					tickArrayLower: lowerTickArrayAddress,
					tickArrayUpper: upperTickArrayAddress,
					whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
					tokenProgram: TOKEN_PROGRAM_ID,
				},
			}).then((ix) => buildAndSendTx(connection, [wallet], [ix])),
		])

		res.forEach((r) => {
			expect(r.status).toBe('ERROR')
		})
	})

	it('succeeds if liquidity was previously increased', async () => {
		const {
			whirlpoolAddress,
			whirlpoolData,
			whirlpoolBaseTokenVaultAddress,
			whirlpoolQuoteTokenVaultAddress,
			whirlpoolPositionAddress,
			whirlpoolPositionVaultTokenAccountAddress,
			fullTickRange,
			userPositionAddress,
			vaultStateAddress,
			vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccountAddress,
			vaultWhirlpoolPositionAddress,
		} = await mockEnv(adminConfigAddress)

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

		const firstLiquidityQuote = increaseLiquidityQuoteByInputTokenWithParams({
			inputTokenAmount: new BN(1 * LAMPORTS_PER_SOL),
			inputTokenMint: baseTokenMint,
			tokenMintA: baseTokenMint,
			tokenMintB: quoteTokenMint,
			tickCurrentIndex: whirlpoolData.tickCurrentIndex,
			sqrtPrice: whirlpoolData.sqrtPrice,
			tickLowerIndex: lowerTickInitializable,
			tickUpperIndex: upperTickInitializable,
			slippageTolerance,
		})

		const firstIx = await buildIncreaseLiquidityIx(surfProgram, {
			args: {
				liquidityInput: firstLiquidityQuote.liquidityAmount,
				baseTokenMax: firstLiquidityQuote.tokenMaxA,
				quoteTokenMax: firstLiquidityQuote.tokenMaxB,
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

		const secondLiquidityQuote = increaseLiquidityQuoteByInputTokenWithParams({
			inputTokenAmount: new BN(0.5 * LAMPORTS_PER_SOL),
			inputTokenMint: baseTokenMint,
			tokenMintA: baseTokenMint,
			tokenMintB: quoteTokenMint,
			tickCurrentIndex: whirlpoolData.tickCurrentIndex,
			sqrtPrice: whirlpoolData.sqrtPrice,
			tickLowerIndex: lowerTickInitializable,
			tickUpperIndex: upperTickInitializable,
			slippageTolerance,
		})
		const secondIx = await buildIncreaseLiquidityIx(surfProgram, {
			args: {
				liquidityInput: secondLiquidityQuote.liquidityAmount,
				baseTokenMax: secondLiquidityQuote.tokenMaxA,
				quoteTokenMax: secondLiquidityQuote.tokenMaxB,
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

		const res = await buildAndSendTx(connection, [wallet], [firstIx, secondIx])
		expect(res.status).toBe('SUCCESS')

		const [vaultWhirlpoolPosition, [whirlpoolBaseTokenVault, whirlpoolQuoteTokenVault]] =
			await Promise.all([
				connection
					.getAccountInfo(vaultWhirlpoolPositionAddress)
					.then((ai) => parseWhirlpoolPositionAccount(surfProgram, ai.data)),
				connection
					.getMultipleAccountsInfo([
						whirlpoolBaseTokenVaultAddress,
						whirlpoolQuoteTokenVaultAddress,
					])
					.then((ais) => ais.map((ai) => accountLayout.decode(ai.data))),
			])

		expect(
			vaultWhirlpoolPosition.liquidity.eq(
				firstLiquidityQuote.liquidityAmount.add(secondLiquidityQuote.liquidityAmount),
			),
		).toBe(true)
		expect(
			new BN(whirlpoolBaseTokenVault.amount.toString()).eq(
				firstLiquidityQuote.tokenEstA.add(secondLiquidityQuote.tokenEstA),
			),
		).toBe(true)
		expect(
			new BN(whirlpoolQuoteTokenVault.amount.toString()).eq(
				firstLiquidityQuote.tokenEstB.add(secondLiquidityQuote.tokenEstB),
			),
		).toBe(true)

		expect(vaultWhirlpoolPosition.baseTokenFeeGrowth.eq(whirlpoolData.feeGrowthGlobalA)).toBe(
			true,
		)
		expect(vaultWhirlpoolPosition.quoteTokenFeeGrowth.eq(whirlpoolData.feeGrowthGlobalB)).toBe(
			true,
		)
	})

	it.todo('fails if user position is not synced')

	it.todo('succeeds if liquidity was not previously provided but whirlpool position id is not 0')
})
