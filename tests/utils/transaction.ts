import { Connection, Keypair, Signer, TransactionInstruction } from '@solana/web3.js'
import { buildAndSignTxFromInstructions, sendTransaction } from 'solana-tx-utils'

export const buildAndSendTx = async (
	connection: Connection,
	signers: Signer[],
	instructions: TransactionInstruction[],
) => {
	const txData = await buildAndSignTxFromInstructions(
		{
			payerKey: signers[0].publicKey,
			signers,
			instructions,
		},
		connection,
	)
	const res = await sendTransaction(
		{
			...txData,
			connection,
		},
		{ log: true },
	)
	return res
}
