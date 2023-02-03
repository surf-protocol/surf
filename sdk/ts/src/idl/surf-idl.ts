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
			name: 'openWhirlpoolPosition'
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
			name: 'depositLiquidity'
			accounts: [
				{
					name: 'payer'
					isMut: true
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
					name: 'vault'
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
					name: 'userPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'prepareSwapWhirlpool'
					isMut: true
					isSigner: false
				},
				{
					name: 'prepareSwapWhirlpoolBaseTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'prepareSwapWhirlpoolQuoteTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'prepareSwapTickArray0'
					isMut: true
					isSigner: false
				},
				{
					name: 'prepareSwapTickArray1'
					isMut: true
					isSigner: false
				},
				{
					name: 'prepareSwapTickArray2'
					isMut: true
					isSigner: false
				},
				{
					name: 'prepareSwapOracle'
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
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolPositionTickArrayLower'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolPositionTickArrayUpper'
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
			]
			args: [
				{
					name: 'whirlpoolDepositQuoteAmount'
					type: 'u64'
				},
				{
					name: 'whirlpoolDepositQuoteAmountMax'
					type: 'u64'
				},
			]
		},
		{
			name: 'deposit'
			accounts: [
				{
					name: 'payer'
					isMut: true
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
					name: 'adminConfig'
					isMut: false
					isSigner: false
				},
				{
					name: 'prepareSwapWhirlpool'
					isMut: true
					isSigner: false
				},
				{
					name: 'prepareSwapWhirlpoolBaseTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'prepareSwapWhirlpoolQuoteTokenVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'prepareSwapTickArray0'
					isMut: true
					isSigner: false
				},
				{
					name: 'prepareSwapTickArray1'
					isMut: true
					isSigner: false
				},
				{
					name: 'prepareSwapTickArray2'
					isMut: true
					isSigner: false
				},
				{
					name: 'prepareSwapOracle'
					isMut: false
					isSigner: false
				},
				{
					name: 'vault'
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
					name: 'whirlpoolPosition'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolPositionTokenAccount'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolPositionTickArrayLower'
					isMut: true
					isSigner: false
				},
				{
					name: 'whirlpoolPositionTickArrayUpper'
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
					name: 'driftState'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftSigner'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftQuoteSpotMarketVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftBaseSpotMarketVault'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftBaseTokenOracle'
					isMut: false
					isSigner: false
				},
				{
					name: 'driftBaseSpotMarket'
					isMut: true
					isSigner: false
				},
				{
					name: 'driftQuoteSpotMarket'
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
					name: 'hedgeSwapWhirlpool'
					isMut: false
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
					name: 'tokenProgram'
					isMut: false
					isSigner: false
				},
				{
					name: 'systemProgram'
					isMut: false
					isSigner: false
				},
			]
			args: [
				{
					name: 'inputQuoteAmount'
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
						name: 'liquidity'
						type: 'u128'
					},
					{
						name: 'baseTokenTotalFeeGrowth'
						type: 'u128'
					},
					{
						name: 'quoteTokenTotalFeeGrowth'
						type: 'u128'
					},
					{
						name: 'baseTokenFeeUnclaimed'
						type: 'u128'
					},
					{
						name: 'quoteTokenFeeUnclaimed'
						type: 'u128'
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
						name: 'isActive'
						type: 'bool'
					},
					{
						name: 'whirlpoolPosition'
						type: 'publicKey'
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
						type: 'i32'
					},
				]
			}
		},
	]
	errors: [
		{
			code: 6000
			name: 'InvalidAdmin'
			msg: 'admin account key does not correspond with admin_config admin_key'
		},
		{
			code: 6001
			name: 'InvalidQuoteTokenMint'
			msg: 'Quote token mint has to be USDC'
		},
		{
			code: 6002
			name: 'FullTickRangeTooSmall'
			msg: 'Whirlpool position price range should be higher than 400 ticks'
		},
		{
			code: 6003
			name: 'VaultTickRangeTooSmall'
			msg: 'Vault tick range should be higher than 200 ticks'
		},
		{
			code: 6004
			name: 'VaultTickRangeTooBig'
			msg: 'Vault tick range should be lower or equal than 50% of full tick range'
		},
		{
			code: 6005
			name: 'HedgeTickRangeTooSmall'
			msg: 'Hegde tick range should be higher than 20 ticks'
		},
		{
			code: 6006
			name: 'HedgeTickRangeTooBig'
			msg: 'Hegde tick range should be lower than vault tick range'
		},
		{
			code: 6007
			name: 'InvalidDriftAccountStatsAccount'
			msg: 'Could not deserialize drift_account_stats'
		},
		{
			code: 6008
			name: 'InvalidProvidedTickRange'
			msg: 'Provided tick range does not correspond to vault preset'
		},
		{
			code: 6009
			name: 'CurrentTickIndexShiftedFromMidRange'
			msg: 'Current tick index is shifted too many ticks from middle of full tick range'
		},
		{
			code: 6010
			name: 'LowerTickIndexOutOfBounds'
			msg: 'Lower tick index is lower than -443636'
		},
		{
			code: 6011
			name: 'UpperTickIndexOutOfBounds'
			msg: 'Upper tick index is higher than 443636'
		},
		{
			code: 6012
			name: 'BaseTokenOverflow'
			msg: 'Input quote amount is too high'
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
			name: 'TokenMaxExceeded'
			msg: 'Exceeded token max'
		},
		{
			code: 6016
			name: 'NumberDownCastError'
			msg: 'Unable to down cast number'
		},
		{
			code: 6017
			name: 'MultiplicationOverflow'
			msg: 'Multiplication overflow'
		},
		{
			code: 6018
			name: 'MultiplicationShiftRightOverflow'
			msg: 'Multiplication with shift right overflow'
		},
	]
}
