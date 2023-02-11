import { ORCA_WHIRLPOOL_PROGRAM_ID } from '@orca-so/whirlpools-sdk'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { ComputeBudgetProgram, PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import { beforeAll, describe, it } from 'vitest'

import { DRIFT_PROGRAM_ID_MAINNET } from '../sdk/ts/src/constants.js'
import { buildHedgeLiquidityIx } from '../sdk/ts/src/idl/instructions.js'
import { getVaultDriftAccountsAddresses } from '../sdk/ts/src/pda.js'
import { driftOracle, driftSignerKey, driftStateKey, mockDrift } from './utils/cpi/drift.js'
import { fundPosition, initWhirlpool } from './utils/cpi/whirlpool.js'
import { connection, program, wallet } from './utils/load-config.js'
import { baseTokenATA, quoteTokenATA } from './utils/mint.js'
import { mockAdminConfig, mockVault, mockVaultPosition } from './utils/mock.js'
import { buildAndSendTx } from './utils/transaction.js'

describe.only('hedge_liquidity', async () => {
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
		} = await mockDrift())
	})

	it('successfully hedges liquidity', async () => {
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

		const currentTickIndex = whirlpoolData.tickCurrentIndex
		const upperTickIndex = currentTickIndex + fullTickRange / 2
		const lowerTickIndex = currentTickIndex - fullTickRange / 2

		const { whirlpoolPositionPDA, userPosition } = await mockVaultPosition(vaultPDA, whirlpoolKey, {
			liquidityAmount: 100,
			whirlpoolData,
			oracleKey,
			tickArrays,
			vaultBaseTokenAccount,
			vaultQuoteTokenAccount,
			upperTickIndex,
			lowerTickIndex,
		})

		const { driftStats, driftSubaccount } = getVaultDriftAccountsAddresses(vaultPDA)

		const hedgeLiquidityIx = await buildHedgeLiquidityIx(program, {
			accounts: {
				payer: wallet.publicKey,
				payerBaseTokenAccount: baseTokenATA,
				payerQuoteTokenAccount: quoteTokenATA,
				userPosition,
				whirlpool: whirlpoolKey,
				whirlpoolPosition: whirlpoolPositionPDA,
				vault: vaultPDA,
				vaultBaseTokenAccount,
				vaultQuoteTokenAccount,
				driftBaseSpotMarket: driftBaseSpotMarketPDA,
				driftBaseSpotMarketVault: driftBaseSpotMarketVaultPDA,
				driftQuoteSpotMarket: driftQuoteSpotMarketPDA,
				driftQuoteSpotMarketVault: driftQuoteSpotMarketVaultPDA,
				driftBaseTokenOracle: driftOracle,
				driftSigner: driftSignerKey,
				driftState: driftStateKey,
				driftStats,
				driftSubaccount,

				hedgeSwapWhirlpool: whirlpoolKey,
				hedgeSwapOracle: oracleKey,
				hedgeSwapWhirlpoolBaseTokenVault: whirlpoolData.tokenVaultA,
				hedgeSwapWhirlpoolQuoteTokenVault: whirlpoolData.tokenVaultB,
				hedgeSwapTickArray0: tickArrays[0].publicKey,
				hedgeSwapTickArray1: tickArrays[-1].publicKey,
				hedgeSwapTickArray2: tickArrays[-2].publicKey,

				driftProgram: DRIFT_PROGRAM_ID_MAINNET,
				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
				tokenProgram: TOKEN_PROGRAM_ID,
			},
		})

		await buildAndSendTx(
			connection,
			[wallet],
			[ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), hedgeLiquidityIx],
			true,
		)
	})
})
