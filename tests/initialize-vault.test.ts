import { describe, expect, it } from 'vitest'
import { ORCA_WHIRLPOOL_PROGRAM_ID } from '@orca-so/whirlpools-sdk'
import {
	ASSOCIATED_TOKEN_PROGRAM_ID,
	getAssociatedTokenAddressSync,
	TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { ComputeBudgetProgram, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'

import { wallet, connection, provider, program } from './utils/load-config.js'
import { initWhirlpool } from './utils/cpi/whirlpool.js'
import { buildAndSendTx } from './utils/transaction.js'
import { tokenAMint, tokenBMint } from './utils/mint.js'
import { DRIFT_PROGRAM_ID, getDriftPDAccounts, initDrift } from './utils/cpi/drift.js'
import { initAdminIx } from './ix-utils.js'

describe('initialize_vault', () => {
	it('test', async () => {
		const { ix: initAdminConfigIx, adminConfigPDA } = await initAdminIx()
		await buildAndSendTx(connection, [wallet], [initAdminConfigIx])

		const { stateAccountAddress, driftProgram } = await initDrift()
		const { whirlpool } = await initWhirlpool(connection, wallet, provider)

		const [vaultPDA, vaultBump] = PublicKey.findProgramAddressSync(
			[Buffer.from('vault', 'utf-8'), whirlpool.toBuffer()],
			program.programId,
		)

		const [tokenAVault, tokenBVault] = [
			getAssociatedTokenAddressSync(tokenAMint, vaultPDA, true),
			getAssociatedTokenAddressSync(tokenBMint, vaultPDA, true),
		]

		const { userStatsPDA, userSubaccountPDA, userSubaccountId } = await getDriftPDAccounts(
			driftProgram,
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
				whirlpool: whirlpool,
				tokenMintA: tokenAMint,
				tokenMintB: tokenBMint,
				tokenVaultA: tokenAVault,
				tokenVaultB: tokenBVault,
				driftStats: userStatsPDA,
				driftSubaccount: userSubaccountPDA,
				driftState: stateAccountAddress,

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

		expect(vaultAccount.whirlpool.equals(whirlpool)).toBe(true)
		expect(vaultAccount.vaultPosition.equals(PublicKey.default)).toBe(true)

		expect(vaultAccount.tokenMintA.equals(tokenAMint)).toBe(true)
		expect(vaultAccount.tokenMintB.equals(tokenBMint)).toBe(true)
		expect(vaultAccount.tokenVaultA.equals(tokenAVault)).toBe(true)
		expect(vaultAccount.tokenVaultB.equals(tokenBVault)).toBe(true)

		expect(vaultAccount.driftStats.equals(userStatsPDA)).toBe(true)
		expect(vaultAccount.driftSubaccount.equals(userSubaccountPDA)).toBe(true)

		expect(vaultAccount.liquidity.toNumber()).toBe(0)
		expect(vaultAccount.totalFeeGrowthA.toNumber()).toBe(0)
		expect(vaultAccount.totalFeeGrowthB.toNumber()).toBe(0)
		expect(vaultAccount.feeUnclaimedA.toNumber()).toBe(0)
		expect(vaultAccount.feeUnclaimedB.toNumber()).toBe(0)

		expect(vaultAccount.fullTickRange).toBe(fullTickRange)
		expect(vaultAccount.vaultTickRange).toBe(vaultTickRange)
		expect(vaultAccount.hedgeTickRange).toBe(hedgeTickRange)
	})
})
