import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { NATIVE_MINT, TOKEN_PROGRAM_ID, createInitializeMintInstruction } from '@solana/spl-token'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'

import { connection, wallet } from './load-config.js'
import { buildAndSendTx } from './transaction.js'

export const quoteMintKeyPair = new Keypair()
export const quoteTokenUserATA = getAssociatedTokenAddressSync(
	quoteMintKeyPair.publicKey,
	wallet.publicKey,
)
export const baseTokenUserATA = getAssociatedTokenAddressSync(NATIVE_MINT, wallet.publicKey)

const getSortedMints = (): [PublicKey, number][] => {
	const usdcMint = quoteMintKeyPair.publicKey
	const usdcDecimals = 6

	if (Buffer.compare(NATIVE_MINT.toBuffer(), usdcMint.toBuffer()) < 0) {
		return [
			[NATIVE_MINT, 9],
			[usdcMint, usdcDecimals],
		]
	}
	return [
		[usdcMint, usdcDecimals],
		[NATIVE_MINT, 9],
	]
}

const [[baseTokenMint, baseTokenDecimals], [quoteTokenMint, quoteTokenDecimals]] = getSortedMints()
export { baseTokenMint, baseTokenDecimals, quoteTokenMint, quoteTokenDecimals }

export const initializeQuoteTokenMint = async () => {
	const ixs = [
		SystemProgram.createAccount({
			fromPubkey: wallet.publicKey,
			newAccountPubkey: quoteMintKeyPair.publicKey,
			space: 82,
			lamports: await connection.getMinimumBalanceForRentExemption(82),
			programId: TOKEN_PROGRAM_ID,
		}),
		createInitializeMintInstruction(
			quoteMintKeyPair.publicKey,
			quoteTokenDecimals,
			wallet.publicKey,
			PublicKey.default,
			TOKEN_PROGRAM_ID,
		),
	]
	await buildAndSendTx(connection, [wallet, quoteMintKeyPair], ixs)
}
