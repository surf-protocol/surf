import {
	TestClient,
	BulkAccountLoader,
	OracleSource,
	QUOTE_PRECISION,
	SPOT_MARKET_RATE_PRECISION,
	SPOT_MARKET_WEIGHT_PRECISION,
	UserStatsAccount,
	getSpotMarketPublicKey,
	getSpotMarketVaultPublicKey,
} from '@drift-labs/sdk'
import { Keypair, PublicKey } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import BN from 'bn.js'

import { mockOracle } from './pyth.js'
import { connection, provider } from '../load-config.js'
import { baseTokenMint, quoteMintKeyPair } from '../mint.js'
import { DriftIdl } from './drift-idl.js'

const quoteMint = quoteMintKeyPair.publicKey

export const DRIFT_PROGRAM_ID = new PublicKey('dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH')

const baseTokenOracleMint = new Keypair()
export const driftOracle = baseTokenOracleMint.publicKey

const adminClient = new TestClient({
	connection,
	wallet: provider.wallet,
	programID: DRIFT_PROGRAM_ID,
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
}

export const initDrift = async () => {
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
			const driftSpotMarketPDA = await getSpotMarketPublicKey(DRIFT_PROGRAM_ID, mi)
			const driftSpotMarketVaultPDA = await getSpotMarketVaultPublicKey(DRIFT_PROGRAM_ID, mi)
			return [driftSpotMarketPDA, driftSpotMarketVaultPDA]
		}),
	)

	return {
		driftBaseSpotMarketPDA,
		driftBaseSpotMarketVaultPDA,
		driftQuoteSpotMarketPDA,
		driftQuoteSpotMarketVaultPDA,
		driftProgram: adminClient.program as unknown as Program<DriftIdl>,
	}
}

export const getDriftPDAccounts = async (adminConfigPDA: PublicKey) => {
	const [userStatsPDA] = PublicKey.findProgramAddressSync(
		[Buffer.from('user_stats', 'utf-8'), adminConfigPDA.toBuffer()],
		DRIFT_PROGRAM_ID,
	)

	const userStatsAi = await connection.getAccountInfo(userStatsPDA)
	let userSubaccountId = 0
	if (userStatsAi?.data) {
		const userStatsAccount = (await driftProgram.coder.accounts.decode(
			'UserStats',
			userStatsAi.data,
		)) as UserStatsAccount
		userSubaccountId = userStatsAccount.numberOfSubAccounts
	}

	const [userSubaccountPDA] = PublicKey.findProgramAddressSync(
		[
			Buffer.from('user', 'utf-8'),
			adminConfigPDA.toBuffer(),
			new BN(userSubaccountId).toArrayLike(Buffer, 'le', 2),
		],
		DRIFT_PROGRAM_ID,
	)

	return {
		userStatsPDA,
		userSubaccountPDA,
		userSubaccountId,
	}
}
