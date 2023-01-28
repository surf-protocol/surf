import { Percentage } from '@orca-so/common-sdk'
import { TickUtil } from '@orca-so/whirlpools-sdk'
import { ComputeBudgetProgram } from '@solana/web3.js'
import { describe, it } from 'vitest'
import BN from 'bn.js'

import {
	DEFAULT_TICK_SPACING,
	fundPosition,
	getPositionAccountsAddresses,
	initTickArray,
	initWhirlpool,
} from './utils/cpi/whirlpool.js'
import { connection, wallet } from './utils/load-config.js'
import { baseTokenATA, quoteTokenATA, baseTokenMint, quoteTokenMint } from './utils/mint.js'
import { buildAndSendTx } from './utils/transaction.js'
import { depositIx, initAdminIx, initVaultIx, openWhirlpoolPositionIx } from './ix-utils.js'
import {
	DRIFT_PROGRAM_ID,
	getDriftPDAccounts,
	initDrift,
	driftStateKey,
	driftOracle,
	driftSignerKey,
} from './utils/cpi/drift.js'

describe.only('deposit', async () => {
	const { ix: initAdminConfigIx, adminConfigPDA } = await initAdminIx()
	await buildAndSendTx(connection, [wallet], [initAdminConfigIx])

	it('test', async () => {
		const { whirlpoolKey, whirlpoolData, tickArrays, oracleKey } = await initWhirlpool()
		await fundPosition(new BN(10000 * 10 ** 6), whirlpoolKey, whirlpoolData, tickArrays)
		const {
			driftQuoteSpotMarketVaultPDA,
			driftBaseSpotMarketPDA,
			driftQuoteSpotMarketPDA,
			driftBaseSpotMarketVaultPDA,
		} = await initDrift()

		const fullTickRange = 800
		const vaultTickRange = 400
		const hedgeTickRange = 20

		const { userStatsPDA, userSubaccountPDA, userSubaccountId } = await getDriftPDAccounts(
			adminConfigPDA,
		)
		const {
			ix: _initVaultIx,
			vaultPDA,
			tokenVaultA,
			tokenVaultB,
		} = await initVaultIx(
			{
				driftSubaccountId: userSubaccountId,
				fullTickRange,
				vaultTickRange,
				hedgeTickRange,
			},
			{
				admin: wallet.publicKey,
				adminConfig: adminConfigPDA,
				whirlpool: whirlpoolKey,
				driftStats: userStatsPDA,
				driftSubaccount: userSubaccountPDA,
				driftState: driftStateKey,
				driftProgram: DRIFT_PROGRAM_ID,
				tokenMintA: baseTokenMint,
				tokenMintB: quoteTokenMint,
			},
		)

		const { whirlpoolPositionATA, whirlpoolPositionMintKeyPair, whirlpoolPositionPDA } =
			getPositionAccountsAddresses(vaultPDA)
		const currentTickIndex = whirlpoolData.tickCurrentIndex
		const upperTickIndex = currentTickIndex + fullTickRange / 2
		const lowerTickIndex = currentTickIndex - fullTickRange / 2

		const { ix: openPosIx } = await openWhirlpoolPositionIx({
			args: {
				positionBump: whirlpoolPositionPDA.bump,
				tickLowerIndex: lowerTickIndex,
				tickUpperIndex: upperTickIndex,
			},
			accounts: {
				payer: wallet.publicKey,
				whirlpool: whirlpoolKey,
				vault: vaultPDA,
				whirlpoolPosition: whirlpoolPositionPDA.publicKey,
				whirlpoolPositionMint: whirlpoolPositionMintKeyPair.publicKey,
				whirlpoolPositionTokenAccount: whirlpoolPositionATA,
			},
		})
		await buildAndSendTx(
			connection,
			[wallet, whirlpoolPositionMintKeyPair],
			[_initVaultIx, openPosIx],
			true,
		)

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

		const { ix } = await depositIx({
			args: { inputQuoteAmount: new BN(100 * 10 ** 6) },
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
				vaultBaseTokenAccount: tokenVaultA,
				vaultQuoteTokenAccount: tokenVaultB,
				whirlpoolPosition: whirlpoolPositionPDA.publicKey,
				whirlpoolPositionTokenAccount: whirlpoolPositionATA,
				whirlpoolPositionTickArrayLower: lowerTickArrayPDA.publicKey,
				whirlpoolPositionTickArrayUpper: upperTickArrayPDA.publicKey,
				whirlpool: whirlpoolKey,
				whirlpoolBaseTokenVault: whirlpoolData.tokenVaultA,
				whirlpoolQuoteTokenVault: whirlpoolData.tokenVaultB,
				driftState: driftStateKey,
				driftBaseTokenOracle: driftOracle,
				driftBaseSpotMarket: driftBaseSpotMarketPDA,
				driftQuoteSpotMarket: driftQuoteSpotMarketPDA,
				driftStats: userStatsPDA,
				driftSubaccount: userSubaccountPDA,
				driftQuoteSpotMarketVault: driftQuoteSpotMarketVaultPDA,
				driftBaseSpotMarketVault: driftBaseSpotMarketVaultPDA,
				driftSigner: driftSignerKey,
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
