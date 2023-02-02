import { ORCA_WHIRLPOOL_PROGRAM_ID } from '@orca-so/whirlpools-sdk'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'

import { DRIFT_PROGRAM_ID_MAINNET } from '../../sdk/ts/src/constants.js'
import {
	buildInitializeAdminConfigIx,
	buildInitializeVaultIx,
	buildOpenWhirlpoolPositionIx,
} from '../../sdk/ts/src/idl/instructions.js'
import {
	getAdminConfigProgramAddress,
	getVaultDriftAccountsAddresses,
	getVaultProgramAddress,
	getVaultTokenAccountsAddresses,
	getVaultWhirlpoolPositionAccountsAddresses,
} from '../../sdk/ts/src/pda.js'
import { driftStateKey } from './cpi/drift.js'
import { connection, program, wallet } from './load-config.js'
import { baseTokenMint, quoteTokenMint } from './mint.js'
import { buildAndSendTx } from './transaction.js'

export const mockAdminConfig = async () => {
	const [adminConfigPDA] = getAdminConfigProgramAddress()
	const initAdminConfigIx = await buildInitializeAdminConfigIx(program, {
		accounts: {
			adminConfig: adminConfigPDA,
			admin: wallet.publicKey,
			systemProgram: SystemProgram.programId,
		},
	})
	await buildAndSendTx(connection, [wallet], [initAdminConfigIx])
	return adminConfigPDA
}

type MockVaultAccounts = {
	whirlpool: PublicKey
	adminConfigPDA: PublicKey
}

type MockVaultParams = {
	fullTickRange?: number
	vaultTickRange?: number
	hedgeTickRange?: number
}

export const mockVault = async (
	{ whirlpool, adminConfigPDA }: MockVaultAccounts,
	{ fullTickRange = 800, vaultTickRange = 400, hedgeTickRange = 20 }: MockVaultParams = {
		fullTickRange: 800,
		vaultTickRange: 400,
		hedgeTickRange: 20,
	},
) => {
	const [vaultPDA] = getVaultProgramAddress(whirlpool)
	const [vaultBaseTokenAccount, vaultQuoteTokenAccount] = getVaultTokenAccountsAddresses(
		vaultPDA,
		baseTokenMint,
		quoteTokenMint,
	)
	const { driftStats, driftSubaccount } = await getVaultDriftAccountsAddresses(vaultPDA)

	const initVaultIx = await buildInitializeVaultIx(program, {
		args: {
			fullTickRange,
			vaultTickRange,
			hedgeTickRange,
		},
		accounts: {
			vaultBaseTokenAccount,
			vaultQuoteTokenAccount,
			baseTokenMint,
			quoteTokenMint,
			whirlpool,

			admin: wallet.publicKey,
			adminConfig: adminConfigPDA,
			vault: vaultPDA,

			driftState: driftStateKey,
			driftSubaccount,
			driftStats,

			whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
			driftProgram: DRIFT_PROGRAM_ID_MAINNET,
			systemProgram: SystemProgram.programId,
			tokenProgram: TOKEN_PROGRAM_ID,
			rent: SYSVAR_RENT_PUBKEY,
			associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
		},
	})

	await buildAndSendTx(connection, [wallet], [initVaultIx])

	return {
		adminConfigPDA,
		vaultPDA,
		vaultBaseTokenAccount,
		vaultQuoteTokenAccount,
	}
}

export const mockVaultWhirlpoolPosition = async (vault: PublicKey, whirlpool: PublicKey) => {
	const {
		whirlpoolPositionBump,
		whirlpoolPositionMintKeyPair,
		whirlpoolPositionPDA,
		whirlpoolPositionVaultTokenAccount,
	} = getVaultWhirlpoolPositionAccountsAddresses(vault)

	const ix = await buildOpenWhirlpoolPositionIx(program, {
		args: {
			positionBump: whirlpoolPositionBump,
		},
		accounts: {
			payer: wallet.publicKey,
			whirlpool,
			vault: vault,
			whirlpoolPosition: whirlpoolPositionPDA,
			whirlpoolPositionMint: whirlpoolPositionMintKeyPair.publicKey,
			whirlpoolPositionTokenAccount: whirlpoolPositionVaultTokenAccount,

			whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
			tokenProgram: TOKEN_PROGRAM_ID,
			associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
			systemProgram: SystemProgram.programId,
			rent: SYSVAR_RENT_PUBKEY,
		},
	})

	await buildAndSendTx(connection, [wallet, whirlpoolPositionMintKeyPair], [ix])

	return {
		whirlpoolPositionMintKeyPair,
		whirlpoolPositionPDA,
		whirlpoolPositionVaultTokenAccount,
	}
}
