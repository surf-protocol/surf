import { PublicKey, TransactionInstruction, Signer } from '@solana/web3.js'

declare module '@solana/spl-token' {
	export function getAssociatedTokenAddressSync(
		mint: PublicKey,
		owner: PublicKey,
		allowOwnerOffCurve?: boolean,
		programId?: PublicKey,
		associatedTokenProgramId?: PublicKey,
	): PublicKey

	export function createAssociatedTokenAccountInstruction(
		payer: PublicKey,
		associatedToken: PublicKey,
		owner: PublicKey,
		mint: PublicKey,
		programId?: PublicKey,
		associatedTokenProgramId?: PublicKey,
	): TransactionInstruction

	export function createCloseAccountInstruction(
		account: PublicKey,
		destination: PublicKey,
		authority: PublicKey,
		multiSigners?: Signer[],
		programId?: PublicKey,
	): TransactionInstruction

	export function createSyncNativeInstruction(
		account: PublicKey,
		programId?: PublicKey,
	): TransactionInstruction

	export function createTransferInstruction(
		source: PublicKey,
		destination: PublicKey,
		owner: PublicKey,
		amount: number | bigint,
		multiSigners?: Signer[],
		programId?: PublicKey,
	): TransactionInstruction

	export function createInitializeMintInstruction(
		mint: PublicKey,
		decimals: number,
		mintAuthority: PublicKey,
		freezeAuthority: null | PublicKey,
		programId?: PublicKey,
	): TransactionInstruction

	export function createMintToInstruction(
		mint: PublicKey,
		destination: PublicKey,
		authority: PublicKey,
		amount: number | bigint,
		multiSigners?: Signer[],
		programId?: PublicKey,
	): TransactionInstruction
}
