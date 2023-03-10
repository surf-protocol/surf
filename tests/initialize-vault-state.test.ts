import { beforeAll, describe, expect, it } from 'vitest'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { UserAccount, UserStatsAccount } from '@drift-labs/sdk'
import {
	ComputeBudgetProgram,
	Keypair,
	PublicKey,
	SystemProgram,
	SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js'

import { wallet, connection, surfProgram } from './utils/load-config'
import { mockWhirlpool } from './utils/cpi/whirlpool'
import { buildAndSendTx } from './utils/transaction'
import { baseTokenMint, quoteTokenMint } from './utils/mint'
import { mockDrift, driftStateAddress, driftProgram } from './utils/cpi/drift'
import {
	getVaultStateAddress,
	getVaultStateTokenAccountsAddresses,
	getVaultStateDriftAccountsAddresses,
} from '../sdk/ts/src/pda'
import { buildInitializeVaultStateIx } from '../sdk/ts/src/idl/instructions'
import { parseVaultStateAccount } from '../sdk/ts/src/idl/state-accounts'
import { mockAdminConfig } from './utils/mock'
import { DRIFT_PROGRAM_ID_MAINNET } from '../sdk/ts/src/constants'
import { initUser } from './utils/init-user'

describe('initialize_vault_state', () => {
	let adminConfigAddress: PublicKey

	beforeAll(async () => {
		await initUser()
		;[adminConfigAddress] = await Promise.all([mockAdminConfig(), mockDrift()])
	})

	it('successfully initializes vault', async () => {
		const { whirlpoolAddress } = await mockWhirlpool()

		const [vaultStateAddress, vaultStateBump] = getVaultStateAddress(whirlpoolAddress)
		const [vaultBaseTokenAccountAddress, vaultQuoteTokenAccountAddress] =
			getVaultStateTokenAccountsAddresses(vaultStateAddress, baseTokenMint, quoteTokenMint)
		const { driftStatsAddress: driftStats, driftSubaccountAddress: driftSubaccount } =
			getVaultStateDriftAccountsAddresses(vaultStateAddress)

		const fullTickRange = 800 // 8%
		const vaultTickRange = 400 // 4%
		const hedgeTickRange = 20 // 0.2% - 10 times per one side of vault range

		const ix = await buildInitializeVaultStateIx(surfProgram, {
			args: {
				fullTickRange,
				vaultTickRange,
				hedgeTickRange,
			},
			accounts: {
				admin: wallet.publicKey,
				adminConfig: adminConfigAddress,
				whirlpool: whirlpoolAddress,
				vaultState: vaultStateAddress,
				baseTokenMint,
				quoteTokenMint,
				vaultBaseTokenAccount: vaultBaseTokenAccountAddress,
				vaultQuoteTokenAccount: vaultQuoteTokenAccountAddress,

				driftStats,
				driftSubaccount,
				driftState: driftStateAddress,

				driftProgram: DRIFT_PROGRAM_ID_MAINNET,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
				rent: SYSVAR_RENT_PUBKEY,
			},
		})

		await buildAndSendTx(
			connection,
			[wallet],
			[ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), ix],
		)

		const vaultStateAi = await connection.getAccountInfo(vaultStateAddress)
		const vaultState = parseVaultStateAccount(surfProgram, vaultStateAi.data)

		expect(vaultState.bump.length).toBe(1)
		expect(vaultState.bump[0]).toBe(vaultStateBump)
		expect(vaultState.whirlpool.equals(whirlpoolAddress)).toBe(true)

		expect(vaultState.baseTokenMint.equals(baseTokenMint)).toBe(true)
		expect(vaultState.quoteTokenMint.equals(quoteTokenMint)).toBe(true)
		expect(vaultState.baseTokenAccount.equals(vaultBaseTokenAccountAddress)).toBe(true)
		expect(vaultState.quoteTokenAccount.equals(vaultQuoteTokenAccountAddress)).toBe(true)

		expect(vaultState.driftStats.equals(driftStats)).toBe(true)
		expect(vaultState.driftSubaccount.equals(driftSubaccount)).toBe(true)

		expect(vaultState.fullTickRange).toBe(fullTickRange)
		expect(vaultState.vaultTickRange).toBe(vaultTickRange)
		expect(vaultState.hedgeTickRange).toBe(hedgeTickRange)

		expect(vaultState.whirlpoolPositionsCount.toNumber()).toBe(0)
		expect(vaultState.currentWhirlpoolPositionId).toBe(null)
		expect(vaultState.whirlpoolAdjustmentState).toHaveProperty('none')

		expect(vaultState.hedgePositionsCount.toNumber()).toBe(0)
		expect(vaultState.currentHedgePositionId).toBe(null)
		expect(vaultState.collateralAmount.toNumber()).toBe(0)
		expect(vaultState.collateralInterestGrowth.toNumber()).toBe(0)
		expect(vaultState.collateralInterestGrowthCheckpoint.toNumber()).toBe(0)
		expect(vaultState.lastHedgeAdjustmentTick).toBe(null)

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		const [driftSubaccountData, driftStatsData] = await Promise.all([
			driftProgram.account['user'].fetch(
				driftSubaccount,
				'confirmed',
			) as Promise<UserAccount>,
			driftProgram.account['userStats'].fetch(
				driftStats,
				'confirmed',
			) as Promise<UserStatsAccount>,
		])

		expect(driftStatsData.authority.equals(vaultStateAddress)).toBe(true)
		expect(driftSubaccountData.authority.equals(driftStatsData.authority)).toBe(true)
	})

	it('fails with invalid admin', async () => {
		const { whirlpoolAddress } = await mockWhirlpool()

		const fakeAdmin = new Keypair()
		await buildAndSendTx(
			connection,
			[wallet],
			[
				SystemProgram.transfer({
					fromPubkey: wallet.publicKey,
					toPubkey: fakeAdmin.publicKey,
					lamports: 1 * 10 ** 9,
				}),
			],
			true,
		)

		const [vaultStateAddress] = getVaultStateAddress(whirlpoolAddress)
		const [vaultBaseTokenAccountAddress, vaultQuoteTokenAccountAddress] =
			getVaultStateTokenAccountsAddresses(vaultStateAddress, baseTokenMint, quoteTokenMint)
		const { driftStatsAddress: driftStats, driftSubaccountAddress: driftSubaccount } =
			getVaultStateDriftAccountsAddresses(vaultStateAddress)

		const ix = await buildInitializeVaultStateIx(surfProgram, {
			args: {
				fullTickRange: 800,
				vaultTickRange: 400,
				hedgeTickRange: 20,
			},
			accounts: {
				admin: fakeAdmin.publicKey,
				adminConfig: adminConfigAddress,
				whirlpool: whirlpoolAddress,
				vaultState: vaultStateAddress,
				baseTokenMint,
				quoteTokenMint,
				vaultBaseTokenAccount: vaultBaseTokenAccountAddress,
				vaultQuoteTokenAccount: vaultQuoteTokenAccountAddress,

				driftStats,
				driftSubaccount,
				driftState: driftStateAddress,

				driftProgram: DRIFT_PROGRAM_ID_MAINNET,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
				rent: SYSVAR_RENT_PUBKEY,
			},
		})

		const res = await buildAndSendTx(
			connection,
			[fakeAdmin],
			[ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), ix],
		)

		expect(res.status).toBe('ERROR')
	})
})
