import { PublicKey } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import BN from 'bn.js'

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

export type UserPositionAccount = {
	bump: number
	vault: PublicKey
	liquidity: BN
	isHedged: boolean
	collateralQuoteAmount: BN
	borrowBaseAmount: BN
	vaultPositionCheckpoint: BN
	feeGrowthCheckpointBaseToken: BN
	feeGrowthCheckpointQuoteToken: BN
	hedgeAdjustmentLossCheckpointBaseToken: BN
	hedgeAdjustmentLossCheckpointQuoteToken: BN
	feeUnclaimedBaseToken: BN
	feeUnclaimedQuoteToken: BN
	hedgeLossUnclaimedBaseToken: BN
	hedgeLossUnclaimedQuoteToken: BN
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

export type VaultPositionAccount = {
	bump: number
	vault: PublicKey
	whirlpoolPosition: PublicKey
	id: BN
	isClosed: boolean
	liquidity: BN
	closeSqrtPrice: BN | null
	upperSqrtPrice: BN
	lowerSqrtPrice: BN
	feeGrowthBaseToken: BN
	feeGrowthQuoteToken: BN
	rangeAdjustmentLiquidityDiff: BN
	hedgeAdjustmentLossBaseToken: BN
	hedgeAdjustmentLossQuoteToken: BN
	vaultUpperTickIndex: number
	vaultLowerTickIndex: number
	lastHedgeAdjustmentTickIndex: number | null
}

export const parseVaultPositionAccount = (program: Program<SurfIDL>, data: Buffer | null) => {
	if (!data) {
		return null
	}
	try {
		return program.coder.accounts.decode('VaultPosition', data) as VaultPositionAccount
	} catch {
		console.error('Account VaultPosition could not be parsed')
		return null
	}
}

export type VaultAccount = {
	bump: number
	whirlpool: PublicKey
	baseTokenMint: PublicKey
	baseTokenAccount: PublicKey
	quoteTokenMint: PublicKey
	quoteTokenAccount: PublicKey
	driftStats: PublicKey
	driftSubaccount: PublicKey
	isActive: boolean
	vaultPositionsCount: BN
	currentVaultPositionId: BN | null
	fullTickRange: number
	vaultTickRange: number
	hedgeTickRange: number
}

export const parseVaultAccount = (program: Program<SurfIDL>, data: Buffer | null) => {
	if (!data) {
		return null
	}
	try {
		return program.coder.accounts.decode('Vault', data) as VaultAccount
	} catch {
		console.error('Account Vault could not be parsed')
		return null
	}
}
