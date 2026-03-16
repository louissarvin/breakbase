export const ChallengeABI = [
  {
    type: 'constructor',
    inputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'CHALLENGE_RESULT_TYPEHASH',
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
    type: 'function',
    name: 'FEE_DEFENDER_BPS',
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
    name: 'FEE_POOL_BPS',
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
    name: 'FEE_PROTOCOL_BPS',
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
    name: 'RESOLUTION_GRACE_PERIOD',
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
    name: 'basePrice',
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
    name: 'cancelChallenge',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'defender',
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
    name: 'endTime',
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
    name: 'expireChallenge',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getChallengeId',
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
    type: 'function',
    name: 'getCurrentFee',
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
    name: 'growthRateBps',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint16',
        internalType: 'uint16',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'initialize',
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
        name: 'oracle_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'protocolWallet_',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'maxFee',
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
    name: 'messageCount',
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
    name: 'pricingModel',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'enum IBreakBase.PricingModel',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'prizePool',
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
    name: 'resolveChallenge',
    inputs: [
      {
        name: 'winner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'attemptNumber',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'signature',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'seedPrizePool',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'seedPrizePoolWithPermit',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'v',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'r',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 's',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'sendMessage',
    inputs: [],
    outputs: [
      {
        name: 'fee',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'sendMessageWithPermit',
    inputs: [
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'v',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'r',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 's',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'fee',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'status',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'enum IBreakBase.ChallengeStatus',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'usdc',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IERC20',
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
    name: 'Initialized',
    inputs: [
      {
        name: 'version',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
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
    name: 'InvalidInitialization',
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
    name: 'NotInitializing',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OnlyDefender',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PRBMath_MulDiv18_Overflow',
    inputs: [
      {
        name: 'x',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'y',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
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
