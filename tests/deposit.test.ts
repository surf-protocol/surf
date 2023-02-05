import { ORCA_WHIRLPOOL_PROGRAM_ID, TickUtil } from '@orca-so/whirlpools-sdk'
import { ComputeBudgetProgram, PublicKey, SystemProgram } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { beforeAll, describe, it } from 'vitest'
import BN from 'bn.js'

import {
	DEFAULT_TICK_SPACING,
	fundPosition,
	initTickArray,
	initWhirlpool,
} from './utils/cpi/whirlpool.js'
import { connection, program, wallet } from './utils/load-config.js'
import { baseTokenATA, quoteTokenATA } from './utils/mint.js'
import { buildAndSendTx } from './utils/transaction.js'
import { initDrift, driftStateKey, driftOracle, driftSignerKey } from './utils/cpi/drift.js'
import { mockAdminConfig, mockVault, mockVaultWhirlpoolPosition } from './utils/mock.js'
import { getVaultDriftAccountsAddresses } from '../sdk/ts/src/pda.js'
import { buildDepositIx } from '../sdk/ts/src/idl/instructions.js'
import { DRIFT_PROGRAM_ID_MAINNET } from '../sdk/ts/src/constants.js'

describe.skip('deposit', async () => {
	let adminConfigPDA: PublicKey
	let driftQuoteSpotMarketVaultPDA: PublicKey
	let driftBaseSpotMarketPDA: PublicKey
	let driftQuoteSpotMarketPDA: PublicKey
	let driftBaseSpotMarketVaultPDA: PublicKey

	beforeAll(async () => {
		adminConfigPDA = await mockAdminConfig()
		;({
			driftQuoteSpotMarketVaultPDA,
			driftBaseSpotMarketPDA,
			driftQuoteSpotMarketPDA,
			driftBaseSpotMarketVaultPDA,
		} = await initDrift())
	})

	it('successfully deposits', async () => {
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

		const { driftStats, driftSubaccount } = getVaultDriftAccountsAddresses(vaultPDA)
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
		const { tickArrayPda: upperTickArrayPDA } = await initTickArray(
			upperInitializableTickIndex,
			whirlpoolKey,
		)
		const { tickArrayPda: lowerTickArrayPDA } = await initTickArray(
			lowerInitializableTickIndex,
			whirlpoolKey,
		)

		const ix = await buildDepositIx(program, {
			args: {
				inputQuoteAmount: new BN(100 * 10 ** 6),
			},
			accounts: {
				adminConfig: adminConfigPDA,
				payer: wallet.publicKey,
				prepareSwapWhirlpool: whirlpoolKey,
				prepareSwapWhirlpoolBaseTokenVault: whirlpoolData.tokenVaultA,
				prepareSwapWhirlpoolQuoteTokenVault: whirlpoolData.tokenVaultB,
				payerBaseTokenAccount: baseTokenATA,
				payerQuoteTokenAccount: quoteTokenATA,
				prepareSwapTickArray0: tickArrays[0].publicKey,
				prepareSwapTickArray1: tickArrays[1].publicKey,
				prepareSwapTickArray2: tickArrays[2].publicKey,
				prepareSwapOracle: oracleKey,
				vault: vaultPDA,
				whirlpoolPosition: whirlpoolPositionPDA,
				whirlpoolPositionTokenAccount: whirlpoolPositionVaultTokenAccount,
				whirlpoolPositionTickArrayLower: lowerTickArrayPDA.publicKey,
				whirlpoolPositionTickArrayUpper: upperTickArrayPDA.publicKey,
				whirlpool: whirlpoolKey,
				whirlpoolBaseTokenVault: whirlpoolData.tokenVaultA,
				whirlpoolQuoteTokenVault: whirlpoolData.tokenVaultB,
				driftState: driftStateKey,
				driftBaseTokenOracle: driftOracle,
				driftBaseSpotMarket: driftBaseSpotMarketPDA,
				driftQuoteSpotMarket: driftQuoteSpotMarketPDA,
				driftQuoteSpotMarketVault: driftQuoteSpotMarketVaultPDA,
				driftBaseSpotMarketVault: driftBaseSpotMarketVaultPDA,
				driftSigner: driftSignerKey,
				driftStats,
				driftSubaccount,
				vaultBaseTokenAccount,
				vaultQuoteTokenAccount,

				driftProgram: DRIFT_PROGRAM_ID_MAINNET,
				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
				tokenProgram: TOKEN_PROGRAM_ID,
			},
		})

		await buildAndSendTx(
			connection,
			[wallet],
			[ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), ix],
			true,
		)
	})
})
