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
	feeGrowthCheckpointBaseToken: BN
	feeGrowthCheckpointQuoteToken: BN
	feeUnclaimedBaseToken: BN
	feeUnclaimedQuoteToken: BN
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

export type VaultAccount = {
	bump: number
	whirlpool: PublicKey
	baseTokenMint: PublicKey
	baseTokenAccount: PublicKey
	quoteTokenMint: PublicKey
	quoteTokenAccount: PublicKey
	driftStats: PublicKey
	driftSubaccount: PublicKey
	liquidity: BN
	baseTokenTotalFeeGrowth: BN
	quoteTokenTotalFeeGrowth: BN
	baseTokenFeeUnclaimed: BN
	quoteTokenFeeUnclaimed: BN
	fullTickRange: number
	vaultTickRange: number
	hedgeTickRange: number
	isActive: boolean
	whirlpoolPosition: PublicKey
	vaultUpperTickIndex: number
	vaultLowerTickIndex: number
	lastHedgeAdjustmentTickIndex: number
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
