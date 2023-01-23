export type Surf = {
  "version": "0.1.0",
  "name": "surf",
  "instructions": [
    {
      "name": "initializeAdminConfig",
      "accounts": [
        {
          "name": "adminConfig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "initializeVault",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "adminConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "whirlpool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenMintA",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenVaultA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenMintB",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenVaultB",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "driftStats",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "driftSubaccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "driftState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "whirlpoolProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "driftProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "driftSubaccountId",
          "type": "u16"
        },
        {
          "name": "fullTickRange",
          "type": "u32"
        },
        {
          "name": "vaultTickRange",
          "type": "u32"
        },
        {
          "name": "hedgeTickRange",
          "type": "u32"
        }
      ]
    },
    {
      "name": "openWhirlpoolPosition",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "whirlpool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "whirlpoolPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "whirlpoolPositionMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "whirlpoolPositionTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "whirlpoolProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "positionBump",
          "type": "u8"
        },
        {
          "name": "tickLowerIndex",
          "type": "i32"
        },
        {
          "name": "tickUpperIndex",
          "type": "i32"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "adminConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "adminKey",
            "type": "publicKey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vaultPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "whirlpoolPosition",
            "type": "publicKey"
          },
          {
            "name": "vaultUpperTickIndex",
            "type": "i32"
          },
          {
            "name": "vaultLowerTickIndex",
            "type": "i32"
          },
          {
            "name": "lastHedgeAdjustmentTickIndex",
            "type": "i32"
          }
        ]
      }
    },
    {
      "name": "vault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "whirlpool",
            "type": "publicKey"
          },
          {
            "name": "vaultPosition",
            "type": "publicKey"
          },
          {
            "name": "tokenMintA",
            "type": "publicKey"
          },
          {
            "name": "tokenVaultA",
            "type": "publicKey"
          },
          {
            "name": "tokenMintB",
            "type": "publicKey"
          },
          {
            "name": "tokenVaultB",
            "type": "publicKey"
          },
          {
            "name": "driftStats",
            "type": "publicKey"
          },
          {
            "name": "driftSubaccount",
            "type": "publicKey"
          },
          {
            "name": "liquidity",
            "type": "u128"
          },
          {
            "name": "totalFeeGrowthA",
            "type": "u128"
          },
          {
            "name": "totalFeeGrowthB",
            "type": "u128"
          },
          {
            "name": "feeUnclaimedA",
            "type": "u128"
          },
          {
            "name": "feeUnclaimedB",
            "type": "u128"
          },
          {
            "name": "fullTickRange",
            "type": "u32"
          },
          {
            "name": "vaultTickRange",
            "type": "u32"
          },
          {
            "name": "hedgeTickRange",
            "type": "u32"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidAdmin",
      "msg": "admin account key does not correspond with admin_config admin_key"
    },
    {
      "code": 6001,
      "name": "FullTickRangeTooSmall",
      "msg": "Whirlpool position price range should be higher than 400 ticks"
    },
    {
      "code": 6002,
      "name": "VaultTickRangeTooSmall",
      "msg": "Vault tick range should be higher than 200 ticks"
    },
    {
      "code": 6003,
      "name": "VaultTickRangeTooBig",
      "msg": "Vault tick range should be lower or equal than 50% of full tick range"
    },
    {
      "code": 6004,
      "name": "HedgeTickRangeTooSmall",
      "msg": "Hegde tick range should be higher than 20 ticks"
    },
    {
      "code": 6005,
      "name": "HedgeTickRangeTooBig",
      "msg": "Hegde tick range should be lower than vault tick range"
    },
    {
      "code": 6006,
      "name": "InvalidDriftAccountStatsAccount",
      "msg": "Could not deserialize drift_account_stats"
    },
    {
      "code": 6007,
      "name": "InvalidTickIndexes",
      "msg": "Lower tick index must be lower than upper tick index"
    },
    {
      "code": 6008,
      "name": "InvalidProvidedTickRange",
      "msg": "Provided tick range does not correspond to vault preset"
    },
    {
      "code": 6009,
      "name": "CurrentTickIndexShiftedFromMidRange",
      "msg": "Current tick index is shifted too many ticks from middle of full tick range"
    },
    {
      "code": 6010,
      "name": "TickIndexOverflow",
      "msg": "Tick index is either lower than -443636 or higher than 443636"
    }
  ]
};

export const IDL: Surf = {
  "version": "0.1.0",
  "name": "surf",
  "instructions": [
    {
      "name": "initializeAdminConfig",
      "accounts": [
        {
          "name": "adminConfig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "initializeVault",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "adminConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "whirlpool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenMintA",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenVaultA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenMintB",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenVaultB",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "driftStats",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "driftSubaccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "driftState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "whirlpoolProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "driftProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "driftSubaccountId",
          "type": "u16"
        },
        {
          "name": "fullTickRange",
          "type": "u32"
        },
        {
          "name": "vaultTickRange",
          "type": "u32"
        },
        {
          "name": "hedgeTickRange",
          "type": "u32"
        }
      ]
    },
    {
      "name": "openWhirlpoolPosition",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "whirlpool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "whirlpoolPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "whirlpoolPositionMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "whirlpoolPositionTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "whirlpoolProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "positionBump",
          "type": "u8"
        },
        {
          "name": "tickLowerIndex",
          "type": "i32"
        },
        {
          "name": "tickUpperIndex",
          "type": "i32"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "adminConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "adminKey",
            "type": "publicKey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vaultPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "whirlpoolPosition",
            "type": "publicKey"
          },
          {
            "name": "vaultUpperTickIndex",
            "type": "i32"
          },
          {
            "name": "vaultLowerTickIndex",
            "type": "i32"
          },
          {
            "name": "lastHedgeAdjustmentTickIndex",
            "type": "i32"
          }
        ]
      }
    },
    {
      "name": "vault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "whirlpool",
            "type": "publicKey"
          },
          {
            "name": "vaultPosition",
            "type": "publicKey"
          },
          {
            "name": "tokenMintA",
            "type": "publicKey"
          },
          {
            "name": "tokenVaultA",
            "type": "publicKey"
          },
          {
            "name": "tokenMintB",
            "type": "publicKey"
          },
          {
            "name": "tokenVaultB",
            "type": "publicKey"
          },
          {
            "name": "driftStats",
            "type": "publicKey"
          },
          {
            "name": "driftSubaccount",
            "type": "publicKey"
          },
          {
            "name": "liquidity",
            "type": "u128"
          },
          {
            "name": "totalFeeGrowthA",
            "type": "u128"
          },
          {
            "name": "totalFeeGrowthB",
            "type": "u128"
          },
          {
            "name": "feeUnclaimedA",
            "type": "u128"
          },
          {
            "name": "feeUnclaimedB",
            "type": "u128"
          },
          {
            "name": "fullTickRange",
            "type": "u32"
          },
          {
            "name": "vaultTickRange",
            "type": "u32"
          },
          {
            "name": "hedgeTickRange",
            "type": "u32"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidAdmin",
      "msg": "admin account key does not correspond with admin_config admin_key"
    },
    {
      "code": 6001,
      "name": "FullTickRangeTooSmall",
      "msg": "Whirlpool position price range should be higher than 400 ticks"
    },
    {
      "code": 6002,
      "name": "VaultTickRangeTooSmall",
      "msg": "Vault tick range should be higher than 200 ticks"
    },
    {
      "code": 6003,
      "name": "VaultTickRangeTooBig",
      "msg": "Vault tick range should be lower or equal than 50% of full tick range"
    },
    {
      "code": 6004,
      "name": "HedgeTickRangeTooSmall",
      "msg": "Hegde tick range should be higher than 20 ticks"
    },
    {
      "code": 6005,
      "name": "HedgeTickRangeTooBig",
      "msg": "Hegde tick range should be lower than vault tick range"
    },
    {
      "code": 6006,
      "name": "InvalidDriftAccountStatsAccount",
      "msg": "Could not deserialize drift_account_stats"
    },
    {
      "code": 6007,
      "name": "InvalidTickIndexes",
      "msg": "Lower tick index must be lower than upper tick index"
    },
    {
      "code": 6008,
      "name": "InvalidProvidedTickRange",
      "msg": "Provided tick range does not correspond to vault preset"
    },
    {
      "code": 6009,
      "name": "CurrentTickIndexShiftedFromMidRange",
      "msg": "Current tick index is shifted too many ticks from middle of full tick range"
    },
    {
      "code": 6010,
      "name": "TickIndexOverflow",
      "msg": "Tick index is either lower than -443636 or higher than 443636"
    }
  ]
};
