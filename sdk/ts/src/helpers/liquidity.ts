import BN from 'bn.js'

// The following code is referenced from orca-so whirlpools program
// https://github.com/orca-so/whirlpools/blob/c3a02ee3ed16843e110fa88e27d0d461e0964450/sdk/src/utils/position-util.ts#L167

const getSortedSqrtPrices = (sqrtPrice0: BN, sqrtPrice1: BN) => {
	return sqrtPrice0.lt(sqrtPrice1) ? [sqrtPrice0, sqrtPrice1] : [sqrtPrice1, sqrtPrice0]
}

export const getBaseTokenFromLiquidity = (
	liquidity: BN,
	sqrtPrice0: BN,
	sqrtPrice1: BN,
	deposit: boolean,
) => {
	const [lowerSqrtPrice, upperSqrtPrice] = getSortedSqrtPrices(sqrtPrice0, sqrtPrice1)

	const numerator = liquidity.mul(upperSqrtPrice.sub(lowerSqrtPrice)).shln(64)
	const denominator = upperSqrtPrice.mul(lowerSqrtPrice)
	if (deposit && !numerator.mod(denominator).eq(new BN(0))) {
		return numerator.div(denominator).add(new BN(1))
	} else {
		return numerator.div(denominator)
	}
}

const U64_MAX = new BN(2).pow(new BN(64)).sub(new BN(1))

export const getQuoteTokenFromLiquidity = (
	liquidity: BN,
	sqrtPrice0: BN,
	sqrtPrice1: BN,
	deposit: boolean,
) => {
	const [lowerSqrtPrice, upperSqrtPrice] = getSortedSqrtPrices(sqrtPrice0, sqrtPrice1)

	const result = liquidity.mul(upperSqrtPrice.sub(lowerSqrtPrice))
	const resultShifted = result.shrn(64)
	if (deposit && result.mod(U64_MAX).gt(new BN(0))) {
		return resultShifted.add(new BN(1))
	} else {
		return resultShifted
	}
}
