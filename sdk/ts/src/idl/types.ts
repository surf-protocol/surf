/* eslint-disable no-use-before-define */
import BN from 'bn.js'

export type BorrowPosition = {
	borrowedAmount: BN
	borrowedAmountDiff: BN
	borrowedAmountNotional: BN
	borrowedAmountNotionalDiff: BN
	borrowInterestGrowth: BN
	borrowInterestGrowthCheckpoint: BN
}

export type WhirlpoolAdjustmentState = {
	none: Record<string, never>
	above: Record<string, never>
	below: Record<string, never>
}

export type DriftMarket = {
	collateral: Record<string, never>
	borrow: Record<string, never>
}
