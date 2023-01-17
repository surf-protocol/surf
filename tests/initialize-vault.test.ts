import { beforeAll, describe, expect, it } from 'vitest'
import { PDAUtil, ORCA_WHIRLPOOL_PROGRAM_ID } from '@orca-so/whirlpools-sdk'
import {
	ASSOCIATED_TOKEN_PROGRAM_ID,
	getAssociatedTokenAddressSync,
	TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'

import { wallet, connection, provider, program } from './utils/load-config.js'
import { airdrop } from './utils/airdrop.js'
import {
	initWhirlpool,
	DEFAULT_POOL_PRICE,
	getOpenPositionData,
	tokenAMint,
	tokenBMint,
} from './utils/whirlpool.js'
import { buildAndSendTx } from './utils/transaction.js'

describe('initialize_vault', () => {
	beforeAll(async () => {
		await airdrop(connection, wallet)
	})

	it('test', async () => {
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

		const ix = await program.methods
			.initializeVault(positionPDA.bump, tickLowerIndex, tickUpperIndex)
			.accounts({
				funder: wallet.publicKey,
				vault: vaultPDA,
				whirlpool: whirlpool,
				positionMint: positionMintKeyPair.publicKey,
				position: positionPDA.publicKey,
				positionTokenAccount: positionATA,
				tokenMintA: tokenAMint,
				tokenMintB: tokenBMint,
				tokenVaultA: tokenAVault,
				tokenVaultB: tokenBVault,

				whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
				rent: SYSVAR_RENT_PUBKEY,
			})
			.instruction()

		await buildAndSendTx(connection, [wallet, positionMintKeyPair], [ix])

		const vaultAccount = await program.account.vault.fetch(vaultPDA)

		expect(vaultAccount.tokenMintA.equals(tokenAMint)).toBe(true)
		expect(vaultAccount.tokenMintB.equals(tokenBMint)).toBe(true)
		expect(vaultAccount.tokenVaultA.equals(tokenAVault)).toBe(true)
		expect(vaultAccount.tokenVaultB.equals(tokenBVault)).toBe(true)
		expect(vaultAccount.whirlpool.equals(whirlpool)).toBe(true)
		expect(vaultAccount.whirlpoolPosition.equals(positionPDA.publicKey)).toBe(true)
	})
})
