import {
	TestClient,
	BulkAccountLoader,
	OracleSource,
	QUOTE_PRECISION,
	SPOT_MARKET_RATE_PRECISION,
	SPOT_MARKET_WEIGHT_PRECISION,
	getSpotMarketPublicKey,
	getSpotMarketVaultPublicKey,
} from '@drift-labs/sdk'
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import BN from 'bn.js'

import { mockOracle } from './pyth.js'
import { connection, provider, wallet } from '../load-config.js'
import { baseTokenATA, baseTokenMint, quoteMintKeyPair } from '../mint.js'
import { DriftIdl } from './drift-idl.js'
import { DRIFT_PROGRAM_ID_MAINNET } from '../../../sdk/ts/src/constants.js'

const quoteMint = quoteMintKeyPair.publicKey

const baseTokenOracleMint = new Keypair()
export const driftOracle = baseTokenOracleMint.publicKey

const adminClient = new TestClient({
	connection,
	wallet: provider.wallet,
	programID: DRIFT_PROGRAM_ID_MAINNET,
	activeSubAccountId: 0,
	perpMarketIndexes: [0],
	spotMarketIndexes: [0],
	oracleInfos: [{ publicKey: baseTokenOracleMint.publicKey, source: OracleSource.PYTH }],
	accountSubscription: {
		type: 'polling',
		accountLoader: new BulkAccountLoader(connection, 'confirmed', 1),
	},
})
export const driftProgram = adminClient.program as unknown as Program<DriftIdl>
export const driftStateKey = await adminClient.getStatePublicKey()
export const driftSignerKey = adminClient.getSignerPublicKey()

const initializeQuoteSpotMarket = async () => {
	const optimalUtilization = SPOT_MARKET_RATE_PRECISION.div(new BN(2)).toNumber()
	const optimalRate = SPOT_MARKET_RATE_PRECISION.div(new BN(2)).toNumber()
	const maxRate = SPOT_MARKET_RATE_PRECISION.mul(new BN(3)).toNumber()
	const initialAssetWeight = SPOT_MARKET_WEIGHT_PRECISION.toNumber()
	const maintenanceAssetWeight = SPOT_MARKET_WEIGHT_PRECISION.toNumber()
	const initialLiabilityWeight = SPOT_MARKET_WEIGHT_PRECISION.toNumber()
	const maintenanceLiabilityWeight = SPOT_MARKET_WEIGHT_PRECISION.toNumber()
	const imfFactor = 0

	try {
		await adminClient.initializeSpotMarket(
			quoteMint,
			optimalUtilization,
			optimalRate,
			maxRate,
			PublicKey.default,
			OracleSource.QUOTE_ASSET,
			initialAssetWeight,
			maintenanceAssetWeight,
			initialLiabilityWeight,
			maintenanceLiabilityWeight,
			imfFactor,
		)
		await adminClient.updateWithdrawGuardThreshold(0, new BN(10 ** 10).mul(QUOTE_PRECISION))
	} catch {}
}

const initializeBaseSpotMarket = async () => {
	const optimalUtilization = SPOT_MARKET_RATE_PRECISION.div(new BN(2)).toNumber()
	const optimalRate = SPOT_MARKET_RATE_PRECISION.div(new BN(10)).mul(new BN(2)).toNumber()
	const maxRate = SPOT_MARKET_RATE_PRECISION.mul(new BN(5)).toNumber()
	const initialAssetWeight = SPOT_MARKET_WEIGHT_PRECISION.div(new BN(10)).mul(new BN(8)).toNumber()
	const maintenanceAssetWeight = SPOT_MARKET_WEIGHT_PRECISION.div(new BN(10))
		.mul(new BN(9))
		.toNumber()
	const initialLiabilityWeight = SPOT_MARKET_WEIGHT_PRECISION.div(new BN(10))
		.mul(new BN(12))
		.toNumber()
	const maintenanceLiabilityWeight = SPOT_MARKET_WEIGHT_PRECISION.div(new BN(10))
		.mul(new BN(11))
		.toNumber()

	try {
		await adminClient.initializeSpotMarket(
			baseTokenMint,
			optimalUtilization,
			optimalRate,
			maxRate,
			baseTokenOracleMint.publicKey,
			OracleSource.PYTH,
			initialAssetWeight,
			maintenanceAssetWeight,
			initialLiabilityWeight,
			maintenanceLiabilityWeight,
			3000,
		)
		await adminClient.updateWithdrawGuardThreshold(1, new BN(10 ** 10).mul(QUOTE_PRECISION))
	} catch {}
}

export const mockDrift = async () => {
	await mockOracle(baseTokenOracleMint, 20)

	// Init state
	const stateAccountAddress = await adminClient.getStatePublicKey()
	const stateAccountRPCResponse = await connection.getAccountInfo(stateAccountAddress)

	if (!stateAccountRPCResponse?.data) {
		await adminClient.initialize(quoteMint, true)
	}

	await adminClient.subscribe()
	await adminClient.fetchAccounts()

	await adminClient.updatePerpAuctionDuration(new BN(0))
	await adminClient.fetchAccounts()

	await initializeQuoteSpotMarket()
	await initializeBaseSpotMarket()

	// Init perp market
	const periodicity = new BN(60 * 60) // 1 HOUR
	const mantissaSqrtScale = new BN(100000)
	const ammInitialQuoteAssetAmount = new BN(5 * 10 ** 13).mul(mantissaSqrtScale)
	const ammInitialBaseAssetAmount = new BN(5 * 10 ** 13).mul(mantissaSqrtScale)
	await adminClient.initializePerpMarket(
		baseTokenOracleMint.publicKey,
		ammInitialBaseAssetAmount,
		ammInitialQuoteAssetAmount,
		periodicity,
	)
	await adminClient.updatePerpMarketStepSizeAndTickSize(0, new BN(1), new BN(1))

	const [
		[driftQuoteSpotMarketPDA, driftQuoteSpotMarketVaultPDA],
		[driftBaseSpotMarketPDA, driftBaseSpotMarketVaultPDA],
	] = await Promise.all(
		[0, 1].map(async (mi) => {
			const driftSpotMarketPDA = await getSpotMarketPublicKey(DRIFT_PROGRAM_ID_MAINNET, mi)
			const driftSpotMarketVaultPDA = await getSpotMarketVaultPublicKey(
				DRIFT_PROGRAM_ID_MAINNET,
				mi,
			)
			return [driftSpotMarketPDA, driftSpotMarketVaultPDA]
		}),
	)

	await adminClient.initializeUserAccountAndDepositCollateral(new BN(1000 * LAMPORTS_PER_SOL), baseTokenATA, 1, 0)

	return {
		driftBaseSpotMarketPDA,
		driftBaseSpotMarketVaultPDA,
		driftQuoteSpotMarketPDA,
		driftQuoteSpotMarketVaultPDA,
		driftProgram: adminClient.program as unknown as Program<DriftIdl>,
	}
}
