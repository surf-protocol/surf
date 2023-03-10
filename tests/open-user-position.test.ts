import { PublicKey, SystemProgram } from '@solana/web3.js'
import { beforeAll, describe, expect, it } from 'vitest'

import { getUserPositionAddress } from '../sdk/ts/src/pda'
import { buildOpenUserPositionIx } from '../sdk/ts/src/idl/instructions'
import { mockDrift } from './utils/cpi/drift'
import { mockWhirlpool } from './utils/cpi/whirlpool'
import { initUser } from './utils/init-user'
import { connection, surfProgram, wallet } from './utils/load-config'
import { mockAdminConfig, mockVaultState } from './utils/mock'
import { buildAndSendTx } from './utils/transaction'
import { parseUserPositionAccount } from '../sdk/ts/src/idl/state-accounts'

describe('open_user_position', () => {
	let adminConfigAddress: PublicKey

	beforeAll(async () => {
		await initUser()
		;[adminConfigAddress] = await Promise.all([mockAdminConfig(), mockDrift()])
	})

	it('successfully opens user positions', async () => {
		const { whirlpoolAddress } = await mockWhirlpool()
		const { vaultStateAddress } = await mockVaultState({ whirlpoolAddress, adminConfigAddress })

		const [userPositionAddress, userPositionBump] = getUserPositionAddress(
			vaultStateAddress,
			wallet.publicKey,
		)

		const ix = await buildOpenUserPositionIx(surfProgram, {
			accounts: {
				owner: wallet.publicKey,
				userPosition: userPositionAddress,
				vaultState: vaultStateAddress,
				systemProgram: SystemProgram.programId,
			},
		})

		const res = await buildAndSendTx(connection, [wallet], [ix])

		expect(res.status).toBe('SUCCESS')

		const userPositionAi = await connection.getAccountInfo(userPositionAddress)
		const { bump: _userPositionBump, ...userPosition } = parseUserPositionAccount(
			surfProgram,
			userPositionAi.data,
		)

		expect(_userPositionBump).toBe(userPositionBump)

		Object.values(userPosition).forEach((v) => {
			typeof v === 'number' ? expect(v).toBe(0) : expect(v.toNumber()).toBe(0)
		})
	})
})
