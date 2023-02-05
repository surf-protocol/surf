import { ComputeBudgetProgram, PublicKey, SystemProgram } from '@solana/web3.js'
import { beforeAll, describe, it } from 'vitest'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { ORCA_WHIRLPOOL_PROGRAM_ID, TickUtil } from '@orca-so/whirlpools-sdk'
import BN from 'bn.js'

import { mockAdminConfig, mockVault, mockVaultWhirlpoolPosition } from './utils/mock.js'
import { mockDrift } from './utils/cpi/drift.js'
import {
	initWhirlpool,
	fundPosition,
	DEFAULT_TICK_SPACING,
	initProvidedTickArrays,
} from './utils/cpi/whirlpool.js'
import { buildDepositLiquidityIx } from '../sdk/ts/src/idl/instructions.js'
import { connection, program, wallet } from './utils/load-config.js'
import { baseTokenATA, quoteTokenATA } from './utils/mint.js'
import { buildAndSendTx } from './utils/transaction.js'
import { getUserPositionAddress } from '../sdk/ts/src/pda.js'

describe('deposit_liquidity', async () => {
	let adminConfigPDA: PublicKey

	beforeAll(async () => {
		adminConfigPDA = await mockAdminConfig()
		await mockDrift()
	})

	it('successfully depsits', async () => {
		const { whirlpoolKey, whirlpoolData, tickArrays, oracleKey } = await initWhirlpool()
		await fundPosition(new BN(10000 * 10 ** 6), whirlpoolKey, whirlpoolData, tickArrays)

		const fullTickRange = 800
		const vaultTickRange = 400
		const hedgeTickRange = 20

		const { vaultPDA, vaultBaseTokenAccount, vaultQuoteTokenAccount } = await mockVault(
			{ whirlpool: whirlpoolKey, adminConfigPDA },
			{
				fullTickRange,
				vaultTickRange,
				hedgeTickRange,
			},
		)

		const { whirlpoolPositionPDA, whirlpoolPositionVaultTokenAccount } =
			await mockVaultWhirlpoolPosition(vaultPDA, whirlpoolKey)

		const currentTickIndex = whirlpoolData.tickCurrentIndex
		const upperTickIndex = currentTickIndex + fullTickRange / 2
		const lowerTickIndex = currentTickIndex - fullTickRange / 2

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
				whirlpoolKey,
			)

		const [userPosition] = getUserPositionAddress(vaultPDA, wallet.publicKey)

		const depositLiquidityIx = await buildDepositLiquidityIx(program, {
			args: {
				whirlpoolDepositQuoteAmount: new BN(100 * 10 ** 6),
				whirlpoolDepositQuoteAmountMax: new BN(110 * 10 ** 6),
			},
			accounts: {
				userPosition,
				payer: wallet.publicKey,
				payerBaseTokenAccount: baseTokenATA,
				payerQuoteTokenAccount: quoteTokenATA,
				vault: vaultPDA,
				vaultBaseTokenAccount,
				vaultQuoteTokenAccount,
				prepareSwapWhirlpool: whirlpoolKey,
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
				whirlpool: whirlpoolKey,
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
			true,
		)
	})
})
