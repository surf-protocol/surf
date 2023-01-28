import { Connection, Signer, TransactionInstruction } from '@solana/web3.js'
import { buildAndSignTxFromInstructions, sendAndConfirmTransaction } from 'solana-tx-utils'

export const buildAndSendTx = async (
	connection: Connection,
	signers: Signer[],
	instructions: TransactionInstruction[],
	log = false,
) => {
	const txData = await buildAndSignTxFromInstructions(
		{
			payerKey: signers[0].publicKey,
			signers,
			instructions,
		},
		connection,
	)
	const res = await sendAndConfirmTransaction(
		{
			...txData,
			connection,
		},
		{ log },
	)
	return res
}
