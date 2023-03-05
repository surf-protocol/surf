export type SurfIDL = {
	version: '0.1.0'
	name: 'surf'
	instructions: [
		{
			name: 'initializeAdminConfig'
			accounts: [
				{
					name: 'adminConfig'
					isMut: true
					isSigner: false
				},
				{
					name: 'admin'
					isMut: true
					isSigner: true
				},
				{
					name: 'systemProgram'
					isMut: false
					isSigner: false
				},
			]
			args: []
		},
		{
			name: 'initializeVaultState'
			accounts: [
				{
					name: 'admin'
					isMut: true
					isSigner: true
				},
				{
					name: 'adminConfig'
					isMut: false
					isSigner: false
				},
				{
					name: 'whirlpool'
					isMut: false
					isSigner: false
				},
				{
					name: 'baseTokenMint'
					isMut: false
					isSigner: false
				},
				{
					name: 'quoteTokenMint'
					isMut: false
					isSigner: false
				},
				{
					name: 'vaultState'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftState'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftStats'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftSubaccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'systemProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'tokenProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'associatedTokenProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'rent'
					isMut: false
					isSigner: false
				},
			]
			args: [
				{
					name: 'fullTickRange'
					type: 'u32'
				},
				{
					name: 'vaultTickRange'
					type: 'u32'
				},
				{
					name: 'hedgeTickRange'
					type: 'u32'
				},
			]
		},
		{
			name: 'openWhirlpoolPosition'
			accounts: [
				{
					name: 'payer'
					isMut: true
					isSigner: true
				},
				{
					name: 'vaultState'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultWhirlpoolPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpool'
					isMut: false
					isSigner: false
				},
				{
					name: 'whirlpoolPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolPositionMint'
					isMut: true
					isSigner: true
				},
				{
					name: 'whirlpoolPositionTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'systemProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'tokenProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'associatedTokenProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'rent'
					isMut: false
					isSigner: false
				},
			]
			args: [
				{
					name: 'positionBump'
					type: 'u8'
				},
			]
		},
		{
			name: 'openHedgePosition'
			accounts: [
				{
					name: 'payer'
					isMut: true
					isSigner: true
				},
				{
					name: 'vaultState'
					isMut: false
					isSigner: false
				},
				{
					name: 'vaultHedgePosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'systemProgram'
					isMut: false
					isSigner: false
				},
			]
			args: []
		},
		{
			name: 'syncWhirlpoolPosition'
			accounts: [
				{
					name: 'vaultState'
					isMut: false
					isSigner: false
				},
				{
					name: 'vaultBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultWhirlpoolPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpool'
					isMut: false
					isSigner: false
				},
				{
					name: 'whirlpoolBaseTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolQuoteTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolPositionTokenAccount'
					isMut: false
					isSigner: false
				},
				{
					name: 'tickArrayLower'
					isMut: true
					isSigner: false
				},
				{
					name: 'tickArrayUpper'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'tokenProgram'
					isMut: false
					isSigner: false
				},
			]
			args: []
		},
		{
			name: 'increaseLiquidity'
			accounts: [
				{
					name: 'owner'
					isMut: false
					isSigner: true
				},
				{
					name: 'ownerBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'ownerQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'userPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultState'
					isMut: false
					isSigner: false
				},
				{
					name: 'vaultBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultWhirlpoolPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolPositionTokenAccount'
					isMut: false
					isSigner: false
				},
				{
					name: 'whirlpool'
					isMut: false
					isSigner: false
				},
				{
					name: 'whirlpoolBaseTokenAccount'
					isMut: false
					isSigner: false
				},
				{
					name: 'whirlpoolQuoteTokenAccount'
					isMut: false
					isSigner: false
				},
				{
					name: 'tickArrayLower'
					isMut: true
					isSigner: false
				},
				{
					name: 'tickArrayUpper'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'tokenProgram'
					isMut: false
					isSigner: false
				},
			]
			args: [
				{
					name: 'liquidityInput'
					type: 'u128'
				},
				{
					name: 'baseTokenMax'
					type: 'u64'
				},
				{
					name: 'quoteTokenMax'
					type: 'u64'
				},
			]
		},
		{
			name: 'decreaseLiquidity'
			accounts: [
				{
					name: 'owner'
					isMut: false
					isSigner: true
				},
				{
					name: 'ownerBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'ownerQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'userPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultState'
					isMut: false
					isSigner: false
				},
				{
					name: 'vaultBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultWhirlpoolPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpool'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolBaseTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolQuoteTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolPositionTokenAccount'
					isMut: false
					isSigner: false
				},
				{
					name: 'tickArrayLower'
					isMut: true
					isSigner: false
				},
				{
					name: 'tickArrayUpper'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'tokenProgram'
					isMut: false
					isSigner: false
				},
			]
			args: [
				{
					name: 'liquidity'
					type: 'u128'
				},
			]
		},
		{
			name: 'increaseLiquidityHedge'
			accounts: [
				{
					name: 'owner'
					isMut: false
					isSigner: true
				},
				{
					name: 'ownerQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'userPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpool'
					isMut: false
					isSigner: false
				},
				{
					name: 'vaultState'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultWhirlpoolPosition'
					isMut: false
					isSigner: false
				},
				{
					name: 'vaultHedgePosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftSigner'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftState'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftStats'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftSubaccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftBaseTokenOracle'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftQuoteTokenOracle'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftBorrowVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftBorrowSpotMarket'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftCollateralVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftCollateralSpotMarket'
					isMut: false
					isSigner: false
				},
				{
					name: 'swapWhirlpool'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapWhirlpoolBaseTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapWhirlpoolQuoteTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapTickArray0'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapTickArray1'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapTickArray2'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapOracle'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'whirlpoolProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'tokenProgram'
					isMut: false
					isSigner: false
				},
			]
			args: [
				{
					name: 'borrowAmount'
					type: 'u64'
				},
			]
		},
		{
			name: 'decreaseLiquidityHedge'
			accounts: [
				{
					name: 'owner'
					isMut: false
					isSigner: true
				},
				{
					name: 'ownerBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'ownerQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultState'
					isMut: false
					isSigner: false
				},
				{
					name: 'vaultBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'userPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'hedgePosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftSigner'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftState'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftSubaccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftStats'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftBorrowVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftBorrowSpotMarket'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftCollateralVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftCollateralSpotMarket'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftBaseTokenOracle'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftQuoteTokenOracle'
					isMut: false
					isSigner: false
				},
				{
					name: 'swapWhirlpool'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapWhirlpoolBaseTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapWhirlpoolQuoteTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapOracle'
					isMut: false
					isSigner: false
				},
				{
					name: 'swapTickArray0'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapTickArray1'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapTickArray2'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'whirlpoolProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'tokenProgram'
					isMut: false
					isSigner: false
				},
			]
			args: [
				{
					name: 'borrowAmount'
					type: 'u64'
				},
			]
		},
		{
			name: 'syncUserWhirlpoolPosition'
			docs: [
				'Synchronizes user whirlpool position fees, rewards and liquidity to match current state',
				'',
				'As vault whirlpool position adjusts, liquidity provided changes and needs to be stored',
				'separately per each whirlpool position to be able to calculate fees and rewards for user',
				'',
				'**Requires** previous vault_whirlpool_positions which the user_position was not yet synced with',
				'up until the active one (no need to provide all at once) sorted by each whirlpool position id',
				'from the oldest to the newest in remaining accounts',
				'all the accounts are not signers, and not writable',
			]
			accounts: [
				{
					name: 'owner'
					isMut: false
					isSigner: true
				},
				{
					name: 'userPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultState'
					isMut: false
					isSigner: false
				},
			]
			args: []
		},
		{
			name: 'syncUserHedgePosition'
			docs: [
				'Synchronizes user hedge position interests and token amounts to match current state',
				'',
				'As vault hedge adjusts borrow amounts for each adjustment need to be stored separately',
				'in order to be able to compute user interest for each adjustment stage',
				'',
				'**Requires** previous hedge_positions which the user_position was not yet synced with',
				'up until the active one (no need to provide all at once) sorted by each hedge position id',
				'from the oldest to the newest in remaining accounts',
				'all the accounts are not signers, and not writable',
			]
			accounts: [
				{
					name: 'owner'
					isMut: false
					isSigner: true
				},
				{
					name: 'userPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultState'
					isMut: false
					isSigner: false
				},
			]
			args: []
		},
		{
			name: 'collectUserFeesAndRewards'
			accounts: [
				{
					name: 'owner'
					isMut: false
					isSigner: true
				},
				{
					name: 'ownerBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'ownerQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultState'
					isMut: false
					isSigner: false
				},
				{
					name: 'whirlpool'
					isMut: false
					isSigner: false
				},
				{
					name: 'vaultBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'userPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'tokenProgram'
					isMut: false
					isSigner: false
				},
			]
			args: []
		},
		{
			name: 'claimUserBorrowInterest'
			accounts: [
				{
					name: 'owner'
					isMut: false
					isSigner: true
				},
				{
					name: 'ownerBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'userPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultState'
					isMut: false
					isSigner: false
				},
				{
					name: 'vaultBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultHedgePosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftState'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftStats'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftSubaccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftBorrowVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftBorrowSpotMarket'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftBaseTokenOracle'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'tokenProgram'
					isMut: false
					isSigner: false
				},
			]
			args: []
		},
		{
			name: 'claimUserCollateralInterest'
			accounts: [
				{
					name: 'owner'
					isMut: false
					isSigner: true
				},
				{
					name: 'ownerQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'userPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultState'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftState'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftSigner'
					isMut: false
					isSigner: false
					docs: ['CHECKED: Drift CPI']
				},
				{
					name: 'driftStats'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftSubaccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftCollateralVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftCollateralSpotMarket'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftBorrowSpotMarket'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftQuoteTokenOracle'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'tokenProgram'
					isMut: false
					isSigner: false
				},
			]
			args: []
		},
		{
			name: 'adjustVaultHedgeAbove'
			accounts: [
				{
					name: 'whirlpool'
					isMut: false
					isSigner: false
				},
				{
					name: 'vaultState'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultWhirlpoolPosition'
					isMut: false
					isSigner: false
				},
				{
					name: 'currentVaultHedgePosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'nextVaultHedgePosition'
					isMut: false
					isSigner: false
					docs: [
						'If `next_vault_hedge_position` is not needed meaning not all borrow positions inside of',
						'`current_vault_hedge_position` are used, pass as Pubkey::default()',
					]
				},
				{
					name: 'swapWhirlpool'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapWhirlpoolBaseTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapWhirlpoolQuoteTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapTickArray0'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapTickArray1'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapTickArray2'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapOracle'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftState'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftStats'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftSubaccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftBorrowVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftBorrowSpotMarket'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftBaseTokenOracle'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'whirlpoolProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'tokenProgram'
					isMut: false
					isSigner: false
				},
			]
			args: []
		},
		{
			name: 'adjustVaultHedgeBelow'
			accounts: [
				{
					name: 'whirlpool'
					isMut: false
					isSigner: false
				},
				{
					name: 'vaultState'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultWhirlpoolPosition'
					isMut: false
					isSigner: false
				},
				{
					name: 'currentVaultHedgePosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'nextVaultHedgePosition'
					isMut: false
					isSigner: false
					docs: [
						'If `next_vault_hedge_position` is not needed meaning not all borrow positions inside of',
						'`current_vault_hedge_position` are used, pass as Pubkey::default()',
					]
				},
				{
					name: 'driftSigner'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftState'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftStats'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftSubaccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftBorrowVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftBorrowSpotMarket'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftCollateralSpotMarket'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftBaseTokenOracle'
					isMut: false
					isSigner: false
				},
				{
					name: 'swapWhirlpool'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapWhirlpoolBaseTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapWhirlpoolQuoteTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapTickArray0'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapTickArray1'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapTickArray2'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapOracle'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'whirlpoolProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'tokenProgram'
					isMut: false
					isSigner: false
				},
			]
			args: []
		},
		{
			name: 'adjustWhirlpoolPosition'
			accounts: [
				{
					name: 'payer'
					isMut: true
					isSigner: true
				},
				{
					name: 'vaultState'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultWhirlpoolPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolPositionTokenAccount'
					isMut: false
					isSigner: false
				},
				{
					name: 'positionTickArrayLower'
					isMut: true
					isSigner: false
				},
				{
					name: 'positionTickArrayUpper'
					isMut: true
					isSigner: false
				},
				{
					name: 'nextVaultWhirlpoolPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'nextWhirlpoolPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'nextWhirlpoolPositionTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'nextWhirlpoolPositionMint'
					isMut: true
					isSigner: false
				},
				{
					name: 'nextPositionTickArrayLower'
					isMut: true
					isSigner: false
				},
				{
					name: 'nextPositionTickArrayUpper'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpool'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolBaseTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolQuoteTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapWhirlpool'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapWhirlpoolBaseTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapWhirlpoolQuoteTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapWhirlpoolOracle'
					isMut: false
					isSigner: false
				},
				{
					name: 'swapTickArray0'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapTickArray1'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapTickArray2'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'tokenProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'systemProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'associatedTokenProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'rent'
					isMut: false
					isSigner: false
				},
			]
			args: [
				{
					name: 'nextPositionBump'
					type: 'u8'
				},
			]
		},
	]
	accounts: [
		{
			name: 'AdminConfig'
			type: {
				kind: 'struct'
				fields: [
					{
						name: 'adminKey'
						type: 'publicKey'
					},
					{
						name: 'bump'
						type: 'u8'
					},
				]
			}
		},
		{
			name: 'HedgePosition'
			type: {
				kind: 'struct'
				fields: [
					{
						name: 'bump'
						type: 'u8'
					},
					{
						name: 'vaultState'
						type: 'publicKey'
					},
					{
						name: 'id'
						type: 'u64'
					},
					{
						name: 'currentBorrowPositionIndex'
						type: 'u8'
					},
					{
						name: 'borrowPositions'
						type: {
							array: [
								{
									defined: 'BorrowPosition'
								},
								150,
							]
						}
					},
				]
			}
		},
		{
			name: 'UserPosition'
			type: {
				kind: 'struct'
				fields: [
					{
						name: 'bump'
						type: 'u8'
					},
					{
						name: 'liquidity'
						type: 'u128'
					},
					{
						name: 'feeGrowthCheckpointBaseToken'
						type: 'u128'
					},
					{
						name: 'feeGrowthCheckpointQuoteToken'
						type: 'u128'
					},
					{
						name: 'feeUnclaimedBaseToken'
						type: 'u64'
					},
					{
						name: 'feeUnclaimedQuoteToken'
						type: 'u64'
					},
					{
						name: 'collateralAmount'
						type: 'u64'
					},
					{
						name: 'borrowAmount'
						type: 'u64'
					},
					{
						name: 'borrowAmountNotional'
						type: 'u64'
					},
					{
						name: 'collateralInterestGrowthCheckpoint'
						type: 'u128'
					},
					{
						name: 'borrowInterestGrowthCheckpoint'
						type: 'u128'
					},
					{
						name: 'collateralInterestUnclaimed'
						type: 'u64'
					},
					{
						name: 'borrowInterestUnclaimed'
						type: 'u64'
					},
					{
						name: 'whirlpoolPositionId'
						type: 'u64'
					},
					{
						name: 'hedgePositionId'
						type: 'u64'
					},
					{
						name: 'borrowPositionIndex'
						type: 'u8'
					},
				]
			}
		},
		{
			name: 'VaultState'
			type: {
				kind: 'struct'
				fields: [
					{
						name: 'bump'
						type: 'u8'
					},
					{
						name: 'whirlpool'
						type: 'publicKey'
					},
					{
						name: 'baseTokenMint'
						type: 'publicKey'
					},
					{
						name: 'quoteTokenMint'
						type: 'publicKey'
					},
					{
						name: 'baseTokenAccount'
						type: 'publicKey'
					},
					{
						name: 'quoteTokenAccount'
						type: 'publicKey'
					},
					{
						name: 'fullTickRange'
						type: 'u32'
					},
					{
						name: 'vaultTickRange'
						type: 'u32'
					},
					{
						name: 'hedgeTickRange'
						type: 'u32'
					},
					{
						name: 'whirlpoolPositionsCount'
						type: 'u64'
					},
					{
						name: 'currentWhirlpoolPositionId'
						type: {
							option: 'u64'
						}
					},
					{
						name: 'whirlpoolAdjustmentState'
						type: {
							defined: 'WhirlpoolAdjustmentState'
						}
					},
					{
						name: 'driftStats'
						type: 'publicKey'
					},
					{
						name: 'driftSubaccount'
						type: 'publicKey'
					},
					{
						name: 'collateralAmount'
						type: 'u64'
					},
					{
						name: 'collateralInterestGrowth'
						type: 'u128'
					},
					{
						name: 'collateralInterestGrowthCheckpoint'
						type: 'u128'
					},
					{
						name: 'hedgePositionsCount'
						type: 'u64'
					},
					{
						name: 'currentHedgePositionId'
						type: {
							option: 'u64'
						}
					},
					{
						name: 'lastHedgeAdjustmentTick'
						type: {
							option: 'i32'
						}
					},
				]
			}
		},
		{
			name: 'WhirlpoolPosition'
			type: {
				kind: 'struct'
				fields: [
					{
						name: 'bump'
						type: 'u8'
					},
					{
						name: 'vaultState'
						type: 'publicKey'
					},
					{
						name: 'id'
						type: 'u64'
					},
					{
						name: 'whirlpoolPosition'
						type: 'publicKey'
					},
					{
						name: 'liquidity'
						type: 'u128'
					},
					{
						name: 'liquidityDiff'
						type: 'i128'
					},
					{
						name: 'baseTokenFeeGrowth'
						type: 'u128'
					},
					{
						name: 'quoteTokenFeeGrowth'
						type: 'u128'
					},
					{
						name: 'upperSqrtPrice'
						type: 'u128'
					},
					{
						name: 'lowerSqrtPrice'
						type: 'u128'
					},
					{
						name: 'middleSqrtPrice'
						type: 'u128'
					},
					{
						name: 'innerUpperSqrtPrice'
						type: 'u128'
					},
					{
						name: 'innerLowerSqrtPrice'
						type: 'u128'
					},
				]
			}
		},
	]
	types: [
		{
			name: 'BorrowPosition'
			type: {
				kind: 'struct'
				fields: [
					{
						name: 'borrowedAmount'
						type: 'u64'
					},
					{
						name: 'borrowedAmountDiff'
						type: 'i64'
					},
					{
						name: 'borrowedAmountNotional'
						type: 'u64'
					},
					{
						name: 'borrowedAmountNotionalDiff'
						type: 'i64'
					},
					{
						name: 'borrowInterestGrowth'
						type: 'u128'
					},
					{
						name: 'borrowInterestGrowthCheckpoint'
						type: 'u128'
					},
				]
			}
		},
		{
			name: 'WhirlpoolAdjustmentState'
			type: {
				kind: 'enum'
				variants: [
					{
						name: 'None'
					},
					{
						name: 'Above'
					},
					{
						name: 'Below'
					},
				]
			}
		},
		{
			name: 'DriftMarket'
			type: {
				kind: 'enum'
				variants: [
					{
						name: 'Collateral'
					},
					{
						name: 'Borrow'
					},
				]
			}
		},
	]
	errors: [
		{
			code: 6000
			name: 'CustomError'
			msg: ''
		},
		{
			code: 6001
			name: 'InvalidAdmin'
			msg: 'admin account key does not correspond with admin_config admin_key'
		},
		{
			code: 6002
			name: 'InvalidQuoteTokenMint'
			msg: 'Quote token mint has to be USDC'
		},
		{
			code: 6003
			name: 'FullTickRangeTooSmall'
			msg: 'Whirlpool position price range should be higher than 400 ticks'
		},
		{
			code: 6004
			name: 'VaultTickRangeTooSmall'
			msg: 'Vault tick range should be higher than 200 ticks'
		},
		{
			code: 6005
			name: 'VaultTickRangeTooBig'
			msg: 'Vault tick range should be lower or equal than 50% of full tick range'
		},
		{
			code: 6006
			name: 'HedgeTickRangeTooSmall'
			msg: 'Hegde tick range should be higher than 20 ticks'
		},
		{
			code: 6007
			name: 'HedgeTickRangeTooBig'
			msg: 'Hegde tick range should be lower than vault tick range'
		},
		{
			code: 6008
			name: 'InvalidVaultPositionId'
			msg: 'Invalid vault position id'
		},
		{
			code: 6009
			name: 'LowerTickIndexOutOfBounds'
			msg: 'Lower tick index is lower than -443636'
		},
		{
			code: 6010
			name: 'UpperTickIndexOutOfBounds'
			msg: 'Upper tick index is higher than 443636'
		},
		{
			code: 6011
			name: 'SlippageExceeded'
			msg: 'Deposit amount is higher than max amount allowed'
		},
		{
			code: 6012
			name: 'WhirlpoolMintsNotMatching'
			msg: 'Token mints of whirlpools are not matching'
		},
		{
			code: 6013
			name: 'InvalidWhirlpool'
			msg: 'Whirlpool does not correspond to vault whirlpool'
		},
		{
			code: 6014
			name: 'InvalidWhirlpoolPosition'
			msg: 'Whirlpool position does not correspond to vault state'
		},
		{
			code: 6015
			name: 'InvalidHedgePosition'
			msg: 'Hedge position does not correspond to vault state'
		},
		{
			code: 6016
			name: 'WhirlpoolPositionIdOverflow'
			msg: 'Whirlpool position id overflow'
		},
		{
			code: 6017
			name: 'HedgePositionIdOverflow'
			msg: 'Hedge position id overflow'
		},
		{
			code: 6018
			name: 'BorrowPositionIndexOverflow'
			msg: 'Borrow position id overflow'
		},
		{
			code: 6019
			name: 'UserPositionCanNotBeOpen'
			msg: 'Position can not be open on inactive vault'
		},
		{
			code: 6020
			name: 'UserPositionAlreadyHedged'
			msg: 'Vault position is already fully hedged'
		},
		{
			code: 6021
			name: 'UserPositionNotSynced'
			msg: 'Position is not synced to current state, call sync_user_position first'
		},
		{
			code: 6022
			name: 'VaultPositionNotHedged'
			msg: 'Can not adjust hedge of position with 0 hedged liquidity'
		},
		{
			code: 6023
			name: 'VaultPositionAlreadyOpen'
			msg: 'Position is already open'
		},
		{
			code: 6024
			name: 'VaultPositionNotOpened'
			msg: 'Provided vault position is not opened'
		},
		{
			code: 6025
			name: 'VaultPositionNotUpdated'
			msg: 'Vault position fees are not updated, call collect_vault_fees'
		},
		{
			code: 6026
			name: 'MissingPreviousVaultPositions'
			msg: 'Can not update user position without providing previous vault positions'
		},
		{
			code: 6027
			name: 'ZeroLiquidity'
			msg: 'User position does not have any liquidity'
		},
		{
			code: 6028
			name: 'InvalidLiquidity'
			msg: 'User position liquidity is lower than provided liquidity'
		},
		{
			code: 6029
			name: 'ZeroCollateral'
			msg: 'User position does not have any collateral'
		},
		{
			code: 6030
			name: 'ZeroBorrow'
			msg: 'User position does not have any borrow'
		},
		{
			code: 6031
			name: 'InvalidBorrowAmount'
			msg: 'Borrow amount must be lower or equal to the user borrow'
		},
		{
			code: 6032
			name: 'ZeroBaseTokenWhirlpoolAmount'
			msg: 'Current base token amount in whirlpool is zero, can not hedge 0'
		},
		{
			code: 6033
			name: 'CollateralOverflow'
			msg: 'Collateral amount overflow'
		},
		{
			code: 6034
			name: 'BorrowOverflow'
			msg: 'Borrow amount overflow'
		},
		{
			code: 6035
			name: 'BorrowNotionalOverflow'
			msg: 'Borrow amount notional overflow'
		},
		{
			code: 6036
			name: 'BorrowAmountTooHigh'
			msg: 'Borrow amount amount is higher than current whirlpool base token amount'
		},
		{
			code: 6037
			name: 'CollateralInterestOverflow'
			msg: 'Collateral interest overflow'
		},
		{
			code: 6038
			name: 'BorrowInterestOverflow'
			msg: 'Borrow interest overflow'
		},
		{
			code: 6039
			name: 'SqrtPriceNotOutOfBounds'
			msg: 'Sqrt price is not out of bounds'
		},
		{
			code: 6040
			name: 'HedgePositionNotOutOfHedgeTickRange'
			msg: 'Hedge position can not be adjusted until it is not out of hedge tick range'
		},
		{
			code: 6041
			name: 'InvalidWhirlpoolAdjustmentState'
			msg: 'Whirlpool adjustment is not valid'
		},
		{
			code: 6042
			name: 'MissingNextHedgePositionAccount'
			msg: 'Missing next hedge position account'
		},
		{
			code: 6043
			name: 'BaseTokenOverflow'
			msg: 'Input quote amount is too high'
		},
		{
			code: 6044
			name: 'LiquidityOverflow'
			msg: 'Liquidity overflow'
		},
		{
			code: 6045
			name: 'LiquidityDiffTooHigh'
			msg: 'Liquidity diff is too high'
		},
		{
			code: 6046
			name: 'TokenMaxExceeded'
			msg: 'Exceeded token max'
		},
		{
			code: 6047
			name: 'NumberDownCastError'
			msg: 'Unable to down cast number'
		},
		{
			code: 6048
			name: 'MultiplicationOverflow'
			msg: 'Multiplication overflow'
		},
		{
			code: 6049
			name: 'MultiplicationShiftRightOverflow'
			msg: 'Multiplication with shift right overflow'
		},
		{
			code: 6050
			name: 'MathError'
			msg: 'Drift math error'
		},
	]
}
