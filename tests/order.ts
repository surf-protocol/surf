import { LAMPORTS_PER_SOL } from '@solana/web3.js'

import { wallet, connection } from './utils/load-config.js'

await connection.requestAirdrop(wallet.publicKey, 1_000_000 * LAMPORTS_PER_SOL)

import './initialize-admin-config.test.js'
import './initialize-vault.test.js'
import './open-whirlpool-position.test.js'
