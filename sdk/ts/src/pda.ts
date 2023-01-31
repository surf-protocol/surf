import { getUserAccountPublicKeySync, getUserStatsAccountPublicKey } from '@drift-labs/sdk'
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil } from '@orca-so/whirlpools-sdk'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { Keypair, PublicKey } from '@solana/web3.js'

import { DRIFT_PROGRAM_ID_MAINNET, SURF_PROGRAM_ID } from './constants.js'

export const getAdminConfigProgramAddress = () => {
	return PublicKey.findProgramAddressSync([Buffer.from('admin_config', 'utf-8')], SURF_PROGRAM_ID)
}

export const getVaultProgramAddress = (whirlpoolAddress: PublicKey) => {
	return PublicKey.findProgramAddressSync(
		[Buffer.from('vault', 'utf-8'), whirlpoolAddress.toBuffer()],
		SURF_PROGRAM_ID,
	)
}

export const getVaultTokenAccountsAddresses = (
	vaultAddress: PublicKey,
	baseTokenMint: PublicKey,
	quoteTokenMint: PublicKey,
): [baseTokenAccount: PublicKey, quoteTokenAccount: PublicKey] => [
	getAssociatedTokenAddressSync(baseTokenMint, vaultAddress, true),
	getAssociatedTokenAddressSync(quoteTokenMint, vaultAddress, true),
]

export const getVaultDriftAccountsAddresses = (
	vaultAddress: PublicKey,
	driftProgramId = DRIFT_PROGRAM_ID_MAINNET,
) => {
	const driftStats = getUserStatsAccountPublicKey(driftProgramId, vaultAddress)
	const driftSubaccount = getUserAccountPublicKeySync(driftProgramId, vaultAddress, 0)
	return {
		driftStats,
		driftSubaccount,
	}
}

export const getVaultWhirlpoolPositionAccountsAddresses = (
	vaultAddress: PublicKey,
	whirlpoolProgramId = ORCA_WHIRLPOOL_PROGRAM_ID,
) => {
	const whirlpoolPositionMintKeyPair = new Keypair()
	const { publicKey, bump } = PDAUtil.getPosition(
		whirlpoolProgramId,
		whirlpoolPositionMintKeyPair.publicKey,
	)
	const whirlpoolPositionVaultTokenAccount = getAssociatedTokenAddressSync(
		whirlpoolPositionMintKeyPair.publicKey,
		vaultAddress,
		true,
	)
	return {
		whirlpoolPositionMintKeyPair,
		whirlpoolPositionVaultTokenAccount,
		whirlpoolPositionPDA: publicKey,
		whirlpoolPositionBump: bump,
	}
}
