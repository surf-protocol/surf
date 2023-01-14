import fs from 'node:fs'
import dotenv from 'dotenv'
import { Keypair } from '@solana/web3.js'
import { setProvider, AnchorProvider, workspace, Program } from '@project-serum/anchor'

import { SurfProtocol } from '../../target/types/surf_protocol.js'

dotenv.config()

export const program = workspace.SurfProtocol as Program<SurfProtocol>
export const provider = AnchorProvider.env()
setProvider(provider)

export const connection = provider.connection

const walletPath = process.env.ANCHOR_WALLET
const walletPkSerialized = fs.readFileSync(walletPath, { encoding: 'utf-8' })
const walletPk = new Uint8Array(JSON.parse(walletPkSerialized))
export const wallet = Keypair.fromSecretKey(walletPk)
