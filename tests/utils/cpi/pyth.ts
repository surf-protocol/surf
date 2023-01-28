import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { parsePriceData } from '@pythnetwork/client'
import { expect } from 'vitest'
import BN from 'bn.js'

import { connection, provider, wallet, pythProgram } from '../load-config.js'
import { buildAndSendTx } from '../transaction'

// https://github.com/drift-labs/protocol-v2
export const createPriceFeed = async ({
	keypair,
	initPrice,
	confidence = undefined,
	expo = -4,
}: {
	keypair: Keypair,
	initPrice: number
	confidence?: number
	expo?: number
}): Promise<PublicKey> => {
	const conf = new BN(confidence) || new BN((initPrice / 10) * 10 ** -expo)
	const initIx = await pythProgram.methods
		.initialize(new BN(initPrice * 10 ** -expo), expo, conf)
		.accounts({
			price: keypair.publicKey,
		})
		.instruction()
	await buildAndSendTx(
		connection,
		[wallet, keypair],
		[
			SystemProgram.createAccount({
				fromPubkey: provider.wallet.publicKey,
				newAccountPubkey: keypair.publicKey,
				space: 3312,
				lamports: await provider.connection.getMinimumBalanceForRentExemption(3312),
				programId: pythProgram.programId,
			}),
			initIx,
		],
	)
	return keypair.publicKey
}

export const mockOracle = async (
	keypair: Keypair,
	price: number = 50 * 10e7,
	expo = -7,
	confidence?: number,
) => {
	const priceFeedAddress = await createPriceFeed({
		keypair,
		initPrice: price,
		expo: expo,
		confidence,
	})

	const ai = await connection.getAccountInfo(priceFeedAddress)
	const feedData = parsePriceData(ai.data)

	if (feedData.price !== price) {
		console.log('mockOracle precision error:', feedData.price, '!=', price)
	}

	expect(Math.abs(feedData.price - price) < 1e-10).toBe(true)
}
