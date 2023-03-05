import { ORCA_WHIRLPOOL_PROGRAM_ID, PriceMath, TickUtil } from '@orca-so/whirlpools-sdk'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { beforeAll, describe, expect, it } from 'vitest'

import { buildOpenWhirlpoolPositionIx } from '../sdk/ts/src/idl/instructions'
import { parseWhirlpoolPositionAccount } from '../sdk/ts/src/idl/state-accounts'
import {
	getWhirlpoolPositionAccountsAddresses,
	getVaultWhirlpoolPositionAddress,
} from '../sdk/ts/src/pda'
import { mockDrift } from './utils/cpi/drift'
import { DEFAULT_TICK_SPACING, mockWhirlpool } from './utils/cpi/whirlpool'
import { initUser } from './utils/init-user'
import { connection, surfProgram, wallet } from './utils/load-config'
import { mockAdminConfig, mockVaultState, mockVaultWhirlpoolPosition } from './utils/mock'
import { buildAndSendTx } from './utils/transaction'

const getPositionAddresses = (vaultStateAddress: PublicKey, id: number) => {
	const whirlpoolPosition = getWhirlpoolPositionAccountsAddresses(vaultStateAddress)
	const [vaultWhirlpoolPositionAddress, vaultWhirlpoolPositionBump] =
		getVaultWhirlpoolPositionAddress(vaultStateAddress, id)
	return {
		...whirlpoolPosition,
		vaultWhirlpoolPositionAddress,
		vaultWhirlpoolPositionBump,
	}
}

const getTickRangeBounds = (currentTickIndex: number, tickRange: number) => {
	const tickRangeSection = tickRange / 2

	const upperTick = currentTickIndex + tickRangeSection
	const lowerTick = currentTickIndex - tickRangeSection

	return {
		upperTick,
		lowerTick,
	}
}

describe('open_whirlpool_position', () => {
	let adminConfigAddress: PublicKey

	beforeAll(async () => {
		await initUser()
		adminConfigAddress = await mockAdminConfig()
		await mockDrift()
	})

	// TODO: Error should probably not be "PrivilegeEscalation"
	it('fails if id is not 0', async () => {
		const { whirlpoolAddress } = await mockWhirlpool()
		const { vaultStateAddress } = await mockVaultState({ whirlpoolAddress, adminConfigAddress })

		const {
			whirlpoolPositionBump,
			whirlpoolPositionMintKeyPair,
			whirlpoolPositionAddress,
			whirlpoolPositionVaultTokenAccountAddress,
			vaultWhirlpoolPositionAddress,
		} = getPositionAddresses(vaultStateAddress, 1)

		const ix = await buildOpenWhirlpoolPositionIx(surfProgram, {
			accounts: {
				payer: wallet.publicKey,
				vaultState: vaultStateAddress,
				whirlpool: whirlpoolAddress,
				whirlpoolPositionMint: whirlpoolPositionMintKeyPair.publicKey,
				whirlpoolPosition: whirlpoolPositionAddress,
				whirlpoolPositionTokenAccount: whirlpoolPositionVaultTokenAccountAddress,
				vaultWhirlpoolPosition: vaultWhirlpoolPositionAddress,

				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				rent: SYSVAR_RENT_PUBKEY,
			},
			args: {
				positionBump: whirlpoolPositionBump,
			},
		})

		const res = await buildAndSendTx(connection, [wallet, whirlpoolPositionMintKeyPair], [ix])

		expect(res.status).toBe('ERROR')
	})

	it('successfully opens whirlpool position', async () => {
		const { whirlpoolAddress, whirlpoolData } = await mockWhirlpool()
		const {
			vaultStateAddress,
			vaultRangeParams: { fullTickRange, vaultTickRange },
		} = await mockVaultState({ whirlpoolAddress, adminConfigAddress })

		const {
			whirlpoolPositionBump,
			whirlpoolPositionMintKeyPair,
			whirlpoolPositionAddress,
			whirlpoolPositionVaultTokenAccountAddress,
			vaultWhirlpoolPositionAddress,
			vaultWhirlpoolPositionBump,
		} = getPositionAddresses(vaultStateAddress, 0)

		const ix = await buildOpenWhirlpoolPositionIx(surfProgram, {
			accounts: {
				payer: wallet.publicKey,
				vaultState: vaultStateAddress,
				whirlpool: whirlpoolAddress,
				whirlpoolPositionMint: whirlpoolPositionMintKeyPair.publicKey,
				whirlpoolPosition: whirlpoolPositionAddress,
				whirlpoolPositionTokenAccount: whirlpoolPositionVaultTokenAccountAddress,
				vaultWhirlpoolPosition: vaultWhirlpoolPositionAddress,

				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				rent: SYSVAR_RENT_PUBKEY,
			},
			args: {
				positionBump: whirlpoolPositionBump,
			},
		})

		const res = await buildAndSendTx(connection, [wallet, whirlpoolPositionMintKeyPair], [ix])

		expect(res.status).toBe('SUCCESS')

		const vaultWhirlpoolPositionAi = await connection.getAccountInfo(
			vaultWhirlpoolPositionAddress,
		)
		const vaultWhirlpoolPosition = parseWhirlpoolPositionAccount(
			surfProgram,
			vaultWhirlpoolPositionAi.data,
		)
		expect(vaultWhirlpoolPosition).not.toBe(null)

		expect(vaultWhirlpoolPosition.bump).toBe(vaultWhirlpoolPositionBump)
		expect(vaultWhirlpoolPosition.id.toNumber()).toBe(0)

		expect(vaultWhirlpoolPosition.vaultState.equals(vaultStateAddress)).toBe(true)
		expect(vaultWhirlpoolPosition.whirlpoolPosition.equals(whirlpoolPositionAddress)).toBe(true)

		expect(vaultWhirlpoolPosition.liquidity.toNumber()).toBe(0)
		expect(vaultWhirlpoolPosition.liquidityDiff.toNumber()).toBe(0)
		expect(vaultWhirlpoolPosition.baseTokenFeeGrowth.toNumber()).toBe(0)
		expect(vaultWhirlpoolPosition.quoteTokenFeeGrowth.toNumber()).toBe(0)

		const fullTickRangeBounds = getTickRangeBounds(
			whirlpoolData.tickCurrentIndex,
			fullTickRange,
		)
		const upperTickInitializable = TickUtil.getInitializableTickIndex(
			fullTickRangeBounds.upperTick,
			DEFAULT_TICK_SPACING,
		)
		const lowerTickInitializable = TickUtil.getInitializableTickIndex(
			fullTickRangeBounds.lowerTick,
			DEFAULT_TICK_SPACING,
		)
		expect(
			vaultWhirlpoolPosition.upperSqrtPrice.eq(
				PriceMath.tickIndexToSqrtPriceX64(upperTickInitializable),
			),
		).toBe(true)
		expect(
			vaultWhirlpoolPosition.lowerSqrtPrice.eq(
				PriceMath.tickIndexToSqrtPriceX64(lowerTickInitializable),
			),
		).toBe(true)

		const middleTickIndex = Math.floor((upperTickInitializable + lowerTickInitializable) / 2)
		expect(
			vaultWhirlpoolPosition.middleSqrtPrice.eq(
				PriceMath.tickIndexToSqrtPriceX64(middleTickIndex),
			),
		).toBe(true)

		const innerTickRangeBounds = getTickRangeBounds(
			whirlpoolData.tickCurrentIndex,
			vaultTickRange,
		)
		expect(
			vaultWhirlpoolPosition.innerUpperSqrtPrice.eq(
				PriceMath.tickIndexToSqrtPriceX64(innerTickRangeBounds.upperTick),
			),
		).toBe(true)
		expect(
			vaultWhirlpoolPosition.innerLowerSqrtPrice.eq(
				PriceMath.tickIndexToSqrtPriceX64(innerTickRangeBounds.lowerTick),
			),
		).toBe(true)
	})

	it('fails if first position is already opened', async () => {
		const { whirlpoolAddress } = await mockWhirlpool()
		const { vaultStateAddress } = await mockVaultState({ whirlpoolAddress, adminConfigAddress })

		await mockVaultWhirlpoolPosition({ vaultStateAddress, whirlpoolAddress, id: 0 })
		const res = await mockVaultWhirlpoolPosition({ vaultStateAddress, whirlpoolAddress, id: 1 })

		expect(res.status).toBe('ERROR')
	})
})
