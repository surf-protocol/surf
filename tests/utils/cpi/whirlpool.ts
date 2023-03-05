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
import { Keypair, PublicKey } from '@solana/web3.js'
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
export const DEFAULT_TICK_INDEX = PriceMath.sqrtPriceX64ToTickIndex(DEFAULT_POOL_SQRT_PRICE)
export const DEFAULT_START_TICK = TickUtil.getStartTickIndex(
	DEFAULT_TICK_INDEX,
	DEFAULT_TICK_SPACING,
)

export const whirlpoolProgram = WhirlpoolContext.withProvider(
	provider,
	ORCA_WHIRLPOOL_PROGRAM_ID,
).program

export const buildInitTickArrayIx = (startTickIndex: number, whirlpoolKey: PublicKey) => {
	const tickArrayPda = PDAUtil.getTickArray(
		ORCA_WHIRLPOOL_PROGRAM_ID,
		whirlpoolKey,
		startTickIndex,
	)
	const ix = WhirlpoolIx.initTickArrayIx(whirlpoolProgram, {
		tickArrayPda,
		startTick: startTickIndex,
		whirlpool: whirlpoolKey,
		funder: wallet.publicKey,
	}).instructions[0]
	return { ix, tickArrayPda }
}

export const initTickArray = async (
	startTickIndex: number,
	whirlpoolKey: PublicKey,
	log = false,
) => {
	const { tickArrayPda, ix } = buildInitTickArrayIx(startTickIndex, whirlpoolKey)
	await buildAndSendTx(connection, [wallet], [ix], log)
	return {
		tickArrayPda,
	}
}

export const initProvidedTickArrays = async (
	initializableTickIndexes: number[],
	whirlpoolKey: PublicKey,
) => Promise.all(initializableTickIndexes.map((ti) => initTickArray(ti, whirlpoolKey)))

// Init tick arrays
export const initTickArrays = async (whirlpoolKey: PublicKey) => {
	const { tickArrayPda } = await initTickArray(DEFAULT_START_TICK, whirlpoolKey)

	const ticksInArray = DEFAULT_TICK_SPACING * TICK_ARRAY_SIZE
	const tickArraysPDAs: Record<number, PDA> = { 0: tickArrayPda }

	for (let i = 1; i <= 3; i++) {
		const startUpperTickIndex = DEFAULT_START_TICK + i * ticksInArray
		const startLowerTickIndex = DEFAULT_START_TICK - i * ticksInArray

		const { ix: upperIx, tickArrayPda: upperPDA } = buildInitTickArrayIx(
			startUpperTickIndex,
			whirlpoolKey,
		)
		const { ix: lowerIx, tickArrayPda: lowerPDA } = buildInitTickArrayIx(
			startLowerTickIndex,
			whirlpoolKey,
		)
		await buildAndSendTx(connection, [wallet], [upperIx, lowerIx])

		tickArraysPDAs[i] = upperPDA
		tickArraysPDAs[-i] = lowerPDA
	}

	return tickArraysPDAs
}

// Init whirlpool
export const mockWhirlpool = async () => {
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
		DEFAULT_TICK_SPACING,
	)
	const { instructions: initFeeTierIx } = WhirlpoolIx.initializeFeeTierIx(whirlpoolProgram, {
		whirlpoolsConfig: whirlpoolsConfigKeypair.publicKey,
		funder: wallet.publicKey,
		feeAuthority: configKeyPairs.feeAuthorityKeypair.publicKey,
		feeTierPda,
		tickSpacing: DEFAULT_TICK_SPACING,
		defaultFeeRate: DEFAULT_FEE_RATE,
	})

	const tokenVaultAKeypair = Keypair.generate()
	const tokenVaultBKeypair = Keypair.generate()

	const whirlpoolPDA = PDAUtil.getWhirlpool(
		ORCA_WHIRLPOOL_PROGRAM_ID,
		whirlpoolsConfigKeypair.publicKey,
		baseTokenMint,
		quoteTokenMint,
		DEFAULT_TICK_SPACING,
	)

	const { instructions: initPoolIx } = WhirlpoolIx.initializePoolIx(whirlpoolProgram, {
		feeTierKey: feeTierPda.publicKey,
		tickSpacing: DEFAULT_TICK_SPACING,
		funder: wallet.publicKey,
		whirlpoolsConfig: whirlpoolsConfigKeypair.publicKey,
		whirlpoolPda: whirlpoolPDA,
		tokenMintA: baseTokenMint,
		tokenMintB: quoteTokenMint,
		initSqrtPrice: DEFAULT_POOL_SQRT_PRICE,
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

	const tickArrays = await initTickArrays(whirlpoolPDA.publicKey)
	const oracleKey = PDAUtil.getOracle(ORCA_WHIRLPOOL_PROGRAM_ID, whirlpoolPDA.publicKey)

	return {
		tickArrays,
		whirlpoolData,
		oracleAddress: oracleKey.publicKey,
		whirlpoolAddress: whirlpoolPDA.publicKey,
	}
}

// Create and fund dummy position
export const fundPosition = async (
	inputQuoteAmount: BN,
	whirlpoolKey: PublicKey,
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

	const ticksInArray = DEFAULT_TICK_SPACING * TICK_ARRAY_SIZE
	const upperTickIndex = DEFAULT_START_TICK + 3 * ticksInArray
	const lowerTickIndex = DEFAULT_START_TICK - 3 * ticksInArray
	const openPositionIx = WhirlpoolIx.openPositionIx(whirlpoolProgram, {
		whirlpool: whirlpoolKey,
		owner: wallet.publicKey,
		positionPda: positionPDA,
		positionMintAddress: positionMintKeyPair.publicKey,
		positionTokenAccount: positionATA,
		tickLowerIndex: lowerTickIndex,
		tickUpperIndex: upperTickIndex,
		funder: wallet.publicKey,
	}).instructions
	const increaseLiquidityQuote = increaseLiquidityQuoteByInputTokenWithParams({
		inputTokenAmount: inputQuoteAmount,
		inputTokenMint: quoteMintKeyPair.publicKey,
		tokenMintA: whirlpoolData.tokenMintA,
		tokenMintB: whirlpoolData.tokenMintB,
		tickCurrentIndex: DEFAULT_TICK_INDEX,
		sqrtPrice: DEFAULT_POOL_SQRT_PRICE,
		slippageTolerance: new Percentage(new BN(25), new BN(10000)),
		tickLowerIndex: lowerTickIndex,
		tickUpperIndex: upperTickIndex,
	})
	const increaseLiquidityIx = WhirlpoolIx.increaseLiquidityIx(whirlpoolProgram, {
		...increaseLiquidityQuote,
		...whirlpoolData,
		position: positionPDA.publicKey,
		positionTokenAccount: positionATA,
		whirlpool: whirlpoolKey,
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
