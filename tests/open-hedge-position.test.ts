import { PublicKey, SystemProgram } from '@solana/web3.js'
import BN from 'bn.js'
import { beforeAll, describe, expect, it } from 'vitest'

import { buildOpenHedgePositionIx } from '../sdk/ts/src/idl/instructions'
import { parseHedgePositionAccount, parseVaultStateAccount } from '../sdk/ts/src/idl/state-accounts'
import { getHedgePositionAddress } from '../sdk/ts/src/pda'
import { mockDrift } from './utils/cpi/drift'
import { mockWhirlpool } from './utils/cpi/whirlpool'
import { initUser } from './utils/init-user'
import { connection, surfProgram, wallet } from './utils/load-config'
import { mockAdminConfig, mockHedgePosition, mockVaultState } from './utils/mock'
import { buildAndSendTx } from './utils/transaction'

const mockVaultEnv = async (adminConfigAddress: PublicKey) => {
	const { whirlpoolAddress } = await mockWhirlpool()
	const { vaultStateAddress } = await mockVaultState({ adminConfigAddress, whirlpoolAddress })

	return vaultStateAddress
}

describe('open_hedge_position', () => {
	let adminConfigAddress: PublicKey

	beforeAll(async () => {
		await initUser()
		;[adminConfigAddress] = await Promise.all([mockAdminConfig(), mockDrift()])
	})

	it('fails if id is not 0', async () => {
		const vaultStateAddress = await mockVaultEnv(adminConfigAddress)
		const [hedgePositionAddress] = getHedgePositionAddress(vaultStateAddress, 1)

		const ix = await buildOpenHedgePositionIx(surfProgram, {
			accounts: {
				owner: wallet.publicKey,
				vaultState: vaultStateAddress,
				vaultHedgePosition: hedgePositionAddress,
				systemProgram: SystemProgram.programId,
			},
		})
		const res = await buildAndSendTx(connection, [wallet], [ix])

		expect(res.status).toBe('ERROR')
	})

	it('successfully opens hedge position', async () => {
		const vaultStateAddress = await mockVaultEnv(adminConfigAddress)

		const [hedgePositionAddress, hedgePositionBump] = getHedgePositionAddress(
			vaultStateAddress,
			0,
		)

		const ix = await buildOpenHedgePositionIx(surfProgram, {
			accounts: {
				owner: wallet.publicKey,
				vaultState: vaultStateAddress,
				vaultHedgePosition: hedgePositionAddress,
				systemProgram: SystemProgram.programId,
			},
		})

		const res = await buildAndSendTx(connection, [wallet], [ix])

		expect(res.status).toBe('SUCCESS')

		const [hedgePositionAi, vaultStateAi] = await Promise.all([
			connection.getAccountInfo(hedgePositionAddress),
			connection.getAccountInfo(vaultStateAddress),
		])
		const hedgePosition = parseHedgePositionAccount(surfProgram, hedgePositionAi.data)

		expect(hedgePosition.bump).toBe(hedgePositionBump)
		expect(hedgePosition.currentBorrowPositionIndex).toBe(0)
		expect(hedgePosition.id.toNumber()).toBe(0)
		expect(hedgePosition.vaultState.equals(vaultStateAddress)).toBe(true)
		expect(hedgePosition.borrowPositions.length).toBe(150)

		hedgePosition.borrowPositions.forEach((bp) => {
			Object.values(bp).forEach((v) => {
				expect(v.eq(new BN(0))).toBe(true)
			})
		})

		const vaultState = parseVaultStateAccount(surfProgram, vaultStateAi.data)

		expect(vaultState.hedgePositionsCount.toNumber()).toBe(1)
		expect(vaultState.currentHedgePositionId.toNumber()).toBe(0)
	})

	it('successfully opens next one', async () => {
		const vaultStateAddress = await mockVaultEnv(adminConfigAddress)

		await mockHedgePosition({ vaultStateAddress, id: 0 })
		const { res } = await mockHedgePosition({ vaultStateAddress, id: 1 })

		expect(res.status).toBe('SUCCESS')

		const vaultStateAi = await connection.getAccountInfo(vaultStateAddress)
		const vaultState = parseVaultStateAccount(surfProgram, vaultStateAi.data)

		expect(vaultState.hedgePositionsCount.toNumber()).toBe(2)
		expect(vaultState.currentHedgePositionId.toNumber()).toBe(0)
	})
})
