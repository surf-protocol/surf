import { PublicKey, SystemProgram } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'

import { initAdminIx } from './ix-utils.js'
import { wallet, program, connection } from './utils/load-config.js'
import { buildAndSendTx } from './utils/transaction.js'

describe('initialize_admin_config', () => {
	it('fails with invalid admin config PDA', async () => {
		const [adminConfigPDA] = PublicKey.findProgramAddressSync(
			[Buffer.from('123', 'utf-8')],
			program.programId,
		)

		const ix = await program.methods
			.initializeAdminConfig()
			.accounts({
				adminConfig: adminConfigPDA,
				admin: wallet.publicKey,
				systemProgram: SystemProgram.programId,
			})
			.instruction()
		const res = await buildAndSendTx(connection, [wallet], [ix])

		expect(res.error.error).toBe('PrivilegeEscalation')
	})

	it('creates admin config', async () => {
		const { adminConfigPDA, ix } = await initAdminIx()

		await buildAndSendTx(connection, [wallet], [ix])

		const adminConfigAccount = await program.account.adminConfig.fetchNullable(adminConfigPDA)
		expect(adminConfigAccount?.adminKey.equals(wallet.publicKey)).toBe(true)
	})

	it('fails to create if admin config is already created', async () => {
		const { ix } = await initAdminIx()

		const res = await buildAndSendTx(connection, [wallet], [ix])

		expect(res.status).toBe('ERROR')
		expect(res.error.error).toBe(0)
	})
})
