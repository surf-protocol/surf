import {
	TestClient,
	BulkAccountLoader,
	OracleSource,
	QUOTE_PRECISION,
	SPOT_MARKET_RATE_PRECISION,
	SPOT_MARKET_WEIGHT_PRECISION,
	StateAccount,
	UserStatsAccount,
} from '@drift-labs/sdk'
import { PublicKey } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import BN from 'bn.js'

import { mockOracle } from './pyth.js'
import { connection, provider } from '../load-config.js'
import { usdcMintKeyPair } from '../mint.js'
import { DriftIdl } from './drift-idl.js'

const usdcMint = usdcMintKeyPair.publicKey

export const DRIFT_PROGRAM_ID = new PublicKey('dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH')

const initializeQuoteSpotMarket = async (adminClient: TestClient, stateAccount: StateAccount) => {
	const marketIndex = stateAccount.numberOfSpotMarkets

	if (marketIndex > 0) {
		return
	}

	const optimalUtilization = SPOT_MARKET_RATE_PRECISION.div(new BN(2)).toNumber() // 50% utilization
	const optimalRate = SPOT_MARKET_RATE_PRECISION.toNumber()
	const maxRate = SPOT_MARKET_RATE_PRECISION.toNumber()
	const initialAssetWeight = SPOT_MARKET_WEIGHT_PRECISION.toNumber()
	const maintenanceAssetWeight = SPOT_MARKET_WEIGHT_PRECISION.toNumber()
	const initialLiabilityWeight = SPOT_MARKET_WEIGHT_PRECISION.toNumber()
	const maintenanceLiabilityWeight = SPOT_MARKET_WEIGHT_PRECISION.toNumber()
	const imfFactor = 0

	await adminClient.initializeSpotMarket(
		usdcMint,
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
	await adminClient.updateWithdrawGuardThreshold(marketIndex, new BN(10 ** 10).mul(QUOTE_PRECISION))
}

export const initDrift = async () => {
	const solUsdOracle = await mockOracle(20)

	const adminClient = new TestClient({
		connection,
		wallet: provider.wallet,
		programID: DRIFT_PROGRAM_ID,
		activeSubAccountId: 0,
		perpMarketIndexes: [0],
		spotMarketIndexes: [0],
		oracleInfos: [{ publicKey: solUsdOracle, source: OracleSource.PYTH }],
		accountSubscription: {
			type: 'polling',
			accountLoader: new BulkAccountLoader(connection, 'confirmed', 1),
		},
	})

	// Init state
	const stateAccountAddress = await adminClient.getStatePublicKey()
	const stateAccountRPCResponse = await connection.getAccountInfo(stateAccountAddress)

	if (!stateAccountRPCResponse?.data) {
		await adminClient.initialize(usdcMint, true)
	}

	await adminClient.subscribe()
	await adminClient.fetchAccounts()

	await adminClient.updatePerpAuctionDuration(new BN(0))
	await adminClient.fetchAccounts()

	const stateAccount = adminClient.getStateAccount()
	await initializeQuoteSpotMarket(adminClient, stateAccount)

	// Init perp market
	const periodicity = new BN(60 * 60) // 1 HOUR

	if (stateAccount.numberOfMarkets === 0) {
		const mantissaSqrtScale = new BN(100000)
		const ammInitialQuoteAssetAmount = new BN(5 * 10 ** 13).mul(mantissaSqrtScale)
		const ammInitialBaseAssetAmount = new BN(5 * 10 ** 13).mul(mantissaSqrtScale)
		await adminClient.initializePerpMarket(
			solUsdOracle,
			ammInitialBaseAssetAmount,
			ammInitialQuoteAssetAmount,
			periodicity,
		)
		await adminClient.updatePerpMarketStepSizeAndTickSize(0, new BN(1), new BN(1))
	}

	return {
		stateAccountAddress,
		driftProgram: adminClient.program as unknown as Program<DriftIdl>,
	}
}

export const getDriftPDAccounts = async (driftProgram: Program<DriftIdl>, adminConfigPDA: PublicKey) => {
	const [userStatsPDA] = PublicKey.findProgramAddressSync(
		[Buffer.from('user_stats', 'utf-8'), adminConfigPDA.toBuffer()],
		DRIFT_PROGRAM_ID,
	)

	const userStatsAi = await connection.getAccountInfo(userStatsPDA)
	let userSubaccountId = 0
	if (userStatsAi?.data) {
		const userStatsAccount = await driftProgram.coder.accounts.decode('UserStats', userStatsAi.data) as UserStatsAccount
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
