import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PriceMath, TickUtil } from '@orca-so/whirlpools-sdk'
import { PublicKey } from '@solana/web3.js'

export const getTickBoundaries = (tickRange: number, middleTickIndex: number) => {
	const tickRangeSection = tickRange / 2
	const upperTickIndex = middleTickIndex + tickRangeSection
	const lowerTickIndex = middleTickIndex - tickRangeSection
	return { upperTickIndex, lowerTickIndex }
}

export const getFullRangeBoundaries = (
	whirlpoolTickRange: number,
	middleTickIndex: number,
	tickSpacing: number,
) => {
	const { upperTickIndex, lowerTickIndex } = getTickBoundaries(
		whirlpoolTickRange,
		middleTickIndex,
	)
	const upperTickInitializable = TickUtil.getInitializableTickIndex(upperTickIndex, tickSpacing)
	const lowerTickInitializable = TickUtil.getInitializableTickIndex(lowerTickIndex, tickSpacing)

	return {
		upperTickInitializable,
		lowerTickInitializable,
		upperSqrtPrice: PriceMath.tickIndexToSqrtPriceX64(upperTickInitializable),
		lowerSqrtPrice: PriceMath.tickIndexToSqrtPriceX64(lowerTickInitializable),
	}
}

export const getInnerRangeBoundaries = (innerTickRange: number, middleTickIndex: number) => {
	const { upperTickIndex, lowerTickIndex } = getTickBoundaries(innerTickRange, middleTickIndex)
	return {
		upperTickIndex,
		lowerTickIndex,
		upperSqrtPrice: PriceMath.tickIndexToSqrtPriceX64(upperTickIndex),
		lowerSqrtPrice: PriceMath.tickIndexToSqrtPriceX64(lowerTickIndex),
	}
}

export type TickIndexes = {
	upperTickIndex: number
	lowerTickIndex: number
}

export const getTickArraysAddresses = (
	{ upperTickIndex, lowerTickIndex }: TickIndexes,
	tickSpacing: number,
	whirlpoolAddress: PublicKey,
) => {
	const [upperTickArrayAddress, lowerTickArrayAddress] = [upperTickIndex, lowerTickIndex].map(
		(ti) => {
			const startTickIndex = TickUtil.getStartTickIndex(ti, tickSpacing)
			return PDAUtil.getTickArray(ORCA_WHIRLPOOL_PROGRAM_ID, whirlpoolAddress, startTickIndex)
				.publicKey
		},
	)

	return {
		upperTickArrayAddress,
		lowerTickArrayAddress,
	}
}
