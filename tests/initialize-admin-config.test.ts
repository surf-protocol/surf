import { PublicKey, SystemProgram } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'

import { buildInitializeAdminConfigIx } from '../sdk/ts/src/idl/instructions'
import { parseAdminConfigAccount } from '../sdk/ts/src/idl/state-accounts'
import { getAdminConfigProgramAddress } from '../sdk/ts/src/pda'
import { wallet, surfProgram, connection } from './utils/load-config'
import { buildAndSendTx } from './utils/transaction'

describe('initialize_admin_config', () => {
	it('fails with invalid admin config PDA', async () => {
		const [adminConfigPDA] = PublicKey.findProgramAddressSync(
			[Buffer.from('123', 'utf-8')],
			surfProgram.programId,
		)

		const ix = await buildInitializeAdminConfigIx(surfProgram, {
			accounts: {
				adminConfig: adminConfigPDA,
				admin: wallet.publicKey,
				systemProgram: SystemProgram.programId,
			},
		})

		const res = await buildAndSendTx(connection, [wallet], [ix])

		expect(res.error.error).toBe('PrivilegeEscalation')
	})

	it('creates admin config', async () => {
		const [adminConfigPDA] = getAdminConfigProgramAddress()
		const ix = await buildInitializeAdminConfigIx(surfProgram, {
			accounts: {
				adminConfig: adminConfigPDA,
				admin: wallet.publicKey,
				systemProgram: SystemProgram.programId,
			},
		})

		await buildAndSendTx(connection, [wallet], [ix])

		const adminConfigAI = await connection.getAccountInfo(adminConfigPDA)
		const adminConfigData = parseAdminConfigAccount(surfProgram, adminConfigAI.data)

		expect(adminConfigData?.adminKey.equals(wallet.publicKey)).toBe(true)
	})

	it('fails to create if admin config is already created', async () => {
		const [adminConfigPDA] = getAdminConfigProgramAddress()
		const ix = await buildInitializeAdminConfigIx(surfProgram, {
			accounts: {
				adminConfig: adminConfigPDA,
				admin: wallet.publicKey,
				systemProgram: SystemProgram.programId,
			},
		})

		const res = await buildAndSendTx(connection, [wallet], [ix])

		expect(res.status).toBe('ERROR')
		expect(res.error.error).toBe(0)
	})
})
