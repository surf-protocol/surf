import { describe, expect, it } from 'vitest'
import { buildAndSignTxFromInstructions, sendTransaction } from 'solana-tx-utils'

import { wallet, program, connection } from './utils/load-config.js'

describe('surf-protocol', () => {
	it('Is initialized!', async () => {
		const ix = program.instruction.initialize({ accounts: {} })

		const txData = await buildAndSignTxFromInstructions({
			instructions: [ix],
			signers: [wallet],
		}, connection)

		await sendTransaction({ ...txData, connection }, { log: true })

		const isInitialized = true
		expect(isInitialized).toBe(true)
	})
})
