import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import { expect } from 'vitest'
import BN from 'bn.js'

import { connection, provider, wallet } from '../load-config.js'
import { buildAndSendTx } from '../transaction.js'
import { pythIdl } from './pyth-idl.js'

const PYTH_PROGRAM_ID = new PublicKey('FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH')

const pythProgram = new Program(pythIdl, PYTH_PROGRAM_ID)

// https://github.com/drift-labs/protocol-v2
export const createPriceFeed = async ({
	keypair,
	initPrice,
	confidence = undefined,
	expo = -4,
}: {
	keypair: Keypair
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

const empty32Buffer = Buffer.alloc(32)
const PKorNull = (data: Buffer) => (data.equals(empty32Buffer) ? null : new PublicKey(data))

const parsePriceInfo = (data: Buffer, exponent: number) => {
	// Aggregate price.
	const priceComponent = data.readBigUInt64LE(0)
	const price = Number(priceComponent) * 10 ** exponent
	// Aggregate confidence.
	const confidenceComponent = data.readBigUInt64LE(8)
	const confidence = Number(confidenceComponent) * 10 ** exponent
	// Aggregate status.
	const status = data.readUInt32LE(16)
	// Aggregate corporate action.
	const corporateAction = data.readUInt32LE(20)
	// Aggregate publish slot.
	const publishSlot = data.readBigUInt64LE(24)
	return {
		priceComponent,
		price,
		confidenceComponent,
		confidence,
		status,
		corporateAction,
		publishSlot,
	}
}

const parsePriceData = (data: Buffer) => {
	// Pyth magic number.
	const magic = data.readUInt32LE(0)
	// Program version.
	const version = data.readUInt32LE(4)
	// Account type.
	const type = data.readUInt32LE(8)
	// Price account size.
	const size = data.readUInt32LE(12)
	// Price or calculation type.
	const priceType = data.readUInt32LE(16)
	// Price exponent.
	const exponent = data.readInt32LE(20)
	// Number of component prices.
	const numComponentPrices = data.readUInt32LE(24)
	// unused
	// const unused = accountInfo.data.readUInt32LE(28)
	// Currently accumulating price slot.
	const currentSlot = data.readBigUInt64LE(32)
	// Valid on-chain slot of aggregate price.
	const validSlot = data.readBigUInt64LE(40)
	// Time-weighted average price.
	const twapComponent = data.readBigInt64LE(48)
	const twap = Number(twapComponent) * 10 ** exponent
	// Annualized price volatility.
	const avolComponent = data.readBigUInt64LE(56)
	const avol = Number(avolComponent) * 10 ** exponent
	// Space for future derived values.
	const drv0Component = data.readBigInt64LE(64)
	const drv0 = Number(drv0Component) * 10 ** exponent
	const drv1Component = data.readBigInt64LE(72)
	const drv1 = Number(drv1Component) * 10 ** exponent
	const drv2Component = data.readBigInt64LE(80)
	const drv2 = Number(drv2Component) * 10 ** exponent
	const drv3Component = data.readBigInt64LE(88)
	const drv3 = Number(drv3Component) * 10 ** exponent
	const drv4Component = data.readBigInt64LE(96)
	const drv4 = Number(drv4Component) * 10 ** exponent
	const drv5Component = data.readBigInt64LE(104)
	const drv5 = Number(drv5Component) * 10 ** exponent
	// Product id / reference account.
	const productAccountKey = new PublicKey(data.slice(112, 144))
	// Next price account in list.
	const nextPriceAccountKey = PKorNull(data.slice(144, 176))
	// Aggregate price updater.
	const aggregatePriceUpdaterAccountKey = new PublicKey(data.slice(176, 208))
	const aggregatePriceInfo = parsePriceInfo(data.slice(208, 240), exponent)
	// Price components - up to 32.
	const priceComponents = []
	let offset = 240
	let shouldContinue = true
	while (offset < data.length && shouldContinue) {
		const publisher = PKorNull(data.slice(offset, offset + 32))
		offset += 32
		if (publisher) {
			const aggregate = parsePriceInfo(data.slice(offset, offset + 32), exponent)
			offset += 32
			const latest = parsePriceInfo(data.slice(offset, offset + 32), exponent)
			offset += 32
			priceComponents.push({ publisher, aggregate, latest })
		} else {
			shouldContinue = false
		}
	}
	return Object.assign(
		Object.assign(
			{
				magic,
				version,
				type,
				size,
				priceType,
				exponent,
				numComponentPrices,
				currentSlot,
				validSlot,
				twapComponent,
				twap,
				avolComponent,
				avol,
				drv0Component,
				drv0,
				drv1Component,
				drv1,
				drv2Component,
				drv2,
				drv3Component,
				drv3,
				drv4Component,
				drv4,
				drv5Component,
				drv5,
				productAccountKey,
				nextPriceAccountKey,
				aggregatePriceUpdaterAccountKey,
			},
			aggregatePriceInfo,
		),
		{ priceComponents },
	)
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
	// TODO: Parse based on drift repo
	const feedData = parsePriceData(ai.data)

	if (feedData.price !== price) {
		console.log('mockOracle precision error:', feedData.price, '!=', price)
	}

	expect(Math.abs(feedData.price - price) < 1e-10).toBe(true)
}
