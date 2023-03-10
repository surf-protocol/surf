import { PDA, Percentage } from '@orca-so/common-sdk'
import {
	WhirlpoolContext,
	ORCA_WHIRLPOOL_PROGRAM_ID,
	WhirlpoolIx,
	PDAUtil,
	TickUtil,
	PriceMath,
	ParsableWhirlpool,
	TICK_ARRAY_SIZE,
	WhirlpoolData,
	increaseLiquidityQuoteByInputTokenWithParams,
} from '@orca-so/whirlpools-sdk'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js'
import Decimal from 'decimal.js'
import BN from 'bn.js'

import { buildAndSendTx } from '../transaction.js'
import {
	baseTokenUserATA,
	quoteMintKeyPair,
	quoteTokenUserATA,
	baseTokenDecimals,
	baseTokenMint,
	quoteTokenDecimals,
	quoteTokenMint,
} from '../mint.js'
import { connection, provider, wallet } from '../load-config.js'

export const DEFAULT_FEE_RATE = 300
export const DEFAULT_TICK_SPACING = 8
export const DEFAULT_POOL_PRICE = 20
export const DEFAULT_POOL_SQRT_PRICE = PriceMath.priceToSqrtPriceX64(
	new Decimal(DEFAULT_POOL_PRICE),
	baseTokenDecimals,
	quoteTokenDecimals,
)

export const whirlpoolProgram = WhirlpoolContext.withProvider(
	provider,
	ORCA_WHIRLPOOL_PROGRAM_ID,
).program

type MockTickIndexesParams = {
	whirlpoolAddress: PublicKey
	upperTickInitializable: number
	lowerTickInitializable: number
	tickSpacing: number
}

export const mockBoundariesTickArrays = async ({
	whirlpoolAddress,
	upperTickInitializable,
	lowerTickInitializable,
	tickSpacing,
}: MockTickIndexesParams) => {
	const upperStartTick = TickUtil.getStartTickIndex(upperTickInitializable, tickSpacing)
	const lowerStartTick = TickUtil.getStartTickIndex(lowerTickInitializable, tickSpacing)

	const tickArraysPDAs: PublicKey[] = []
	const ixs: TransactionInstruction[] = []

	;[upperStartTick, lowerStartTick].forEach((st) => {
		const tickArrayPDA = PDAUtil.getTickArray(ORCA_WHIRLPOOL_PROGRAM_ID, whirlpoolAddress, st)
		console.log(tickArrayPDA.publicKey.toString())
		tickArraysPDAs.push(tickArrayPDA.publicKey)
		ixs.push(
			WhirlpoolIx.initTickArrayIx(whirlpoolProgram, {
				tickArrayPda: tickArrayPDA,
				startTick: st,
				funder: wallet.publicKey,
				whirlpool: whirlpoolAddress,
			}).instructions[0],
		)
	})

	const res = await buildAndSendTx(connection, [wallet], ixs)

	return {
		upperTickArrayAddress: tickArraysPDAs[0],
		lowerTickArrayAddress: tickArraysPDAs[1],
		res,
	}
}

export const initTickArrays = async (
	whirlpoolAddress: PublicKey,
	startTickIndex: number,
	tickSpacing: number,
) => {
	const buildIx = (st: number) => {
		const tickArrayPda = PDAUtil.getTickArray(ORCA_WHIRLPOOL_PROGRAM_ID, whirlpoolAddress, st)
		const ix = WhirlpoolIx.initTickArrayIx(whirlpoolProgram, {
			tickArrayPda,
			startTick: st,
			whirlpool: whirlpoolAddress,
			funder: wallet.publicKey,
		}).instructions[0]
		return { ix, tickArrayPda }
	}

	const { tickArrayPda, ix } = buildIx(startTickIndex)
	await buildAndSendTx(connection, [wallet], [ix])

	const ticksInArray = tickSpacing * TICK_ARRAY_SIZE
	const tickArraysPDAs: Record<number, PDA> = { 0: tickArrayPda }

	for (let i = 1; i <= 3; i++) {
		const startUpperTickIndex = startTickIndex + i * ticksInArray
		const startLowerTickIndex = startTickIndex - i * ticksInArray

		const { ix: upperIx, tickArrayPda: upperPDA } = buildIx(startUpperTickIndex)
		const { ix: lowerIx, tickArrayPda: lowerPDA } = buildIx(startLowerTickIndex)
		await buildAndSendTx(connection, [wallet], [upperIx, lowerIx])

		tickArraysPDAs[i] = upperPDA
		tickArraysPDAs[-i] = lowerPDA
	}

	return tickArraysPDAs
}

const fundPosition = async (
	baseTokenAmount: BN,
	startTick: number,
	tickSpacing: number,
	whirlpoolAddress: PublicKey,
	whirlpoolData: WhirlpoolData,
	tickArrays: Record<number, PDA>,
) => {
	const positionMintKeyPair = new Keypair()
	const positionATA = getAssociatedTokenAddressSync(
		positionMintKeyPair.publicKey,
		wallet.publicKey,
		false,
	)
	const positionPDA = PDAUtil.getPosition(
		ORCA_WHIRLPOOL_PROGRAM_ID,
		positionMintKeyPair.publicKey,
	)

	const ticksInArray = tickSpacing * TICK_ARRAY_SIZE
	const upperTickIndex = startTick + 3 * ticksInArray
	const lowerTickIndex = startTick - 3 * ticksInArray
	const openPositionIx = WhirlpoolIx.openPositionIx(whirlpoolProgram, {
		whirlpool: whirlpoolAddress,
		owner: wallet.publicKey,
		positionPda: positionPDA,
		positionMintAddress: positionMintKeyPair.publicKey,
		positionTokenAccount: positionATA,
		tickLowerIndex: lowerTickIndex,
		tickUpperIndex: upperTickIndex,
		funder: wallet.publicKey,
	}).instructions
	const increaseLiquidityQuote = increaseLiquidityQuoteByInputTokenWithParams({
		inputTokenAmount: baseTokenAmount,
		inputTokenMint: baseTokenMint,
		tokenMintA: whirlpoolData.tokenMintA,
		tokenMintB: whirlpoolData.tokenMintB,
		tickCurrentIndex: whirlpoolData.tickCurrentIndex,
		sqrtPrice: whirlpoolData.sqrtPrice,
		slippageTolerance: new Percentage(new BN(25), new BN(10000)),
		tickLowerIndex: lowerTickIndex,
		tickUpperIndex: upperTickIndex,
	})
	const increaseLiquidityIx = WhirlpoolIx.increaseLiquidityIx(whirlpoolProgram, {
		...increaseLiquidityQuote,
		...whirlpoolData,
		position: positionPDA.publicKey,
		positionTokenAccount: positionATA,
		whirlpool: whirlpoolAddress,
		positionAuthority: wallet.publicKey,
		tokenOwnerAccountA: baseTokenUserATA,
		tokenOwnerAccountB: quoteTokenUserATA,
		tickArrayLower: tickArrays[-3].publicKey,
		tickArrayUpper: tickArrays[3].publicKey,
	}).instructions

	await buildAndSendTx(
		connection,
		[wallet, positionMintKeyPair],
		[...openPositionIx, ...increaseLiquidityIx],
	)
}

type MockWhirlpoolParams = {
	tickSpacing?: number
	mockBaseTokenAmount?: BN
}

export const mockWhirlpool = async ({
	tickSpacing = DEFAULT_TICK_SPACING,
	mockBaseTokenAmount,
}: MockWhirlpoolParams = {}) => {
	const configKeyPairs = {
		feeAuthorityKeypair: Keypair.generate(),
		collectProtocolFeesAuthorityKeypair: Keypair.generate(),
		rewardEmissionsSuperAuthorityKeypair: Keypair.generate(),
	}
	const whirlpoolsConfigKeypair = Keypair.generate()
	const { instructions: initConfigIx } = WhirlpoolIx.initializeConfigIx(whirlpoolProgram, {
		whirlpoolsConfigKeypair,
		feeAuthority: configKeyPairs.feeAuthorityKeypair.publicKey,
		collectProtocolFeesAuthority: configKeyPairs.collectProtocolFeesAuthorityKeypair.publicKey,
		rewardEmissionsSuperAuthority:
			configKeyPairs.rewardEmissionsSuperAuthorityKeypair.publicKey,
		defaultProtocolFeeRate: DEFAULT_FEE_RATE,
		funder: wallet.publicKey,
	})

	const feeTierPda = PDAUtil.getFeeTier(
		ORCA_WHIRLPOOL_PROGRAM_ID,
		whirlpoolsConfigKeypair.publicKey,
		tickSpacing,
	)
	const { instructions: initFeeTierIx } = WhirlpoolIx.initializeFeeTierIx(whirlpoolProgram, {
		whirlpoolsConfig: whirlpoolsConfigKeypair.publicKey,
		funder: wallet.publicKey,
		feeAuthority: configKeyPairs.feeAuthorityKeypair.publicKey,
		feeTierPda,
		tickSpacing: tickSpacing,
		defaultFeeRate: DEFAULT_FEE_RATE,
	})

	const tokenVaultAKeypair = Keypair.generate()
	const tokenVaultBKeypair = Keypair.generate()

	const whirlpoolPDA = PDAUtil.getWhirlpool(
		ORCA_WHIRLPOOL_PROGRAM_ID,
		whirlpoolsConfigKeypair.publicKey,
		baseTokenMint,
		quoteTokenMint,
		tickSpacing,
	)

	const defaultSqrtPrice = PriceMath.priceToSqrtPriceX64(
		new Decimal(DEFAULT_POOL_PRICE),
		baseTokenDecimals,
		quoteTokenDecimals,
	)

	const { instructions: initPoolIx } = WhirlpoolIx.initializePoolIx(whirlpoolProgram, {
		feeTierKey: feeTierPda.publicKey,
		tickSpacing: tickSpacing,
		funder: wallet.publicKey,
		whirlpoolsConfig: whirlpoolsConfigKeypair.publicKey,
		whirlpoolPda: whirlpoolPDA,
		tokenMintA: baseTokenMint,
		tokenMintB: quoteTokenMint,
		initSqrtPrice: defaultSqrtPrice,
		tokenVaultAKeypair,
		tokenVaultBKeypair,
	})

	await buildAndSendTx(
		connection,
		[
			wallet,
			whirlpoolsConfigKeypair,
			configKeyPairs.feeAuthorityKeypair,
			tokenVaultAKeypair,
			tokenVaultBKeypair,
		],
		[...initConfigIx, ...initFeeTierIx, ...initPoolIx],
	)

	const whirlpoolAi = await connection.getAccountInfo(whirlpoolPDA.publicKey, 'confirmed')
	const whirlpoolData = ParsableWhirlpool.parse(whirlpoolAi.data)

	if (!whirlpoolData) {
		throw Error('Missing whirlpool data')
	}

	const defaultTickIndex = PriceMath.sqrtPriceX64ToTickIndex(defaultSqrtPrice)
	const startTickIndex = TickUtil.getStartTickIndex(defaultTickIndex, tickSpacing)
	const tickArrays = await initTickArrays(whirlpoolPDA.publicKey, startTickIndex, tickSpacing)
	const oracleAddress = PDAUtil.getOracle(ORCA_WHIRLPOOL_PROGRAM_ID, whirlpoolPDA.publicKey)

	if (mockBaseTokenAmount) {
		await fundPosition(
			mockBaseTokenAmount,
			startTickIndex,
			tickSpacing,
			whirlpoolPDA.publicKey,
			whirlpoolData,
			tickArrays,
		)
	}

	return {
		tickArrays,
		whirlpoolData,
		oracleAddress: oracleAddress.publicKey,
		whirlpoolAddress: whirlpoolPDA.publicKey,
		whirlpoolBaseTokenVaultAddress: tokenVaultAKeypair.publicKey,
		whirlpoolQuoteTokenVaultAddress: tokenVaultBKeypair.publicKey,
	}
}
