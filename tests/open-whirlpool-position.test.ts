import { ORCA_WHIRLPOOL_PROGRAM_ID, ParsablePosition, TickUtil } from '@orca-so/whirlpools-sdk'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'

import { initAdminIx, initVaultIx } from './ix-utils.js'
import { getDriftPDAccounts, initDrift, driftStateKey, driftProgram } from './utils/cpi/drift.js'
import {
	DEFAULT_TICK_INDEX,
	initWhirlpool,
	getPositionAccountsAddresses,
	DEFAULT_TICK_SPACING,
} from './utils/cpi/whirlpool.js'
import { connection, program, wallet } from './utils/load-config.js'
import { baseTokenMint, quoteTokenMint } from './utils/mint.js'
import { buildAndSendTx } from './utils/transaction.js'

describe('open_whirlpool_position', () => {
	it('successfuly opens position', async () => {
		await initDrift()
		const { whirlpoolKey } = await initWhirlpool()

		const { adminConfigPDA, ix: initAdminConfigIx } = await initAdminIx()
		await buildAndSendTx(connection, [wallet], [initAdminConfigIx])

		const fullTickRange = 800 // 8%
		const vaultTickRange = 400 // 4%
		const hedgeTickRange = 20 // 0.2% - 10 times per one side of vault range

		const { userStatsPDA, userSubaccountId, userSubaccountPDA } = await getDriftPDAccounts(
			adminConfigPDA,
		)

		const { ix: _initVaultIx, vaultPDA } = await initVaultIx(
			{
				driftSubaccountId: userSubaccountId,
				fullTickRange,
				vaultTickRange,
				hedgeTickRange,
			},
			{
				whirlpool: whirlpoolKey,
				admin: wallet.publicKey,
				adminConfig: adminConfigPDA,
				driftStats: userStatsPDA,
				driftSubaccount: userSubaccountPDA,
				driftState: driftStateKey,
				driftProgram: driftProgram.programId,
				tokenMintA: baseTokenMint,
				tokenMintB: quoteTokenMint,
			},
		)
		await buildAndSendTx(connection, [wallet], [_initVaultIx])

		const halfFullTickRange = Math.round(fullTickRange / 2)
		const upperTickIndex = DEFAULT_TICK_INDEX + halfFullTickRange
		const lowerTickIndex = DEFAULT_TICK_INDEX - halfFullTickRange
		const { whirlpoolPositionATA, whirlpoolPositionMintKeyPair, whirlpoolPositionPDA } =
			getPositionAccountsAddresses(vaultPDA)

		const openPositionIx = await program.methods
			.openWhirlpoolPosition(whirlpoolPositionPDA.bump, lowerTickIndex, upperTickIndex)
			.accountsStrict({
				whirlpool: whirlpoolKey,
				payer: wallet.publicKey,
				vault: vaultPDA,
				whirlpoolPosition: whirlpoolPositionPDA.publicKey,
				whirlpoolPositionMint: whirlpoolPositionMintKeyPair.publicKey,
				whirlpoolPositionTokenAccount: whirlpoolPositionATA,
				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
				rent: SYSVAR_RENT_PUBKEY,
			})
			.instruction()

		await buildAndSendTx(connection, [wallet, whirlpoolPositionMintKeyPair], [openPositionIx])

		const vault = await program.account.vault.fetch(vaultPDA)

		expect(vault.isActive).toBe(true)
		expect(vault.whirlpoolPosition.equals(whirlpoolPositionPDA.publicKey)).toBe(true)
		expect(vault.fullTickRange).toBe(fullTickRange)
		expect(vault.vaultTickRange).toBe(vaultTickRange)
		expect(vault.hedgeTickRange).toBe(hedgeTickRange)
		expect(vault.vaultUpperTickIndex).toBe(DEFAULT_TICK_INDEX + vaultTickRange / 2)
		expect(vault.vaultLowerTickIndex).toBe(DEFAULT_TICK_INDEX - vaultTickRange / 2)
		expect(vault.lastHedgeAdjustmentTickIndex).toBe(DEFAULT_TICK_INDEX)

		const whirlpoolPositionAI = await connection.getAccountInfo(
			whirlpoolPositionPDA.publicKey,
			'confirmed',
		)
		const whirlpoolPositionData = ParsablePosition.parse(whirlpoolPositionAI.data)

		expect(whirlpoolPositionData).not.toBe(null)

		const upperInitializableTickIndex = TickUtil.getInitializableTickIndex(
			upperTickIndex,
			DEFAULT_TICK_SPACING,
		)
		const lowerInitializableTickIndex = TickUtil.getInitializableTickIndex(
			lowerTickIndex,
			DEFAULT_TICK_SPACING,
		)

		expect(whirlpoolPositionData.tickLowerIndex).toBe(lowerInitializableTickIndex)
		expect(whirlpoolPositionData.tickUpperIndex).toBe(upperInitializableTickIndex)
	})
})
