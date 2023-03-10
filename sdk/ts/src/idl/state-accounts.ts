import { PublicKey } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import BN from 'bn.js'

import { BorrowPosition, WhirlpoolAdjustmentState } from './types.js'
import { SurfIDL } from './surf-idl.js'

export type AdminConfigAccount = {
	adminKey: PublicKey
	bump: number
}

export const parseAdminConfigAccount = (program: Program<SurfIDL>, data: Buffer | null) => {
	if (!data) {
		return null
	}
	try {
		return program.coder.accounts.decode('AdminConfig', data) as AdminConfigAccount
	} catch {
		console.error('Account AdminConfig could not be parsed')
		return null
	}
}

export type HedgePositionAccount = {
	bump: number
	vaultState: PublicKey
	id: BN
	currentBorrowPositionIndex: number
	borrowPositions: BorrowPosition[]
}

export const parseHedgePositionAccount = (program: Program<SurfIDL>, data: Buffer | null) => {
	if (!data) {
		return null
	}
	try {
		return program.coder.accounts.decode('HedgePosition', data) as HedgePositionAccount
	} catch {
		console.error('Account HedgePosition could not be parsed')
		return null
	}
}

export type UserPositionAccount = {
	bump: number
	liquidity: BN
	feeGrowthCheckpointBaseToken: BN
	feeGrowthCheckpointQuoteToken: BN
	feeUnclaimedBaseToken: BN
	feeUnclaimedQuoteToken: BN
	collateralAmount: BN
	borrowAmount: BN
	borrowAmountNotional: BN
	collateralInterestGrowthCheckpoint: BN
	borrowInterestGrowthCheckpoint: BN
	collateralInterestUnclaimed: BN
	borrowInterestUnclaimed: BN
	whirlpoolPositionId: BN
	hedgePositionId: BN
	borrowPositionIndex: number
}

export const parseUserPositionAccount = (program: Program<SurfIDL>, data: Buffer | null) => {
	if (!data) {
		return null
	}
	try {
		return program.coder.accounts.decode('UserPosition', data) as UserPositionAccount
	} catch {
		console.error('Account UserPosition could not be parsed')
		return null
	}
}

export type VaultStateAccount = {
	bump: number[]
	whirlpool: PublicKey
	baseTokenMint: PublicKey
	quoteTokenMint: PublicKey
	baseTokenAccount: PublicKey
	quoteTokenAccount: PublicKey
	fullTickRange: number
	vaultTickRange: number
	hedgeTickRange: number
	whirlpoolPositionsCount: BN
	currentWhirlpoolPositionId: BN | null
	whirlpoolAdjustmentState: WhirlpoolAdjustmentState
	driftStats: PublicKey
	driftSubaccount: PublicKey
	collateralAmount: BN
	collateralInterestGrowth: BN
	collateralInterestGrowthCheckpoint: BN
	hedgePositionsCount: BN
	currentHedgePositionId: BN | null
	lastHedgeAdjustmentTick: number | null
}

export const parseVaultStateAccount = (program: Program<SurfIDL>, data: Buffer | null) => {
	if (!data) {
		return null
	}
	try {
		return program.coder.accounts.decode('VaultState', data) as VaultStateAccount
	} catch {
		console.error('Account VaultState could not be parsed')
		return null
	}
}

export type WhirlpoolPositionAccount = {
	bump: number
	vaultState: PublicKey
	id: BN
	whirlpoolPosition: PublicKey
	liquidity: BN
	liquidityDiff: BN
	baseTokenFeeGrowth: BN
	quoteTokenFeeGrowth: BN
	upperSqrtPrice: BN
	lowerSqrtPrice: BN
	middleSqrtPrice: BN
	innerUpperSqrtPrice: BN
	innerLowerSqrtPrice: BN
}

export const parseWhirlpoolPositionAccount = (program: Program<SurfIDL>, data: Buffer | null) => {
	if (!data) {
		return null
	}
	try {
		return program.coder.accounts.decode('WhirlpoolPosition', data) as WhirlpoolPositionAccount
	} catch {
		console.error('Account WhirlpoolPosition could not be parsed')
		return null
	}
}
