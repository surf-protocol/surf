import { MathUtil } from '@orca-so/common-sdk'
import {
	WhirlpoolContext,
	ORCA_WHIRLPOOL_PROGRAM_ID,
	WhirlpoolIx,
	PDAUtil,
	TickUtil,
	PriceMath,
} from '@orca-so/whirlpools-sdk'
import { AnchorProvider } from '@coral-xyz/anchor'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { Keypair, Connection, PublicKey } from '@solana/web3.js'
import Decimal from 'decimal.js'

import { buildAndSendTx } from '../transaction.js'
import { tokenADecimals, tokenAMint, tokenBDecimals, tokenBMint } from '../mint.js'

export const DEFAULT_FEE_RATE = 300
export const DEFAULT_TICK_SPACING = 8
export const DEFAULT_POOL_PRICE = 20
export const DEFAULT_POOL_SQRT_PRICE = PriceMath.priceToSqrtPriceX64(
	new Decimal(DEFAULT_POOL_PRICE),
	tokenADecimals,
	tokenBDecimals,
)
export const DEFAULT_TICK_INDEX = PriceMath.sqrtPriceX64ToTickIndex(DEFAULT_POOL_SQRT_PRICE)

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

	const startTick = TickUtil.getStartTickIndex(DEFAULT_TICK_INDEX, DEFAULT_TICK_SPACING)
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

export const getPositionAccountsAddresses = (vault: PublicKey) => {
	const whirlpoolPositionMintKeyPair = new Keypair()
	const whirlpoolPositionATA = getAssociatedTokenAddressSync(
		whirlpoolPositionMintKeyPair.publicKey,
		vault,
		true,
	)
	const whirlpoolPositionPDA = PDAUtil.getPosition(
		ORCA_WHIRLPOOL_PROGRAM_ID,
		whirlpoolPositionMintKeyPair.publicKey,
	)

	return {
		whirlpoolPositionMintKeyPair,
		whirlpoolPositionATA,
		whirlpoolPositionPDA,
	}
}
