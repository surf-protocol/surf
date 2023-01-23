import { ORCA_WHIRLPOOL_PROGRAM_ID, ParsablePosition, PriceMath, TickUtil } from '@orca-so/whirlpools-sdk'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'

import { initAdminIx, initVaultIx } from './ix-utils.js'
import { getDriftPDAccounts, initDrift } from './utils/cpi/drift.js'
import {
	DEFAULT_TICK_INDEX,
	initWhirlpool,
	getPositionAccountsAddresses,
	DEFAULT_TICK_SPACING,
} from './utils/cpi/whirlpool.js'
import { connection, program, provider, wallet } from './utils/load-config.js'
import { tokenAMint, tokenBMint } from './utils/mint.js'
import { buildAndSendTx } from './utils/transaction.js'

describe('open_whirlpool_position', () => {
	it('successfuly opens position', async () => {
		const { stateAccountAddress, driftProgram } = await initDrift()
		const { whirlpool } = await initWhirlpool(connection, wallet, provider)

		const { adminConfigPDA, ix: initAdminConfigIx } = await initAdminIx()
		await buildAndSendTx(connection, [wallet], [initAdminConfigIx])

		const fullTickRange = 800 // 8%
		const vaultTickRange = 400 // 4%
		const hedgeTickRange = 20 // 0.2% - 10 times per one side of vault range

		const { userStatsPDA, userSubaccountId, userSubaccountPDA } = await getDriftPDAccounts(
			driftProgram,
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
				whirlpool,
				admin: wallet.publicKey,
				adminConfig: adminConfigPDA,
				driftStats: userStatsPDA,
				driftSubaccount: userSubaccountPDA,
				driftState: stateAccountAddress,
				driftProgram: driftProgram.programId,
				tokenMintA: tokenAMint,
				tokenMintB: tokenBMint,
			},
		)
		await buildAndSendTx(connection, [wallet], [_initVaultIx])

		const halfFullTickRange = Math.round(fullTickRange / 2)
		const upperTickIndex = DEFAULT_TICK_INDEX + halfFullTickRange
		const lowerTickIndex = DEFAULT_TICK_INDEX - halfFullTickRange
		const { whirlpoolPositionATA, whirlpoolPositionMintKeyPair, whirlpoolPositionPDA } =
			getPositionAccountsAddresses(vaultPDA)

		const [vaultPositionPDA, vaultPositionBump] = PublicKey.findProgramAddressSync(
			[Buffer.from('vault_position', 'utf-8'), vaultPDA.toBuffer()],
			program.programId,
		)

		const openPositionIx = await program.methods
			.openWhirlpoolPosition(whirlpoolPositionPDA.bump, lowerTickIndex, upperTickIndex)
			.accountsStrict({
				whirlpool,
				payer: wallet.publicKey,
				vault: vaultPDA,
				vaultPosition: vaultPositionPDA,
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

		const vaultPosition = await program.account.vaultPosition.fetchNullable(vaultPositionPDA, 'confirmed')

		expect(vaultPosition.bump).toBe(vaultPositionBump)
		expect(vaultPosition.whirlpoolPosition.equals(whirlpoolPositionPDA.publicKey)).toBe(true)
		expect(vaultPosition.vaultUpperTickIndex).toBe(DEFAULT_TICK_INDEX + vaultTickRange / 2)
		expect(vaultPosition.vaultLowerTickIndex).toBe(DEFAULT_TICK_INDEX - vaultTickRange / 2)
		expect(vaultPosition.lastHedgeAdjustmentTickIndex).toBe(DEFAULT_TICK_INDEX)

		const whirlpoolPositionAI = await connection.getAccountInfo(whirlpoolPositionPDA.publicKey, 'confirmed')
		const whirlpoolPositionData = ParsablePosition.parse(whirlpoolPositionAI.data)

		const upperInitializableTickIndex = TickUtil.getInitializableTickIndex(upperTickIndex, DEFAULT_TICK_SPACING)
		const lowerInitializableTickIndex = TickUtil.getInitializableTickIndex(lowerTickIndex, DEFAULT_TICK_SPACING)

		expect(whirlpoolPositionData).not.toBe(null)
		expect(whirlpoolPositionData.tickLowerIndex).toBe(lowerInitializableTickIndex)
		expect(whirlpoolPositionData.tickUpperIndex).toBe(upperInitializableTickIndex)
	})
})
