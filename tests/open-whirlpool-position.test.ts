import { ORCA_WHIRLPOOL_PROGRAM_ID, ParsablePosition, TickUtil } from '@orca-so/whirlpools-sdk'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { beforeAll, describe, expect, it } from 'vitest'

import { buildOpenWhirlpoolPositionIx } from '../sdk/ts/src/idl/instructions.js'
import { parseVaultAccount } from '../sdk/ts/src/idl/state-accounts.js'
import { getVaultWhirlpoolPositionAccountsAddresses } from '../sdk/ts/src/pda.js'
import { mockDrift } from './utils/cpi/drift.js'
import { DEFAULT_TICK_INDEX, initWhirlpool, DEFAULT_TICK_SPACING } from './utils/cpi/whirlpool.js'
import { connection, program, wallet } from './utils/load-config.js'
import { mockAdminConfig, mockVault } from './utils/mock.js'
import { buildAndSendTx } from './utils/transaction.js'

describe('open_whirlpool_position', async () => {
	let adminConfigPDA: PublicKey

	beforeAll(async () => {
		adminConfigPDA = await mockAdminConfig()
		await mockDrift()
	})

	it('successfully opens position', async () => {
		const { whirlpoolKey } = await initWhirlpool()

		const fullTickRange = 800 // 8%
		const vaultTickRange = 400 // 4%
		const hedgeTickRange = 20 // 0.2% - 10 times per one side of vault range

		const { vaultPDA } = await mockVault(
			{ whirlpool: whirlpoolKey, adminConfigPDA },
			{ fullTickRange, vaultTickRange, hedgeTickRange },
		)

		const halfFullTickRange = Math.round(fullTickRange / 2)
		const upperTickIndex = DEFAULT_TICK_INDEX + halfFullTickRange
		const lowerTickIndex = DEFAULT_TICK_INDEX - halfFullTickRange

		const {
			whirlpoolPositionMintKeyPair,
			whirlpoolPositionVaultTokenAccount,
			whirlpoolPositionPDA,
			whirlpoolPositionBump,
		} = getVaultWhirlpoolPositionAccountsAddresses(vaultPDA)

		const openPositionIx = await buildOpenWhirlpoolPositionIx(program, {
			args: {
				positionBump: whirlpoolPositionBump,
			},
			accounts: {
				whirlpool: whirlpoolKey,
				payer: wallet.publicKey,
				vault: vaultPDA,
				whirlpoolPosition: whirlpoolPositionPDA,
				whirlpoolPositionMint: whirlpoolPositionMintKeyPair.publicKey,
				whirlpoolPositionTokenAccount: whirlpoolPositionVaultTokenAccount,
				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
				rent: SYSVAR_RENT_PUBKEY,
			},
		})

		await buildAndSendTx(connection, [wallet, whirlpoolPositionMintKeyPair], [openPositionIx])

		const vaultAccountInfo = await connection.getAccountInfo(vaultPDA)
		const vault = parseVaultAccount(program, vaultAccountInfo.data)

		expect(vault?.isActive).toBe(true)
		expect(vault?.whirlpoolPosition.equals(whirlpoolPositionPDA)).toBe(true)
		expect(vault?.fullTickRange).toBe(fullTickRange)
		expect(vault?.vaultTickRange).toBe(vaultTickRange)
		expect(vault?.hedgeTickRange).toBe(hedgeTickRange)
		expect(vault?.vaultUpperTickIndex).toBe(DEFAULT_TICK_INDEX + vaultTickRange / 2)
		expect(vault?.vaultLowerTickIndex).toBe(DEFAULT_TICK_INDEX - vaultTickRange / 2)
		expect(vault?.lastHedgeAdjustmentTickIndex).toBe(DEFAULT_TICK_INDEX)

		const whirlpoolPositionAI = await connection.getAccountInfo(whirlpoolPositionPDA, 'confirmed')
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
