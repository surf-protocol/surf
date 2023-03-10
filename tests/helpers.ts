import { Percentage } from '@orca-so/common-sdk'
import { ParsableWhirlpool } from '@orca-so/whirlpools-sdk'
import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import { expect } from 'vitest'

import { mockWhirlpool } from './utils/cpi/whirlpool'
import { connection } from './utils/load-config'
import {
	mockVaultState,
	mockVaultWhirlpoolPosition,
	mockUserPosition,
	mockUserPositionWithLiquidity,
	mockIncreaseLiquidityHedge,
	mockHedgePosition,
} from './utils/mock'

type LiquidityConfig = {
	baseTokenAmount: BN
	slippageTolerance: Percentage
}

type IncreaseLiquidityData = {
	liquidityAmount: BN
	baseTokenAmount: BN
	quoteTokenAmount: BN
	upperTickArrayAddress: PublicKey
	lowerTickArrayAddress: PublicKey
	upperTickInitializable: number
	lowerTickInitializable: number
}

type IncreaseHedgeConfig = {
	borrowAmount: BN
	driftBaseSpotMarketAddress: PublicKey
	driftBaseSpotMarketVaultAddress: PublicKey
	driftQuoteSpotMarketAddress: PublicKey
	driftQuoteSpotMarketVaultAddress: PublicKey
}

type HedgeConfig = {
	increaseConfig?: IncreaseHedgeConfig
}

export const mockEnv = async (
	adminConfigAddress: PublicKey,
	liquidityConfig?: LiquidityConfig,
	hedgeConfig?: HedgeConfig,
) => {
	const {
		whirlpoolAddress,
		whirlpoolData: _whirlpoolData,
		whirlpoolBaseTokenVaultAddress,
		whirlpoolQuoteTokenVaultAddress,
		tickArrays: swapTickArraysAddresses,
		oracleAddress,
	} = await mockWhirlpool()
	const {
		vaultStateAddress,
		vaultBaseTokenAccountAddress,
		vaultQuoteTokenAccountAddress,
		vaultRangeParams: { fullTickRange },
		driftStatsAddress,
		driftSubaccountAddress,
	} = await mockVaultState({ whirlpoolAddress, adminConfigAddress })
	const {
		vaultWhirlpoolPositionAddress,
		res: openVaultWhirlpoolPositionRes,
		whirlpoolPositionAddress,
		whirlpoolPositionVaultTokenAccountAddress,
	} = await mockVaultWhirlpoolPosition({
		vaultStateAddress,
		whirlpoolAddress,
		id: 0,
	})
	expect(openVaultWhirlpoolPositionRes.status).toBe('SUCCESS')

	let userPositionAddress: PublicKey
	let increaseLiquidityData: null | IncreaseLiquidityData

	if (!liquidityConfig) {
		const { res: openUserPositionRes, userPositionAddress: _userPositionAddress } =
			await mockUserPosition(vaultStateAddress)
		expect(openUserPositionRes.status).toBe('SUCCESS')
		userPositionAddress = _userPositionAddress
	} else {
		const { slippageTolerance, baseTokenAmount: baseTokenAmountInput } = liquidityConfig
		const {
			res,
			userPositionAddress: _userPositionAddress,
			..._increaseLiqData
		} = await mockUserPositionWithLiquidity({
			baseTokenAmount: baseTokenAmountInput,
			slippageTolerance,
			fullTickRange,
			whirlpoolAddress,
			whirlpoolData: _whirlpoolData,
			whirlpoolBaseTokenVaultAddress,
			whirlpoolQuoteTokenVaultAddress,
			vaultStateAddress,
			vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccountAddress,
			vaultWhirlpoolPositionAddress,
			whirlpoolPositionAddress,
			whirlpoolPositionVaultTokenAccountAddress,
		})
		expect(res.status).toBe('SUCCESS')
		userPositionAddress = _userPositionAddress
		increaseLiquidityData = _increaseLiqData
	}

	let hedgePositionAddress: PublicKey | null
	let whirlpoolData = _whirlpoolData

	if (hedgeConfig && !hedgeConfig.increaseConfig) {
		const { res, hedgePositionAddress: _hedgePositionAddress } = await mockHedgePosition({
			vaultStateAddress,
			id: 0,
		})
		expect(res.status).toBe('SUCCESS')
		hedgePositionAddress = _hedgePositionAddress
	} else if (liquidityConfig && hedgeConfig && hedgeConfig.increaseConfig) {
		;({ hedgePositionAddress } = await mockHedgePosition({ vaultStateAddress, id: 0 }))
		const { res } = await mockIncreaseLiquidityHedge({
			...hedgeConfig.increaseConfig,
			userPositionAddress,
			vaultStateAddress,
			vaultBaseTokenAccountAddress,
			vaultQuoteTokenAccountAddress,
			hedgePositionAddress,
			vaultWhirlpoolPositionAddress,
			whirlpoolAddress,
			driftStatsAddress,
			driftSubaccountAddress,
			swapWhirlpoolAddress: whirlpoolAddress,
			swapWhirlpoolBaseTokenVaultAddress: whirlpoolBaseTokenVaultAddress,
			swapWhirlpoolQuoteTokenVaultAddress: whirlpoolQuoteTokenVaultAddress,
			swapTickArray0Address: swapTickArraysAddresses[0].publicKey,
			swapTickArray1Address: swapTickArraysAddresses[-1].publicKey,
			swapTickArray2Address: swapTickArraysAddresses[-2].publicKey,
			swapOracleAddress: oracleAddress,
		})
		expect(res.status).toBe('SUCCESS')

		const whirlpoolAi = await connection.getAccountInfo(whirlpoolAddress)
		whirlpoolData = ParsableWhirlpool.parse(whirlpoolAi.data)
	}

	return {
		whirlpoolAddress,
		whirlpoolData,
		whirlpoolBaseTokenVaultAddress,
		whirlpoolQuoteTokenVaultAddress,
		vaultStateAddress,
		vaultBaseTokenAccountAddress,
		vaultQuoteTokenAccountAddress,
		fullTickRange,
		vaultWhirlpoolPositionAddress,
		whirlpoolPositionAddress,
		whirlpoolPositionVaultTokenAccountAddress,
		userPositionAddress,
		increaseLiquidityData,
		swapTickArraysAddresses,
		swapOracleAddress: oracleAddress,
		hedgePositionAddress,
		driftStatsAddress,
		driftSubaccountAddress,
	}
}
