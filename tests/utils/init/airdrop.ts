import {
	createMintToInstruction,
	createSyncNativeInstruction,
	NATIVE_MINT,
	createAssociatedTokenAccountInstruction,
} from '@solana/spl-token'
import { LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js'
import { confirmTransaction } from 'solana-tx-utils'

import { connection, wallet } from '../load-config.js'
import { baseTokenATA, quoteTokenATA, quoteMintKeyPair } from '../mint.js'
import { buildAndSendTx } from '../transaction.js'

console.log('Airdropping SOL')
const { lastValidBlockHeight } = await connection.getLatestBlockhash()
const txId = await connection.requestAirdrop(wallet.publicKey, 1_000_000 * LAMPORTS_PER_SOL)
await confirmTransaction({
	txId,
	connection,
	lastValidBlockHeight,
	commitment: 'confirmed',
})

console.log('Airdropping base and quote tokens')
const solATA = await connection.getAccountInfo(baseTokenATA)
const airdropIxs = [
	createAssociatedTokenAccountInstruction(
		wallet.publicKey,
		quoteTokenATA,
		wallet.publicKey,
		quoteMintKeyPair.publicKey,
	),
	createMintToInstruction(
		quoteMintKeyPair.publicKey,
		quoteTokenATA,
		wallet.publicKey,
		1_000_000_000n * 10n ** 6n,
	),
	solATA?.data
		? null
		: createAssociatedTokenAccountInstruction(
				wallet.publicKey,
				baseTokenATA,
				wallet.publicKey,
				NATIVE_MINT,
		  ),
	SystemProgram.transfer({
		fromPubkey: wallet.publicKey,
		toPubkey: baseTokenATA,
		lamports: 100_000 * LAMPORTS_PER_SOL,
	}),
	createSyncNativeInstruction(baseTokenATA),
]
await buildAndSendTx(connection, [wallet], airdropIxs.filter(Boolean))
