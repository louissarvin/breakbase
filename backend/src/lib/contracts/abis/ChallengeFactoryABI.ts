export const ChallengeFactoryABI = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'implementation_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'protocolWallet_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'oracle_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'usdc_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'eas_',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'DEFAULT_MAX_DURATION',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'DEFAULT_MIN_BASE_PRICE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'acceptOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allChallenges',
    inputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'challenges',
    inputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'coinbaseAttester',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'createChallenge',
    inputs: [
      {
        name: 'config',
        type: 'tuple',
        internalType: 'struct IBreakBase.ChallengeConfig',
        components: [
          {
            name: 'defender',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'usdc',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'basePrice',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxFee',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'duration',
            type: 'uint48',
            internalType: 'uint48',
          },
          {
            name: 'growthRateBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'pricingModel',
            type: 'uint8',
            internalType: 'enum IBreakBase.PricingModel',
          },
        ],
      },
      {
        name: 'seedAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'clone',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'challengeId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createProtocolChallenge',
    inputs: [
      {
        name: 'config',
        type: 'tuple',
        internalType: 'struct IBreakBase.ChallengeConfig',
        components: [
          {
            name: 'defender',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'usdc',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'basePrice',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxFee',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'duration',
            type: 'uint48',
            internalType: 'uint48',
          },
          {
            name: 'growthRateBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'pricingModel',
            type: 'uint8',
            internalType: 'enum IBreakBase.PricingModel',
          },
        ],
      },
      {
        name: 'seedAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'clone',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'challengeId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'eas',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IEAS',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getChallenge',
    inputs: [
      {
        name: 'id',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getChallengeCount',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'implementation',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isChallengeClone',
    inputs: [
      {
        name: 'addr',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'maxDuration',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minBasePrice',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'multicall',
    inputs: [
      {
        name: 'data',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
    ],
    outputs: [
      {
        name: 'results',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'oracle',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'paused',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pendingOwner',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'protocolWallet',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'requireCoinbaseVerification',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setCoinbaseVerification',
    inputs: [
      {
        name: 'required',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'attester',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'schemaId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setMaxDuration',
    inputs: [
      {
        name: 'newMax',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setMinBasePrice',
    inputs: [
      {
        name: 'newMin',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setOracle',
    inputs: [
      {
        name: 'newOracle',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setProtocolWallet',
    inputs: [
      {
        name: 'newWallet',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [
      {
        name: 'newOwner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unpause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'usdc',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'listingFee',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setListingFee',
    inputs: [
      {
        name: 'fee',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'verifiedAccountSchemaId',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'ChallengeCancelled',
    inputs: [
      {
        name: 'challenge',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'defender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'prizeAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ChallengeCreated',
    inputs: [
      {
        name: 'challengeId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'clone',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'defender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'basePrice',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'duration',
        type: 'uint48',
        indexed: false,
        internalType: 'uint48',
      },
      {
        name: 'pricingModel',
        type: 'uint8',
        indexed: false,
        internalType: 'enum IBreakBase.PricingModel',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ChallengeExpired',
    inputs: [
      {
        name: 'challenge',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'defender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'prizeAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ChallengeInitialized',
    inputs: [
      {
        name: 'challenge',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'defender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'oracle',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'basePrice',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'duration',
        type: 'uint48',
        indexed: false,
        internalType: 'uint48',
      },
      {
        name: 'pricingModel',
        type: 'uint8',
        indexed: false,
        internalType: 'enum IBreakBase.PricingModel',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ChallengeResolved',
    inputs: [
      {
        name: 'challenge',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'winner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'prizeAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'attemptNumber',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'CoinbaseVerificationUpdated',
    inputs: [
      {
        name: 'required',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
      {
        name: 'attester',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'schemaId',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ListingFeeUpdated',
    inputs: [
      {
        name: 'oldFee',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newFee',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ListingFeeCollected',
    inputs: [
      {
        name: 'challenge',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'payer',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MaxDurationUpdated',
    inputs: [
      {
        name: 'oldMax',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newMax',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MessageSent',
    inputs: [
      {
        name: 'challenge',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'player',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'fee',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'prizeShare',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'defenderShare',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'protocolShare',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'messageCount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MinBasePriceUpdated',
    inputs: [
      {
        name: 'oldMin',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newMin',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OracleUpdated',
    inputs: [
      {
        name: 'oldOracle',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newOracle',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferStarted',
    inputs: [
      {
        name: 'previousOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      {
        name: 'previousOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Paused',
    inputs: [
      {
        name: 'account',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PrizePoolSeeded',
    inputs: [
      {
        name: 'challenge',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'funder',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProtocolWalletUpdated',
    inputs: [
      {
        name: 'oldWallet',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newWallet',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Unpaused',
    inputs: [
      {
        name: 'account',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AddressEmptyCode',
    inputs: [
      {
        name: 'target',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'BasePriceTooLow',
    inputs: [],
  },
  {
    type: 'error',
    name: 'CannotCancelWithParticipants',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ChallengeAlreadyExists',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ChallengeNotActive',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ChallengeNotExpired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'CoinbaseVerificationRequired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'DeadlineExpired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'DurationTooLong',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EASNotConfigured',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EnforcedPause',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ExpectedPause',
    inputs: [],
  },
  {
    type: 'error',
    name: 'FailedCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'FailedDeployment',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientBalance',
    inputs: [
      {
        name: 'balance',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'needed',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidAttemptNumber',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidBasePrice',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidDuration',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidGrowthRate',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidOracle',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidSignature',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MaxFeeBelowBasePrice',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MaxFeeRequired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OnlyDefender',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OwnableInvalidOwner',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAmount',
    inputs: [],
  },
] as const;
