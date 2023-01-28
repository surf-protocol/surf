import { describe, expect, it } from 'vitest'
import { ORCA_WHIRLPOOL_PROGRAM_ID } from '@orca-so/whirlpools-sdk'
import {
	ASSOCIATED_TOKEN_PROGRAM_ID,
	getAssociatedTokenAddressSync,
	TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { UserAccount, UserStatsAccount } from '@drift-labs/sdk'
import { ComputeBudgetProgram, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'

import { wallet, connection, program } from './utils/load-config.js'
import { initWhirlpool } from './utils/cpi/whirlpool.js'
import { buildAndSendTx } from './utils/transaction.js'
import { baseTokenMint, quoteTokenMint } from './utils/mint.js'
import {
	DRIFT_PROGRAM_ID,
	getDriftPDAccounts,
	initDrift,
	driftStateKey,
	driftProgram,
} from './utils/cpi/drift.js'
import { initAdminIx } from './ix-utils.js'

describe('initialize_vault', () => {
	it('test', async () => {
		const { ix: initAdminConfigIx, adminConfigPDA } = await initAdminIx()
		await buildAndSendTx(connection, [wallet], [initAdminConfigIx])

		await initDrift()
		const { whirlpoolKey } = await initWhirlpool()

		const [vaultPDA, vaultBump] = PublicKey.findProgramAddressSync(
			[Buffer.from('vault', 'utf-8'), whirlpoolKey.toBuffer()],
			program.programId,
		)

		const [tokenAVault, tokenBVault] = [
			getAssociatedTokenAddressSync(baseTokenMint, vaultPDA, true),
			getAssociatedTokenAddressSync(quoteTokenMint, vaultPDA, true),
		]

		const { userStatsPDA, userSubaccountPDA, userSubaccountId } = await getDriftPDAccounts(
			adminConfigPDA,
		)

		const fullTickRange = 800 // 8%
		const vaultTickRange = 400 // 4%
		const hedgeTickRange = 20 // 0.2% - 10 times per one side of vault range

		const ix = await program.methods
			.initializeVault(userSubaccountId, fullTickRange, vaultTickRange, hedgeTickRange)
			.accountsStrict({
				admin: wallet.publicKey,
				adminConfig: adminConfigPDA,
				vault: vaultPDA,
				whirlpool: whirlpoolKey,
				tokenMintA: baseTokenMint,
				tokenMintB: quoteTokenMint,
				tokenVaultA: tokenAVault,
				tokenVaultB: tokenBVault,
				driftStats: userStatsPDA,
				driftSubaccount: userSubaccountPDA,
				driftState: driftStateKey,

				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
				driftProgram: DRIFT_PROGRAM_ID,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
				rent: SYSVAR_RENT_PUBKEY,
			})
			.instruction()

		await buildAndSendTx(
			connection,
			[wallet],
			[ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), ix],
		)

		const vaultAccount = await program.account.vault.fetchNullable(vaultPDA)

		expect(vaultAccount.bump).toBe(vaultBump)

		expect(vaultAccount.whirlpool.equals(whirlpoolKey)).toBe(true)

		expect(vaultAccount.baseTokenMint.equals(baseTokenMint)).toBe(true)
		expect(vaultAccount.quoteTokenMint.equals(quoteTokenMint)).toBe(true)
		expect(vaultAccount.baseTokenVault.equals(tokenAVault)).toBe(true)
		expect(vaultAccount.quoteTokenVault.equals(tokenBVault)).toBe(true)

		expect(vaultAccount.driftStats.equals(userStatsPDA)).toBe(true)
		expect(vaultAccount.driftSubaccount.equals(userSubaccountPDA)).toBe(true)

		expect(vaultAccount.liquidity.toNumber()).toBe(0)
		expect(vaultAccount.baseTokenTotalFeeGrowth.toNumber()).toBe(0)
		expect(vaultAccount.quoteTokenTotalFeeGrowth.toNumber()).toBe(0)
		expect(vaultAccount.baseTokenFeeUnclaimed.toNumber()).toBe(0)
		expect(vaultAccount.quoteTokenFeeUnclaimed.toNumber()).toBe(0)

		expect(vaultAccount.fullTickRange).toBe(fullTickRange)
		expect(vaultAccount.vaultTickRange).toBe(vaultTickRange)
		expect(vaultAccount.hedgeTickRange).toBe(hedgeTickRange)

		expect(vaultAccount.isActive).toBe(false)
		expect(vaultAccount.whirlpoolPosition.equals(PublicKey.default)).toBe(true)
		expect(vaultAccount.vaultUpperTickIndex).toBe(0)
		expect(vaultAccount.vaultLowerTickIndex).toBe(0)
		expect(vaultAccount.lastHedgeAdjustmentTickIndex).toBe(0)

		// @ts-ignore
		const [driftSubaccount, driftStats] = await Promise.all([
			driftProgram.account['user'].fetch(userSubaccountPDA, 'confirmed') as Promise<UserAccount>,
			driftProgram.account['userStats'].fetch(
				userStatsPDA,
				'confirmed',
			) as Promise<UserStatsAccount>,
		])

		expect(driftStats.authority.equals(adminConfigPDA)).toBe(true)
		expect(driftSubaccount.authority.equals(driftStats.authority)).toBe(true)
		expect(driftSubaccount.delegate.equals(vaultPDA)).toBe(true)
	})
})
