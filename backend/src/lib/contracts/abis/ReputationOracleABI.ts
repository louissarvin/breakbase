/**
 * Minimal ABI for the ReputationOracle contract.
 *
 * Contains only the attestation-creation functions used by the backend.
 * Matches the Solidity structs and function signatures in
 * contract/src/ReputationOracle.sol exactly.
 */
export const ReputationOracleABI = [
  {
    type: 'function',
    name: 'createChallengeAttestations',
    inputs: [
      {
        name: 'ap',
        type: 'tuple',
        internalType: 'struct ReputationOracle.AttackerParams',
        components: [
          { name: 'attacker', type: 'address', internalType: 'address' },
          { name: 'challengeId', type: 'bytes32', internalType: 'bytes32' },
          { name: 'attackType', type: 'string', internalType: 'string' },
          { name: 'severity', type: 'uint8', internalType: 'uint8' },
          { name: 'owaspCategory', type: 'uint8', internalType: 'uint8' },
          { name: 'attemptNumber', type: 'uint256', internalType: 'uint256' },
          { name: 'prizeWon', type: 'uint256', internalType: 'uint256' },
        ],
      },
      {
        name: 'dp',
        type: 'tuple',
        internalType: 'struct ReputationOracle.DefenderParams',
        components: [
          { name: 'defender', type: 'address', internalType: 'address' },
          { name: 'totalAttempts', type: 'uint256', internalType: 'uint256' },
          { name: 'survivalDuration', type: 'uint256', internalType: 'uint256' },
          { name: 'prizePoolSize', type: 'uint256', internalType: 'uint256' },
          { name: 'wasBreached', type: 'bool', internalType: 'bool' },
          { name: 'modelUsed', type: 'string', internalType: 'string' },
        ],
      },
    ],
    outputs: [
      { name: 'attackerAttestation', type: 'bytes32', internalType: 'bytes32' },
      { name: 'defenderAttestation', type: 'bytes32', internalType: 'bytes32' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createAttackerAttestation',
    inputs: [
      { name: 'attacker', type: 'address', internalType: 'address' },
      { name: 'challengeId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'attackType', type: 'string', internalType: 'string' },
      { name: 'severity', type: 'uint8', internalType: 'uint8' },
      { name: 'owaspCategory', type: 'uint8', internalType: 'uint8' },
      { name: 'attemptNumber', type: 'uint256', internalType: 'uint256' },
      { name: 'prizeWon', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [
      { name: 'attestationId', type: 'bytes32', internalType: 'bytes32' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createDefenderAttestation',
    inputs: [
      { name: 'defender', type: 'address', internalType: 'address' },
      { name: 'challengeId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'totalAttempts', type: 'uint256', internalType: 'uint256' },
      { name: 'survivalDuration', type: 'uint256', internalType: 'uint256' },
      { name: 'prizePoolSize', type: 'uint256', internalType: 'uint256' },
      { name: 'wasBreached', type: 'bool', internalType: 'bool' },
      { name: 'modelUsed', type: 'string', internalType: 'string' },
    ],
    outputs: [
      { name: 'attestationId', type: 'bytes32', internalType: 'bytes32' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'ChallengeAttestationsCreated',
    inputs: [
      { name: 'attackerAttestation', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'defenderAttestation', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'challengeId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
    ],
  },
  {
    type: 'function',
    name: 'createAuditAttestation',
    inputs: [
      { name: 'agent', type: 'address', internalType: 'address' },
      { name: 'auditId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'totalTests', type: 'uint256', internalType: 'uint256' },
      { name: 'passed', type: 'uint256', internalType: 'uint256' },
      { name: 'failed', type: 'uint256', internalType: 'uint256' },
      { name: 'owaspCoverage', type: 'string', internalType: 'string' },
      { name: 'securityScore', type: 'uint8', internalType: 'uint8' },
    ],
    outputs: [
      { name: 'attestationId', type: 'bytes32', internalType: 'bytes32' },
    ],
    stateMutability: 'nonpayable',
  },
] as const;
