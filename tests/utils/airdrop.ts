import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'

export const airdrop = async (connection: Connection, wallet: Keypair) => {
	await connection.requestAirdrop(wallet.publicKey, 1_000_000 * LAMPORTS_PER_SOL)
}
