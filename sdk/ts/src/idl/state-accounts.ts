import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

export type AdminConfigAccount = {
	adminKey: PublicKey
	bump: number
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

export type VaultAccount = {
	bump: number
	whirlpool: PublicKey
	baseTokenMint: PublicKey
	baseTokenVault: PublicKey
	quoteTokenMint: PublicKey
	quoteTokenVault: PublicKey
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
