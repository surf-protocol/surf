import { ORCA_WHIRLPOOL_PROGRAM_ID, WhirlpoolData } from '@orca-so/whirlpools-sdk'
import {
	ASSOCIATED_TOKEN_PROGRAM_ID,
	getAssociatedTokenAddressSync,
	TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import BN from 'bn.js'

import { program, wallet } from './utils/load-config.js'
import { DRIFT_PROGRAM_ID } from './utils/cpi/drift.js'

export const initAdminIx = async () => {
	const [adminConfigPDA, adminConfigBump] = PublicKey.findProgramAddressSync(
		[Buffer.from('admin_config', 'utf-8')],
		program.programId,
	)
	const ix = await program.methods
		.initializeAdminConfig()
		.accountsStrict({
			admin: wallet.publicKey,
			adminConfig: adminConfigPDA,
			systemProgram: SystemProgram.programId,
		})
		.instruction()

	return { adminConfigPDA, adminConfigBump, ix }
}

type InitializeVaultAccounts = {
	admin: PublicKey
	adminConfig: PublicKey
	whirlpool: PublicKey
	driftStats: PublicKey
	driftSubaccount: PublicKey
	driftState: PublicKey
	driftProgram: PublicKey
	tokenMintA: PublicKey
	tokenMintB: PublicKey
}

type InitializeVaultArgs = {
	driftSubaccountId: number
	fullTickRange: number
	vaultTickRange: number
	hedgeTickRange: number
}

export const initVaultIx = async (args: InitializeVaultArgs, accounts: InitializeVaultAccounts) => {
	// TODO: Helper
	const [vaultPDA, vaultBump] = PublicKey.findProgramAddressSync(
		[Buffer.from('vault', 'utf-8'), accounts.whirlpool.toBuffer()],
		program.programId,
	)
	console.log(accounts.tokenMintB.toString(), 'sadfdasd')
	const [tokenVaultA, tokenVaultB] = [
		getAssociatedTokenAddressSync(accounts.tokenMintA, vaultPDA, true),
		getAssociatedTokenAddressSync(accounts.tokenMintB, vaultPDA, true),
	]
	const ix = await program.methods
		.initializeVault(
			args.driftSubaccountId,
			args.fullTickRange,
			args.vaultTickRange,
			args.hedgeTickRange,
		)
		.accountsStrict({
			...accounts,
			tokenVaultA,
			tokenVaultB,
			vault: vaultPDA,
			systemProgram: SystemProgram.programId,
			driftProgram: DRIFT_PROGRAM_ID,
			tokenProgram: TOKEN_PROGRAM_ID,
			associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
			rent: SYSVAR_RENT_PUBKEY,
			whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
		})
		.instruction()

	return {
		ix,
		tokenVaultA,
		tokenVaultB,
		vaultPDA,
		vaultBump,
	}
}

type OpenWhirlpoolPositionIxParams = {
	args: {
		positionBump: number
		tickLowerIndex: number
		tickUpperIndex: number
	}
	accounts: {
		payer: PublicKey
		whirlpool: PublicKey
		vault: PublicKey
		whirlpoolPosition: PublicKey
		whirlpoolPositionMint: PublicKey
		whirlpoolPositionTokenAccount: PublicKey
	}
}

export const openWhirlpoolPositionIx = async ({
	args: { positionBump, tickLowerIndex, tickUpperIndex },
	accounts,
}: OpenWhirlpoolPositionIxParams) => {
	const ix = await program.methods
		.openWhirlpoolPosition(positionBump, tickLowerIndex, tickUpperIndex)
		.accountsStrict({
			...accounts,
			whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
			tokenProgram: TOKEN_PROGRAM_ID,
			associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
			rent: SYSVAR_RENT_PUBKEY,
			systemProgram: SystemProgram.programId,
		})
		.instruction()
	return { ix }
}

type DepositIxParams = {
	args: {
		inputQuoteAmount: BN
	}
	accounts: {
		payer: PublicKey
		payerBaseTokenAccount: PublicKey
		payerQuoteTokenAccount: PublicKey
		adminConfig: PublicKey
		prepareSwapWhirlpool: PublicKey
		prepareSwapWhirlpoolBaseTokenVault: PublicKey
		prepareSwapWhirlpoolQuoteTokenVault: PublicKey
		prepareSwapTickArray0: PublicKey
		prepareSwapTickArray1: PublicKey
		prepareSwapTickArray2: PublicKey
		prepareSwapOracle: PublicKey
		vault: PublicKey
		vaultBaseTokenAccount: PublicKey
		vaultQuoteTokenAccount: PublicKey
		whirlpoolPosition: PublicKey
		whirlpoolPositionTokenAccount: PublicKey
		whirlpoolPositionTickArrayLower: PublicKey
		whirlpoolPositionTickArrayUpper: PublicKey
		whirlpool: PublicKey
		whirlpoolBaseTokenVault: PublicKey
		whirlpoolQuoteTokenVault: PublicKey
		driftState: PublicKey
		driftBaseTokenOracle: PublicKey
		driftBaseSpotMarket: PublicKey
		driftQuoteSpotMarket: PublicKey
		driftStats: PublicKey
		driftSubaccount: PublicKey
		driftBaseSpotMarketVault: PublicKey
		driftQuoteSpotMarketVault: PublicKey
		driftSigner: PublicKey
	}
}

export const depositIx = async ({ args: { inputQuoteAmount }, accounts }: DepositIxParams) => {
	const ix = await program.methods
		.deposit(inputQuoteAmount)
		.accountsStrict({
			...accounts,
			driftProgram: DRIFT_PROGRAM_ID,
			whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
			tokenProgram: TOKEN_PROGRAM_ID,
			systemProgram: SystemProgram.programId,
		})
		.instruction()
	return { ix }
}
