import { beforeAll, describe, expect, it } from 'vitest'
import { ORCA_WHIRLPOOL_PROGRAM_ID } from '@orca-so/whirlpools-sdk'
import {
	ASSOCIATED_TOKEN_PROGRAM_ID,
	getAssociatedTokenAddressSync,
	TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { ComputeBudgetProgram, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import BN from 'bn.js'

import { wallet, connection, provider, program } from './utils/load-config.js'
import { initWhirlpool, DEFAULT_POOL_PRICE, getOpenPositionData } from './utils/cpi/whirlpool.js'
import { buildAndSendTx } from './utils/transaction.js'
import { tokenAMint, tokenBMint, createUsdcMint } from './utils/mint.js'
import { DRIFT_PROGRAM_ID, fetchUserStats, initDrift } from './utils/cpi/drift.js'

describe.only('initialize_vault', () => {
	beforeAll(async () => {
		await createUsdcMint(connection, wallet)
	})

	it('test', async () => {
		// TODO: create helper
		const [adminConfigPDA] = PublicKey.findProgramAddressSync(
			[Buffer.from('admin_config', 'utf-8')],
			program.programId,
		)
		const initAdminConfigIx = await program.methods
			.initializeAdminConfig()
			.accounts({
				adminConfig: adminConfigPDA,
				admin: wallet.publicKey,
				systemProgram: SystemProgram.programId,
			})
			.instruction()
		await buildAndSendTx(connection, [wallet], [initAdminConfigIx])

		const { stateAccountAddress, driftProgram } = await initDrift()
		const { whirlpool } = await initWhirlpool(connection, wallet, provider)

		const [vaultPDA] = PublicKey.findProgramAddressSync(
			[Buffer.from('vault', 'utf-8'), whirlpool.toBuffer()],
			program.programId,
		)

		const [tokenAVault, tokenBVault] = [
			getAssociatedTokenAddressSync(tokenAMint, vaultPDA, true),
			getAssociatedTokenAddressSync(tokenBMint, vaultPDA, true),
		]

		const upperPrice = DEFAULT_POOL_PRICE * 1.05
		const lowerPrice = DEFAULT_POOL_PRICE * 0.95
		const { positionATA, positionMintKeyPair, positionPDA, tickLowerIndex, tickUpperIndex } =
			getOpenPositionData(vaultPDA, upperPrice, lowerPrice)

		const [userStatsPDA, userStatsBumps] = PublicKey.findProgramAddressSync(
			[Buffer.from('user_stats', 'utf-8'), adminConfigPDA.toBuffer()],
			DRIFT_PROGRAM_ID,
		)
		const userStatsAccount = await fetchUserStats(driftProgram, userStatsPDA)
		const userSubAccountId = userStatsAccount?.numberOfUsers || 0

		const [userPDA, userBump] = PublicKey.findProgramAddressSync(
			[
				Buffer.from('user', 'utf-8'),
				adminConfigPDA.toBuffer(),
				new BN(userSubAccountId).toArrayLike(Buffer, 'le', 2),
			],
			DRIFT_PROGRAM_ID,
		)

		const ix = await program.methods
			.initializeVault(
				{ position: positionPDA.bump, userStats: userStatsBumps, user: userBump },
				userSubAccountId,
				tickLowerIndex,
				tickUpperIndex,
			)
			.accounts({
				admin: wallet.publicKey,
				adminConfig: adminConfigPDA,
				vault: vaultPDA,
				whirlpool: whirlpool,
				positionMint: positionMintKeyPair.publicKey,
				position: positionPDA.publicKey,
				positionTokenAccount: positionATA,
				tokenMintA: tokenAMint,
				tokenMintB: tokenBMint,
				tokenVaultA: tokenAVault,
				tokenVaultB: tokenBVault,
				driftUserStats: userStatsPDA,
				driftUser: userPDA,
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
			[wallet, positionMintKeyPair],
			[ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), ix],
			true,
		)

		const vaultAccount = await program.account.vault.fetch(vaultPDA)

		expect(vaultAccount.tokenMintA.equals(tokenAMint)).toBe(true)
		expect(vaultAccount.tokenMintB.equals(tokenBMint)).toBe(true)
		expect(vaultAccount.tokenVaultA.equals(tokenAVault)).toBe(true)
		expect(vaultAccount.tokenVaultB.equals(tokenBVault)).toBe(true)
		expect(vaultAccount.whirlpool.equals(whirlpool)).toBe(true)
		expect(vaultAccount.whirlpoolPosition.equals(positionPDA.publicKey)).toBe(true)

		expect(vaultAccount.driftAccountStats.equals(userStatsPDA)).toBe(true)
		expect(vaultAccount.driftSubaccount.equals(userPDA)).toBe(true)
	})
})
