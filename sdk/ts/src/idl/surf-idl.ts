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
			name: 'initializeVault'
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
					name: 'vault'
					isMut: true
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
					name: 'driftState'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolProgram'
					isMut: false
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
			name: 'openVaultPosition'
			accounts: [
				{
					name: 'payer'
					isMut: true
					isSigner: true
				},
				{
					name: 'whirlpool'
					isMut: false
					isSigner: false
				},
				{
					name: 'vault'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultPosition'
					isMut: true
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
					name: 'rent'
					isMut: false
					isSigner: false
				},
				{
					name: 'associatedTokenProgram'
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
			name: 'collectVaultFees'
			accounts: [
				{
					name: 'payer'
					isMut: false
					isSigner: true
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
					name: 'tickArrayLower'
					isMut: false
					isSigner: false
				},
				{
					name: 'tickArrayUpper'
					isMut: false
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
					name: 'vault'
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
					name: 'vaultPosition'
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
			name: 'openUserPosition'
			accounts: [
				{
					name: 'positionAuthority'
					isMut: true
					isSigner: true
				},
				{
					name: 'whirlpool'
					isMut: false
					isSigner: false
				},
				{
					name: 'vault'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'userPosition'
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
			name: 'syncUserPosition'
			accounts: [
				{
					name: 'authority'
					isMut: false
					isSigner: true
				},
				{
					name: 'vault'
					isMut: false
					isSigner: false
				},
				{
					name: 'userPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'currentVaultPosition'
					isMut: true
					isSigner: false
				},
			]
			args: []
		},
		{
			name: 'collectUserFees'
			accounts: [
				{
					name: 'authority'
					isMut: false
					isSigner: true
				},
				{
					name: 'authorityBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'authorityQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'vault'
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
			name: 'depositLiquidity'
			accounts: [
				{
					name: 'payer'
					isMut: false
					isSigner: true
				},
				{
					name: 'payerBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'payerQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'userPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'vaultPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'vault'
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
					name: 'whirlpoolPosition'
					isMut: false
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
					name: 'tickArrayLower'
					isMut: false
					isSigner: false
				},
				{
					name: 'tickArrayUpper'
					isMut: false
					isSigner: false
				},
				{
					name: 'swapWhirlpool'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapWhirlpoolBaseTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapWhirlpoolQuoteTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'tickArray0'
					isMut: true
					isSigner: false
				},
				{
					name: 'tickArray1'
					isMut: true
					isSigner: false
				},
				{
					name: 'tickArray2'
					isMut: true
					isSigner: false
				},
				{
					name: 'swapOracle'
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
					name: 'liquidityInput'
					type: 'u128'
				},
				{
					name: 'depositQuoteInputMax'
					type: 'u64'
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
			name: 'UserPosition'
			type: {
				kind: 'struct'
				fields: [
					{
						name: 'bump'
						type: 'u8'
					},
					{
						name: 'vault'
						type: 'publicKey'
					},
					{
						name: 'liquidity'
						type: 'u128'
					},
					{
						name: 'isHedged'
						type: 'bool'
					},
					{
						name: 'collateralQuoteAmount'
						type: 'u64'
					},
					{
						name: 'borrowBaseAmount'
						type: 'u64'
					},
					{
						name: 'vaultPositionCheckpoint'
						docs: ['Id of active vault position at time of last sync']
						type: 'u64'
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
						name: 'hedgeAdjustmentLossCheckpointBaseToken'
						type: 'u128'
					},
					{
						name: 'hedgeAdjustmentLossCheckpointQuoteToken'
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
						name: 'hedgeLossUnclaimedBaseToken'
						type: 'u64'
					},
					{
						name: 'hedgeLossUnclaimedQuoteToken'
						type: 'u64'
					},
				]
			}
		},
		{
			name: 'VaultPosition'
			type: {
				kind: 'struct'
				fields: [
					{
						name: 'bump'
						type: 'u8'
					},
					{
						name: 'vault'
						type: 'publicKey'
					},
					{
						name: 'whirlpoolPosition'
						type: 'publicKey'
					},
					{
						name: 'id'
						type: 'u64'
					},
					{
						name: 'isClosed'
						type: 'bool'
					},
					{
						name: 'liquidity'
						type: 'u128'
					},
					{
						name: 'closeSqrtPrice'
						type: {
							option: 'u128'
						}
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
						name: 'feeGrowthBaseToken'
						type: 'u128'
					},
					{
						name: 'feeGrowthQuoteToken'
						type: 'u128'
					},
					{
						name: 'rangeAdjustmentLiquidityDiff'
						type: 'i128'
					},
					{
						name: 'hedgeAdjustmentLossBaseToken'
						type: 'u128'
					},
					{
						name: 'hedgeAdjustmentLossQuoteToken'
						type: 'u128'
					},
					{
						name: 'vaultUpperTickIndex'
						type: 'i32'
					},
					{
						name: 'vaultLowerTickIndex'
						type: 'i32'
					},
					{
						name: 'lastHedgeAdjustmentTickIndex'
						type: {
							option: 'i32'
						}
					},
				]
			}
		},
		{
			name: 'Vault'
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
						name: 'baseTokenAccount'
						type: 'publicKey'
					},
					{
						name: 'quoteTokenMint'
						type: 'publicKey'
					},
					{
						name: 'quoteTokenAccount'
						type: 'publicKey'
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
						name: 'isActive'
						type: 'bool'
					},
					{
						name: 'vaultPositionsCount'
						type: 'u64'
					},
					{
						name: 'currentVaultPositionId'
						type: {
							option: 'u64'
						}
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
			name: 'PositionCanNotBeOpen'
			msg: 'Position can not be open on inactive vault'
		},
		{
			code: 6009
			name: 'PositionAlreadyOpen'
			msg: 'Position is already open'
		},
		{
			code: 6010
			name: 'InvalidVaultPositionId'
			msg: 'Invalid vault position id'
		},
		{
			code: 6011
			name: 'LowerTickIndexOutOfBounds'
			msg: 'Lower tick index is lower than -443636'
		},
		{
			code: 6012
			name: 'UpperTickIndexOutOfBounds'
			msg: 'Upper tick index is higher than 443636'
		},
		{
			code: 6013
			name: 'SlippageExceeded'
			msg: 'Deposit amount is higher than max amount allowed'
		},
		{
			code: 6014
			name: 'WhirlpoolMintsNotMatching'
			msg: 'Token mints of whirlpools are not matching'
		},
		{
			code: 6015
			name: 'InvalidWhirlpool'
			msg: 'Whirlpool does not correspond to vault whirlpool'
		},
		{
			code: 6016
			name: 'InvalidWhirlpoolPosition'
			msg: 'Whirlpool position does not correspond to vault whirlpool position'
		},
		{
			code: 6017
			name: 'UserPositionNotSynced'
			msg: 'Position is not synced to current state, call sync_user_position first'
		},
		{
			code: 6018
			name: 'VaultPositionNotOpened'
			msg: 'Provided vault position is not opened'
		},
		{
			code: 6019
			name: 'VaultPositionNotUpdated'
			msg: 'Vault position fees are not updated, call collect_vault_fees'
		},
		{
			code: 6020
			name: 'MissingPreviousVaultPositions'
			msg: 'Can not update user position without providing previous vault positions'
		},
		{
			code: 6021
			name: 'BaseTokenOverflow'
			msg: 'Input quote amount is too high'
		},
		{
			code: 6022
			name: 'LiquidityOverflow'
			msg: 'Liquidity overflow'
		},
		{
			code: 6023
			name: 'LiquidityDiffTooHigh'
			msg: 'Liquidity diff is too high'
		},
		{
			code: 6024
			name: 'TokenMaxExceeded'
			msg: 'Exceeded token max'
		},
		{
			code: 6025
			name: 'NumberDownCastError'
			msg: 'Unable to down cast number'
		},
		{
			code: 6026
			name: 'MultiplicationOverflow'
			msg: 'Multiplication overflow'
		},
		{
			code: 6027
			name: 'MultiplicationShiftRightOverflow'
			msg: 'Multiplication with shift right overflow'
		},
	]
}
