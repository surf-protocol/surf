import fs from 'node:fs'
import dotenv from 'dotenv'
import { Keypair } from '@solana/web3.js'
import { setProvider, AnchorProvider, workspace, Program } from '@coral-xyz/anchor'

import { SurfIDL } from '../../sdk/ts/src/idl/surf-idl.js'
import { Pyth } from '../../target/types/pyth.js'

dotenv.config()

export const pythProgram = workspace.Pyth as Program<Pyth>
export const surfProgram = workspace.Surf as Program<SurfIDL>
export const provider = AnchorProvider.env()
setProvider(provider)

export const connection = provider.connection

const walletPath = process.env.ANCHOR_WALLET
const walletPkSerialized = fs.readFileSync(walletPath, { encoding: 'utf-8' })
const walletPk = new Uint8Array(JSON.parse(walletPkSerialized))
export const wallet = Keypair.fromSecretKey(walletPk)
