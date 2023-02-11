import {
	ORCA_WHIRLPOOL_PROGRAM_ID,
	ParsablePosition,
	PriceMath,
	TickUtil,
} from '@orca-so/whirlpools-sdk'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { beforeAll, describe, expect, it } from 'vitest'
import BN from 'bn.js'

import { buildOpenVaultPositionIx } from '../sdk/ts/src/idl/instructions.js'
import { parseVaultPositionAccount } from '../sdk/ts/src/idl/state-accounts.js'
import {
	getVaultPositionAddress,
	getVaultWhirlpoolPositionAccountsAddresses,
} from '../sdk/ts/src/pda.js'
import { mockDrift } from './utils/cpi/drift.js'
import { DEFAULT_TICK_SPACING, initWhirlpool } from './utils/cpi/whirlpool.js'
import { connection, program, wallet } from './utils/load-config.js'
import { mockAdminConfig, mockVault } from './utils/mock.js'
import { buildAndSendTx } from './utils/transaction.js'

describe.only('open_vault_position', () => {
	let adminConfigPDA: PublicKey

	beforeAll(async () => {
		adminConfigPDA = await mockAdminConfig()
		await mockDrift()
	})

	it('successfully opens vault position', async () => {
		const { whirlpoolKey, whirlpoolData } = await initWhirlpool()
		const { vaultPDA, vaultRangeParams } = await mockVault({
			whirlpool: whirlpoolKey,
			adminConfigPDA,
		})

		const vaultPositionId = 0
		const [vaultPositionPDA] = getVaultPositionAddress(vaultPDA, vaultPositionId)
		const {
			whirlpoolPositionBump,
			whirlpoolPositionPDA,
			whirlpoolPositionMintKeyPair,
			whirlpoolPositionVaultTokenAccount,
		} = getVaultWhirlpoolPositionAccountsAddresses(vaultPositionPDA)

		const openVaultPositionIx = await buildOpenVaultPositionIx(program, {
			accounts: {
				payer: wallet.publicKey,
				whirlpool: whirlpoolKey,
				vault: vaultPDA,
				vaultPosition: vaultPositionPDA,
				whirlpoolPosition: whirlpoolPositionPDA,
				whirlpoolPositionMint: whirlpoolPositionMintKeyPair.publicKey,
				whirlpoolPositionTokenAccount: whirlpoolPositionVaultTokenAccount,
				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
				tokenProgram: TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
				rent: SYSVAR_RENT_PUBKEY,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
			},
			args: {
				positionBump: whirlpoolPositionBump,
			},
		})

		await buildAndSendTx(connection, [wallet, whirlpoolPositionMintKeyPair], [openVaultPositionIx])

		const [vaultPositionAi, whirlpoolPositionAi] = await Promise.all([
			connection.getAccountInfo(vaultPositionPDA),
			connection.getAccountInfo(whirlpoolPositionPDA),
		])

		const vaultPosition = parseVaultPositionAccount(program, vaultPositionAi.data)
		const whirlpoolPosition = ParsablePosition.parse(whirlpoolPositionAi.data)

		const currentTick = whirlpoolData.tickCurrentIndex

		const vaultRangeUpperTick = currentTick + vaultRangeParams.vaultTickRange / 2
		const vaultRangeLowerTick = currentTick - vaultRangeParams.vaultTickRange / 2

		const upperTick = currentTick + vaultRangeParams.fullTickRange / 2
		const lowerTick = currentTick - vaultRangeParams.fullTickRange / 2

		const upperInitializableTick = TickUtil.getInitializableTickIndex(
			upperTick,
			DEFAULT_TICK_SPACING,
		)
		const lowerInitializableTick = TickUtil.getInitializableTickIndex(
			lowerTick,
			DEFAULT_TICK_SPACING,
		)

		const upperSqrtPrice = PriceMath.tickIndexToSqrtPriceX64(upperInitializableTick)
		const lowerSqrtPrice = PriceMath.tickIndexToSqrtPriceX64(lowerInitializableTick)
		const upperWhirlpoolPositionSqrtPrice = PriceMath.tickIndexToSqrtPriceX64(
			whirlpoolPosition.tickUpperIndex,
		)
		const lowerWhirlpoolPositionSqrtPrice = PriceMath.tickIndexToSqrtPriceX64(
			whirlpoolPosition.tickLowerIndex,
		)

		expect(vaultPosition.upperSqrtPrice.eq(upperSqrtPrice)).toBe(true)
		expect(vaultPosition.lowerSqrtPrice.eq(lowerSqrtPrice)).toBe(true)
		expect(vaultPosition.upperSqrtPrice.eq(upperWhirlpoolPositionSqrtPrice)).toBe(true)
		expect(vaultPosition.lowerSqrtPrice.eq(lowerWhirlpoolPositionSqrtPrice)).toBe(true)

		expect(vaultPosition.id.eq(new BN(vaultPositionId))).toBe(true)
		expect(vaultPosition.liquidity.eq(new BN(0))).toBe(true)
		expect(vaultPosition.rangeAdjustmentLiquidityDiff.eq(new BN(0))).toBe(true)
		expect(vaultPosition.closeSqrtPrice).toBe(null)
		expect(vaultPosition.isClosed).toBe(false)
		expect(vaultPosition.lastHedgeAdjustmentTickIndex).toBe(null)
		expect(vaultPosition.vaultUpperTickIndex).toBe(vaultRangeUpperTick)
		expect(vaultPosition.vaultLowerTickIndex).toBe(vaultRangeLowerTick)

		expect(vaultPosition.vault.equals(vaultPDA)).toBe(true)
		expect(vaultPosition.whirlpoolPosition.equals(whirlpoolPositionPDA)).toBe(true)
	})
})
