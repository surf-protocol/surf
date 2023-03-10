import { PublicKey, TransactionInstruction, Signer } from '@solana/web3.js'
import { Structure } from '@solana/buffer-layout'

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

	// eslint-disable-next-line no-shadow
	export enum AccountState {
		Uninitialized = 0,
		Initialized = 1,
		Frozen = 2,
	}

	export interface RawAccount {
		mint: PublicKey
		owner: PublicKey
		amount: bigint
		delegateOption: 1 | 0
		delegate: PublicKey
		state: AccountState
		isNativeOption: 1 | 0
		isNative: bigint
		delegatedAmount: bigint
		closeAuthorityOption: 1 | 0
		closeAuthority: PublicKey
	}
}
