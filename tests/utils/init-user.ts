import {
	createMintToInstruction,
	createSyncNativeInstruction,
	NATIVE_MINT,
	createAssociatedTokenAccountInstruction,
} from '@solana/spl-token'
import { LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js'
import { confirmTransaction } from 'solana-tx-utils'

import { connection, wallet } from './load-config'
import {
	baseTokenUserATA,
	initializeQuoteTokenMint,
	quoteMintKeyPair,
	quoteTokenDecimals,
	quoteTokenUserATA,
} from './mint'
import { buildAndSendTx } from './transaction'

export const userAirdropSOL = async () => {
	const { lastValidBlockHeight } = await connection.getLatestBlockhash()
	const txId = await connection.requestAirdrop(wallet.publicKey, 1_000_000 * LAMPORTS_PER_SOL)
	await confirmTransaction({
		txId,
		connection,
		lastValidBlockHeight,
		commitment: 'confirmed',
	})
}

export const initializeUserATAs = async () => {
	const ixs = [
		createAssociatedTokenAccountInstruction(
			wallet.publicKey,
			quoteTokenUserATA,
			wallet.publicKey,
			quoteMintKeyPair.publicKey,
		),
		createAssociatedTokenAccountInstruction(
			wallet.publicKey,
			baseTokenUserATA,
			wallet.publicKey,
			NATIVE_MINT,
		),
	]
	await buildAndSendTx(connection, [wallet], ixs)
}

export const userAirdropTokens = async () => {
	const ixs = [
		createMintToInstruction(
			quoteMintKeyPair.publicKey,
			quoteTokenUserATA,
			wallet.publicKey,
			1_000_000_000n * 10n ** BigInt(quoteTokenDecimals),
		),
		SystemProgram.transfer({
			fromPubkey: wallet.publicKey,
			toPubkey: baseTokenUserATA,
			lamports: 100_000 * LAMPORTS_PER_SOL,
		}),
		createSyncNativeInstruction(baseTokenUserATA),
	]
	await buildAndSendTx(connection, [wallet], ixs)
}

export const initUser = async () => {
	await Promise.all([userAirdropSOL(), initializeQuoteTokenMint()])

	await initializeUserATAs()
	await userAirdropTokens()
}
