import { MathUtil } from '@orca-so/common-sdk'
import {
	WhirlpoolContext,
	ORCA_WHIRLPOOL_PROGRAM_ID,
	WhirlpoolIx,
	PDAUtil,
	TickUtil,
	PriceMath,
} from '@orca-so/whirlpools-sdk'
import { AnchorProvider } from '@project-serum/anchor'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { NATIVE_MINT, TOKEN_PROGRAM_ID, createInitializeMintInstruction } from '@solana/spl-token'
import { LAMPORTS_PER_SOL, Keypair, Connection, SystemProgram, PublicKey } from '@solana/web3.js'
import Decimal from 'decimal.js'

import { buildAndSendTx } from './transaction.js'

const nonNativeMintKeyPair = new Keypair()
const getSortedMints = (): [PublicKey, number][] => {
	const tokenBMint = nonNativeMintKeyPair.publicKey
	const tokenBDecimals = 6

	if (Buffer.compare(NATIVE_MINT.toBuffer(), tokenBMint.toBuffer()) < 0) {
		return [
			[NATIVE_MINT, LAMPORTS_PER_SOL],
			[tokenBMint, tokenBDecimals],
		]
	}
	return [
		[tokenBMint, tokenBDecimals],
		[NATIVE_MINT, LAMPORTS_PER_SOL],
	]
}

const [[tokenAMint, tokenADecimals], [tokenBMint, tokenBDecimals]] = getSortedMints()
export { tokenAMint, tokenADecimals, tokenBMint, tokenBDecimals }

const createTokenBMint = async (connection: Connection, wallet: Keypair) => {
	const ixs = [
		SystemProgram.createAccount({
			fromPubkey: wallet.publicKey,
			newAccountPubkey: tokenBMint,
			space: 82,
			lamports: await connection.getMinimumBalanceForRentExemption(82),
			programId: TOKEN_PROGRAM_ID,
		}),
		createInitializeMintInstruction(
			tokenBMint,
			tokenBDecimals,
			wallet.publicKey,
			PublicKey.default,
			TOKEN_PROGRAM_ID,
		),
	]
	await buildAndSendTx(connection, [wallet, nonNativeMintKeyPair], ixs)
}

export const DEFAULT_POOL_PRICE = 20
export const DEFAULT_POOL_SQRT_PRICE = MathUtil.toX64(new Decimal(DEFAULT_POOL_PRICE))
export const DEFAULT_FEE_RATE = 300
export const DEFAULT_TICK_SPACING = 8

export const initWhirlpool = async (
	connection: Connection,
	wallet: Keypair,
	provider: AnchorProvider,
) => {
	const whirlpoolProgram = WhirlpoolContext.withProvider(
		provider,
		ORCA_WHIRLPOOL_PROGRAM_ID,
	).program

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
		rewardEmissionsSuperAuthority: configKeyPairs.rewardEmissionsSuperAuthorityKeypair.publicKey,
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
		tokenAMint,
		tokenBMint,
		DEFAULT_TICK_SPACING,
	)

	const { instructions: initPoolIx } = WhirlpoolIx.initializePoolIx(whirlpoolProgram, {
		feeTierKey: feeTierPda.publicKey,
		tickSpacing: DEFAULT_TICK_SPACING,
		funder: wallet.publicKey,
		whirlpoolsConfig: whirlpoolsConfigKeypair.publicKey,
		whirlpoolPda: whirlpoolPDA,
		tokenMintA: tokenAMint,
		tokenMintB: tokenBMint,
		initSqrtPrice: DEFAULT_POOL_SQRT_PRICE,
		tokenVaultAKeypair,
		tokenVaultBKeypair,
	})

	const tickCurrentIndex = PriceMath.sqrtPriceX64ToTickIndex(DEFAULT_POOL_SQRT_PRICE)
	const startTick = TickUtil.getStartTickIndex(
		tickCurrentIndex,
		DEFAULT_TICK_SPACING,
	)
	const tickArrayPda = PDAUtil.getTickArray(
		ORCA_WHIRLPOOL_PROGRAM_ID,
		whirlpoolPDA.publicKey,
		startTick,
	)
	const { instructions: initTickArrayIx } = WhirlpoolIx.initTickArrayIx(whirlpoolProgram, {
		tickArrayPda,
		startTick,
		whirlpool: whirlpoolPDA.publicKey,
		funder: wallet.publicKey,
	})

	await createTokenBMint(connection, wallet)
	await buildAndSendTx(
		connection,
		[
			wallet,
			whirlpoolsConfigKeypair,
			configKeyPairs.feeAuthorityKeypair,
			tokenVaultAKeypair,
			tokenVaultBKeypair,
		],
		[...initConfigIx, ...initFeeTierIx, ...initPoolIx, ...initTickArrayIx],
	)

	return {
		whirlpool: whirlpoolPDA.publicKey,
	}
}

const getPositionTickIndexes = (upperPrice: number, lowerPrice: number) => {
	const tickUpperIndex = TickUtil.getInitializableTickIndex(
		PriceMath.sqrtPriceX64ToTickIndex(
			MathUtil.toX64(new Decimal(upperPrice)),
		),
		DEFAULT_TICK_SPACING,
	)
	const tickLowerIndex = TickUtil.getInitializableTickIndex(
		PriceMath.sqrtPriceX64ToTickIndex(
			MathUtil.toX64(new Decimal(lowerPrice)),
		),
		DEFAULT_TICK_SPACING,
	)
	return { tickUpperIndex, tickLowerIndex }
}

export const getOpenPositionData = (vault: PublicKey, upperPrice: number, lowerPrice: number) => {
	const positionMintKeyPair = new Keypair()
	const positionATA = getAssociatedTokenAddressSync(positionMintKeyPair.publicKey, vault, true)
	const positionPDA = PDAUtil.getPosition(ORCA_WHIRLPOOL_PROGRAM_ID, positionMintKeyPair.publicKey)

	return {
		...getPositionTickIndexes(upperPrice, lowerPrice),
		positionMintKeyPair,
		positionATA,
		positionPDA,
	}
}
