import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { Percentage } from '@orca-so/common-sdk'
import BN from 'bn.js'
import { Structure } from '@solana/buffer-layout'
import {
	decreaseLiquidityQuoteByLiquidityWithParams,
	ORCA_WHIRLPOOL_PROGRAM_ID,
	ParsablePosition,
} from '@orca-so/whirlpools-sdk'
import { AccountLayout, TOKEN_PROGRAM_ID, RawAccount } from '@solana/spl-token'

import { mockDrift } from './utils/cpi/drift'
import { initUser } from './utils/init-user'
import { mockAdminConfig } from './utils/mock'
import { mockEnv } from './helpers'
import {
	buildDecreaseLiquidityIx,
	parseUserPositionAccount,
	parseWhirlpoolPositionAccount,
} from '../sdk/ts/src'
import { connection, surfProgram, wallet } from './utils/load-config'
import { baseTokenUserATA, quoteTokenUserATA } from './utils/mint'
import { buildAndSendTx } from './utils/transaction'

describe('decrease_liquidity', () => {
	const slippageTolerance = new Percentage(new BN(10), new BN(1000))
	let adminConfigAddress: PublicKey

	beforeAll(async () => {
		await initUser()
		;[adminConfigAddress] = await Promise.all([mockAdminConfig(), mockDrift()])
	})

	it('succeeds', async () => {
		const {
			increaseLiquidityData,
			userPositionAddress,
			vaultStateAddress,
			vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccountAddress,
			vaultWhirlpoolPositionAddress,
			whirlpoolAddress,
			whirlpoolBaseTokenVaultAddress,
			whirlpoolPositionAddress,
			whirlpoolPositionVaultTokenAccountAddress,
			whirlpoolQuoteTokenVaultAddress,
			whirlpoolData,
		} = await mockEnv(adminConfigAddress, {
			slippageTolerance,
			baseTokenAmount: new BN(1 * LAMPORTS_PER_SOL),
		})

		const { upperTickArrayAddress, lowerTickArrayAddress } = increaseLiquidityData
		const ix = await buildDecreaseLiquidityIx(surfProgram, {
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
				whirlpoolBaseTokenVault: whirlpoolBaseTokenVaultAddress,
				whirlpoolQuoteTokenVault: whirlpoolQuoteTokenVaultAddress,
				whirlpoolPosition: whirlpoolPositionAddress,
				whirlpoolPositionTokenAccount: whirlpoolPositionVaultTokenAccountAddress,
				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
				tickArrayLower: lowerTickArrayAddress,
				tickArrayUpper: upperTickArrayAddress,
				tokenProgram: TOKEN_PROGRAM_ID,
			},
			args: {
				liquidity: increaseLiquidityData.liquidityAmount,
			},
		})

		const res = await buildAndSendTx(connection, [wallet], [ix], true)
		expect(res.status).toBe('SUCCESS')

		const ais = await connection.getMultipleAccountsInfo([
			userPositionAddress,
			whirlpoolPositionAddress,
			vaultWhirlpoolPositionAddress,
			whirlpoolBaseTokenVaultAddress,
			whirlpoolQuoteTokenVaultAddress,
			vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccountAddress,
		])
		const userPosition = parseUserPositionAccount(surfProgram, ais[0].data)
		const whirlpoolPosition = ParsablePosition.parse(ais[1].data)
		const vaultWhirlpoolPosition = parseWhirlpoolPositionAccount(surfProgram, ais[2].data)

		expect(userPosition.liquidity.eq(new BN(0))).toBe(true)
		expect(whirlpoolPosition.liquidity.eq(new BN(0))).toBe(true)
		expect(vaultWhirlpoolPosition.liquidity.eq(new BN(0))).toBe(true)

		const accountLayout = AccountLayout as Structure<RawAccount>

		ais.slice(5).forEach((ai, i) => {
			expect(accountLayout.decode(ai.data).amount).toBe(0n)
		})

		const decreaseLiquidityQuote = decreaseLiquidityQuoteByLiquidityWithParams({
			liquidity: increaseLiquidityData.liquidityAmount,
			tickCurrentIndex: whirlpoolData.tickCurrentIndex,
			sqrtPrice: whirlpoolData.sqrtPrice,
			tickLowerIndex: increaseLiquidityData.lowerTickInitializable,
			tickUpperIndex: increaseLiquidityData.upperTickInitializable,
			slippageTolerance,
		})

		const remainderBase = increaseLiquidityData.baseTokenAmount.sub(
			decreaseLiquidityQuote.tokenEstA,
		)
		const remainderQuote = increaseLiquidityData.quoteTokenAmount.sub(
			decreaseLiquidityQuote.tokenEstB,
		)

		;[remainderBase, remainderQuote].forEach((expected, i) => {
			const real = new BN(accountLayout.decode(ais[i + 3].data).amount.toString())
			expect(real.eq(expected)).toBe(true)
		})
	})

	it.todo('Fails if position is not synced')
})
