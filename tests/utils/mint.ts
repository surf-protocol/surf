import { NATIVE_MINT, TOKEN_PROGRAM_ID, createInitializeMintInstruction } from '@solana/spl-token'
import { Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js'
import { connection, wallet } from './load-config.js'

import { buildAndSendTx } from './transaction.js'

export const usdcMintKeyPair = new Keypair()

const getSortedMints = (): [PublicKey, number][] => {
	const usdcMint = usdcMintKeyPair.publicKey
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

const [[tokenAMint, tokenADecimals], [tokenBMint, tokenBDecimals]] = getSortedMints()
export { tokenAMint, tokenADecimals, tokenBMint, tokenBDecimals }

console.log(`Token A mint: ${tokenAMint.toString()}\nToken B mint: ${tokenBMint.toString()}`)

const createUsdcMint = async () => {
	const ixs = [
		SystemProgram.createAccount({
			fromPubkey: wallet.publicKey,
			newAccountPubkey: usdcMintKeyPair.publicKey,
			space: 82,
			lamports: await connection.getMinimumBalanceForRentExemption(82),
			programId: TOKEN_PROGRAM_ID,
		}),
		createInitializeMintInstruction(
			usdcMintKeyPair.publicKey,
			tokenBDecimals,
			wallet.publicKey,
			PublicKey.default,
			TOKEN_PROGRAM_ID,
		),
	]
	await buildAndSendTx(connection, [wallet, usdcMintKeyPair], ixs)
}

await createUsdcMint()
