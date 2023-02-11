import { beforeAll, describe, expect, it } from 'vitest'
import { ORCA_WHIRLPOOL_PROGRAM_ID } from '@orca-so/whirlpools-sdk'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { UserAccount, UserStatsAccount } from '@drift-labs/sdk'
import { ComputeBudgetProgram, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'

import { wallet, connection, program } from './utils/load-config.js'
import { initWhirlpool } from './utils/cpi/whirlpool.js'
import { buildAndSendTx } from './utils/transaction.js'
import { baseTokenMint, quoteTokenMint } from './utils/mint.js'
import { mockDrift, driftStateKey, driftProgram } from './utils/cpi/drift.js'
import {
	getVaultProgramAddress,
	getVaultTokenAccountsAddresses,
	getVaultDriftAccountsAddresses,
} from '../sdk/ts/src/pda.js'
import { buildInitializeVaultIx } from '../sdk/ts/src/idl/instructions.js'
import { parseVaultAccount } from '../sdk/ts/src/idl/state-accounts.js'
import { mockAdminConfig } from './utils/mock.js'
import { DRIFT_PROGRAM_ID_MAINNET } from '../sdk/ts/src/constants.js'

describe('initialize_vault', async () => {
	let adminConfigPDA: PublicKey

	beforeAll(async () => {
		adminConfigPDA = await mockAdminConfig()
		await mockDrift()
	})

	it('successfully initializes vault', async () => {
		const { whirlpoolKey } = await initWhirlpool()

		const [vaultPDA, vaultBump] = getVaultProgramAddress(whirlpoolKey)
		const [vaultBaseTokenAccount, vaultQuoteTokenAccount] = getVaultTokenAccountsAddresses(
			vaultPDA,
			baseTokenMint,
			quoteTokenMint,
		)
		const { driftStats, driftSubaccount } = getVaultDriftAccountsAddresses(vaultPDA)

		const fullTickRange = 800 // 8%
		const vaultTickRange = 400 // 4%
		const hedgeTickRange = 20 // 0.2% - 10 times per one side of vault range

		const ix = await buildInitializeVaultIx(program, {
			args: {
				fullTickRange,
				vaultTickRange,
				hedgeTickRange,
			},
			accounts: {
				admin: wallet.publicKey,
				adminConfig: adminConfigPDA,
				whirlpool: whirlpoolKey,
				vault: vaultPDA,
				baseTokenMint,
				quoteTokenMint,
				vaultBaseTokenAccount,
				vaultQuoteTokenAccount,

				driftStats,
				driftSubaccount,
				driftState: driftStateKey,

				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
				driftProgram: DRIFT_PROGRAM_ID_MAINNET,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
				rent: SYSVAR_RENT_PUBKEY,
			},
		})

		await buildAndSendTx(
			connection,
			[wallet],
			[ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), ix],
		)

		const vaultAccountInfo = await connection.getAccountInfo(vaultPDA)
		const vaultAccount = parseVaultAccount(program, vaultAccountInfo.data)

		expect(vaultAccount.bump).toBe(vaultBump)
		expect(vaultAccount.whirlpool.equals(whirlpoolKey)).toBe(true)

		expect(vaultAccount.baseTokenMint.equals(baseTokenMint)).toBe(true)
		expect(vaultAccount.quoteTokenMint.equals(quoteTokenMint)).toBe(true)
		expect(vaultAccount.baseTokenAccount.equals(vaultBaseTokenAccount)).toBe(true)
		expect(vaultAccount.quoteTokenAccount.equals(vaultQuoteTokenAccount)).toBe(true)

		expect(vaultAccount.driftStats.equals(driftStats)).toBe(true)
		expect(vaultAccount.driftSubaccount.equals(driftSubaccount)).toBe(true)

		expect(vaultAccount.fullTickRange).toBe(fullTickRange)
		expect(vaultAccount.vaultTickRange).toBe(vaultTickRange)
		expect(vaultAccount.hedgeTickRange).toBe(hedgeTickRange)

		expect(vaultAccount.isActive).toBe(false)
		expect(vaultAccount.vaultPositionsCount.toNumber()).toBe(0)
		expect(vaultAccount.currentVaultPositionId).toBe(null)

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		const [driftSubaccountData, driftStatsData] = await Promise.all([
			driftProgram.account['user'].fetch(driftSubaccount, 'confirmed') as Promise<UserAccount>,
			driftProgram.account['userStats'].fetch(driftStats, 'confirmed') as Promise<UserStatsAccount>,
		])

		expect(driftStatsData.authority.equals(vaultPDA)).toBe(true)
		expect(driftSubaccountData.authority.equals(driftStatsData.authority)).toBe(true)
	})
})
