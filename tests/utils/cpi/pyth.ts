import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { parsePriceData } from '@pythnetwork/client'
import { expect } from 'vitest'
import BN from 'bn.js'

import { connection, provider, wallet, pythProgram } from '../load-config.js'
import { buildAndSendTx } from '../transaction'

// https://github.com/drift-labs/protocol-v2
export const createPriceFeed = async ({
	initPrice,
	confidence = undefined,
	expo = -4,
}: {
	initPrice: number
	confidence?: number
	expo?: number
}): Promise<PublicKey> => {
	const conf = new BN(confidence) || new BN((initPrice / 10) * 10 ** -expo)
	const collateralTokenFeed = new Keypair()
	const initIx = await pythProgram.methods
		.initialize(new BN(initPrice * 10 ** -expo), expo, conf)
		.accounts({
			price: collateralTokenFeed.publicKey,
		})
		.instruction()
	await buildAndSendTx(
		connection,
		[wallet, collateralTokenFeed],
		[
			SystemProgram.createAccount({
				fromPubkey: provider.wallet.publicKey,
				newAccountPubkey: collateralTokenFeed.publicKey,
				space: 3312,
				lamports: await provider.connection.getMinimumBalanceForRentExemption(3312),
				programId: pythProgram.programId,
			}),
			initIx,
		],
	)
	return collateralTokenFeed.publicKey
}

export const mockOracle = async (
	price: number = 50 * 10e7,
	expo = -7,
	confidence?: number,
): Promise<PublicKey> => {
	const priceFeedAddress = await createPriceFeed({
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

	return priceFeedAddress
}
