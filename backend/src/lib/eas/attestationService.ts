/**
 * EAS Attestation Service
 *
 * Creates on-chain attestations on Base Sepolia using the Ethereum Attestation
 * Service (EAS). Builds a composable reputation layer for BreakBase:
 *
 *  - "Attacker" attestation when a user successfully breaks an AI
 *  - "Defender" attestation when a challenge expires unbroken
 *  - "Audit" attestation for enterprise security test suite results
 *
 * Schemas match the on-chain ReputationOracle.sol contract exactly.
 * Uses the EAS SDK with a server-side ethers.js signer (ORACLE_PRIVATE_KEY).
 */

import { EAS, SchemaEncoder, SchemaRegistry, NO_EXPIRATION, ZERO_BYTES32 } from '@ethereum-attestation-service/eas-sdk';
import { ethers } from 'ethers';
import {
  RPC_URL,
  ORACLE_PRIVATE_KEY,
  EAS_ADDRESS,
  SCHEMA_REGISTRY_ADDRESS,
  ATTACKER_SCHEMA_UID,
  DEFENDER_SCHEMA_UID,
  AUDIT_SCHEMA_UID,
  REPUTATION_ORACLE_ADDRESS,
} from '../../config/main-config.ts';
import { ReputationOracleABI } from '../contracts/abis/ReputationOracleABI.ts';

const LOG_PREFIX = '[EASAttestation]';

// ---------------------------------------------------------------------------
// Singleton instances (lazy-initialized)
// ---------------------------------------------------------------------------

let eas: EAS | null = null;
let schemaRegistry: SchemaRegistry | null = null;

function getEas(): EAS {
  if (eas) return eas;
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(ORACLE_PRIVATE_KEY, provider);
  eas = new EAS(EAS_ADDRESS);
  eas.connect(signer);
  return eas;
}

function getSchemaRegistry(): SchemaRegistry {
  if (schemaRegistry) return schemaRegistry;
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(ORACLE_PRIVATE_KEY, provider);
  schemaRegistry = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS);
  schemaRegistry.connect(signer);
  return schemaRegistry;
}

// ---------------------------------------------------------------------------
// Schema definitions (match ReputationOracle.sol exactly, NO spaces after commas)
// ---------------------------------------------------------------------------

const SCHEMAS = {
  attacker: {
    schema: 'address attacker,bytes32 challengeId,string attackType,uint8 severity,uint8 owaspCategory,uint256 attemptNumber,uint256 prizeWon,uint256 timestamp',
    uid: () => ATTACKER_SCHEMA_UID,
  },
  defender: {
    schema: 'address defender,bytes32 challengeId,uint256 totalAttempts,uint256 survivalDuration,uint256 prizePoolSize,bool wasBreached,string modelUsed,uint256 timestamp',
    uid: () => DEFENDER_SCHEMA_UID,
  },
  audit: {
    schema: 'address agent,bytes32 auditId,uint256 totalTests,uint256 passed,uint256 failed,string owaspCoverage,uint8 securityScore,uint256 timestamp',
    uid: () => AUDIT_SCHEMA_UID,
  },
} as const;

// ---------------------------------------------------------------------------
// Schema registration (one-time setup)
// ---------------------------------------------------------------------------

/**
 * Register all three BreakBase schemas on the EAS SchemaRegistry.
 * Returns UIDs to be set as environment variables.
 */
export async function registerSchemas(): Promise<{
  attacker: string;
  defender: string;
  audit: string;
}> {
  const registry = getSchemaRegistry();
  const resolverAddress = '0x0000000000000000000000000000000000000000';

  console.log(`${LOG_PREFIX} Registering schemas on EAS...`);

  const tx1 = await registry.register({
    schema: SCHEMAS.attacker.schema,
    resolverAddress,
    revocable: true,
  });
  const uid1 = await tx1.wait();
  console.log(`${LOG_PREFIX} Attacker schema: ${uid1}`);

  const tx2 = await registry.register({
    schema: SCHEMAS.defender.schema,
    resolverAddress,
    revocable: true,
  });
  const uid2 = await tx2.wait();
  console.log(`${LOG_PREFIX} Defender schema: ${uid2}`);

  const tx3 = await registry.register({
    schema: SCHEMAS.audit.schema,
    resolverAddress,
    revocable: true,
  });
  const uid3 = await tx3.wait();
  console.log(`${LOG_PREFIX} Audit schema: ${uid3}`);

  return { attacker: uid1, defender: uid2, audit: uid3 };
}

// ---------------------------------------------------------------------------
// Attestation creation
// ---------------------------------------------------------------------------

/**
 * Create an "Attacker" attestation for a successful attacker.
 * Schema matches ReputationOracle.ATTACKER_SCHEMA.
 */
export async function attestAttacker(params: {
  attackerAddress: string;
  challengeId: string;
  attackType: string;
  severity: number;
  owaspCategory: number;
  attemptNumber: number;
  prizeWon: bigint;
}): Promise<{ attestationUid: string; txHash: string } | null> {
  const schemaUid = SCHEMAS.attacker.uid();
  if (!schemaUid) {
    console.warn(`${LOG_PREFIX} ATTACKER_SCHEMA_UID not set, skipping attestation`);
    return null;
  }

  try {
    const easInstance = getEas();
    const encoder = new SchemaEncoder(SCHEMAS.attacker.schema);

    const encodedData = encoder.encodeData([
      { name: 'attacker', value: params.attackerAddress, type: 'address' },
      { name: 'challengeId', value: params.challengeId, type: 'bytes32' },
      { name: 'attackType', value: params.attackType || 'unknown', type: 'string' },
      { name: 'severity', value: params.severity, type: 'uint8' },
      { name: 'owaspCategory', value: params.owaspCategory, type: 'uint8' },
      { name: 'attemptNumber', value: BigInt(params.attemptNumber), type: 'uint256' },
      { name: 'prizeWon', value: params.prizeWon, type: 'uint256' },
      { name: 'timestamp', value: BigInt(Math.floor(Date.now() / 1000)), type: 'uint256' },
    ]);

    const tx = await easInstance.attest({
      schema: schemaUid,
      data: {
        recipient: params.attackerAddress,
        expirationTime: NO_EXPIRATION,
        revocable: true,
        refUID: ZERO_BYTES32,
        data: encodedData,
        value: 0n,
      },
    });

    const uid = await tx.wait();
    console.log(`${LOG_PREFIX} Attacker attestation created: ${uid}`);

    const txHash = tx.receipt?.hash ?? '';
    return { attestationUid: uid, txHash };
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to create Attacker attestation:`, error);
    return null;
  }
}

/**
 * Create a "Defender" attestation when a challenge expires unbroken.
 * Schema matches ReputationOracle.DEFENDER_SCHEMA.
 */
export async function attestDefender(params: {
  defenderAddress: string;
  challengeId: string;
  totalAttempts: number;
  survivalDuration: number;
  prizePoolSize: bigint;
  wasBreached: boolean;
  modelUsed: string;
}): Promise<{ attestationUid: string; txHash: string } | null> {
  const schemaUid = SCHEMAS.defender.uid();
  if (!schemaUid) {
    console.warn(`${LOG_PREFIX} DEFENDER_SCHEMA_UID not set, skipping attestation`);
    return null;
  }

  try {
    const easInstance = getEas();
    const encoder = new SchemaEncoder(SCHEMAS.defender.schema);

    const encodedData = encoder.encodeData([
      { name: 'defender', value: params.defenderAddress, type: 'address' },
      { name: 'challengeId', value: params.challengeId, type: 'bytes32' },
      { name: 'totalAttempts', value: BigInt(params.totalAttempts), type: 'uint256' },
      { name: 'survivalDuration', value: BigInt(params.survivalDuration), type: 'uint256' },
      { name: 'prizePoolSize', value: params.prizePoolSize, type: 'uint256' },
      { name: 'wasBreached', value: params.wasBreached, type: 'bool' },
      { name: 'modelUsed', value: params.modelUsed, type: 'string' },
      { name: 'timestamp', value: BigInt(Math.floor(Date.now() / 1000)), type: 'uint256' },
    ]);

    const tx = await easInstance.attest({
      schema: schemaUid,
      data: {
        recipient: params.defenderAddress,
        expirationTime: NO_EXPIRATION,
        revocable: true,
        refUID: ZERO_BYTES32,
        data: encodedData,
        value: 0n,
      },
    });

    const uid = await tx.wait();
    console.log(`${LOG_PREFIX} Defender attestation created: ${uid}`);

    const txHash = tx.receipt?.hash ?? '';
    return { attestationUid: uid, txHash };
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to create Defender attestation:`, error);
    return null;
  }
}

/**
 * Create an "Audit" attestation for enterprise security test suite results.
 * Schema matches ReputationOracle.AUDIT_SCHEMA.
 */
export async function attestAudit(params: {
  agentAddress: string;
  auditId: string;
  totalTests: number;
  passed: number;
  failed: number;
  owaspCoverage: string;
  securityScore: number;
}): Promise<{ attestationUid: string; txHash: string } | null> {
  const schemaUid = SCHEMAS.audit.uid();
  if (!schemaUid) {
    console.warn(`${LOG_PREFIX} AUDIT_SCHEMA_UID not set, skipping attestation`);
    return null;
  }

  try {
    const easInstance = getEas();
    const encoder = new SchemaEncoder(SCHEMAS.audit.schema);

    const encodedData = encoder.encodeData([
      { name: 'agent', value: params.agentAddress, type: 'address' },
      { name: 'auditId', value: ethers.id(params.auditId), type: 'bytes32' },
      { name: 'totalTests', value: BigInt(params.totalTests), type: 'uint256' },
      { name: 'passed', value: BigInt(params.passed), type: 'uint256' },
      { name: 'failed', value: BigInt(params.failed), type: 'uint256' },
      { name: 'owaspCoverage', value: params.owaspCoverage, type: 'string' },
      { name: 'securityScore', value: params.securityScore, type: 'uint8' },
      { name: 'timestamp', value: BigInt(Math.floor(Date.now() / 1000)), type: 'uint256' },
    ]);

    const tx = await easInstance.attest({
      schema: schemaUid,
      data: {
        recipient: params.agentAddress,
        expirationTime: NO_EXPIRATION,
        revocable: true,
        refUID: ZERO_BYTES32,
        data: encodedData,
        value: 0n,
      },
    });

    const uid = await tx.wait();
    console.log(`${LOG_PREFIX} Audit attestation created: ${uid}`);

    const txHash = tx.receipt?.hash ?? '';
    return { attestationUid: uid, txHash };
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to create Audit attestation:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Linked attestation via ReputationOracle contract
// ---------------------------------------------------------------------------

/**
 * Create linked attacker + defender attestations through the ReputationOracle
 * contract in a single transaction. The contract creates both EAS attestations
 * with the defender referencing the attacker via refUID, building an on-chain
 * reputation graph.
 *
 * Falls back to the standalone `attestAttacker()` call if
 * REPUTATION_ORACLE_ADDRESS is not configured.
 *
 * IMPORTANT: `challengeId` must be a raw bytes32 hex string from the database.
 * Do NOT hash it again with ethers.id(). The legacy attestAttacker() has a
 * double-hashing bug that this function intentionally avoids.
 */
export async function attestChallengeLinked(params: {
  attackerAddress: string;
  defenderAddress: string;
  challengeId: string;
  attackType: string;
  severity: number;
  owaspCategory: number;
  attemptNumber: number;
  prizeWon: bigint;
  totalAttempts: number;
  survivalDuration: number;
  prizePoolSize: bigint;
  wasBreached: boolean;
  modelUsed: string;
}): Promise<{ attackerUid: string; defenderUid: string } | null> {
  // Fall back to direct EAS if ReputationOracle is not configured
  if (!REPUTATION_ORACLE_ADDRESS) {
    console.warn(`${LOG_PREFIX} REPUTATION_ORACLE_ADDRESS not set, falling back to direct EAS attestAttacker`);
    const result = await attestAttacker({
      attackerAddress: params.attackerAddress,
      challengeId: params.challengeId,
      attackType: params.attackType,
      severity: params.severity,
      owaspCategory: params.owaspCategory,
      attemptNumber: params.attemptNumber,
      prizeWon: params.prizeWon,
    });
    if (!result) return null;
    return { attackerUid: result.attestationUid, defenderUid: '' };
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(ORACLE_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(
      REPUTATION_ORACLE_ADDRESS,
      ReputationOracleABI,
      signer,
    );

    // Build struct tuples matching the Solidity struct order exactly
    const attackerParams = {
      attacker: params.attackerAddress,
      challengeId: params.challengeId,
      attackType: params.attackType || 'unknown',
      severity: params.severity,
      owaspCategory: params.owaspCategory,
      attemptNumber: BigInt(params.attemptNumber),
      prizeWon: params.prizeWon,
    };

    const defenderParams = {
      defender: params.defenderAddress,
      totalAttempts: BigInt(params.totalAttempts),
      survivalDuration: BigInt(params.survivalDuration),
      prizePoolSize: params.prizePoolSize,
      wasBreached: params.wasBreached,
      modelUsed: params.modelUsed,
    };

    const tx = await contract.createChallengeAttestations(attackerParams, defenderParams);
    const receipt = await tx.wait();

    if (!receipt) {
      console.error(`${LOG_PREFIX} ReputationOracle tx receipt not available`);
      return null;
    }

    // Parse ChallengeAttestationsCreated event from receipt logs to extract UIDs.
    // All three topics are indexed, so they appear in topics[1], topics[2], topics[3].
    let attackerUid = '';
    let defenderUid = '';

    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (parsed && parsed.name === 'ChallengeAttestationsCreated') {
          attackerUid = parsed.args[0];
          defenderUid = parsed.args[1];
          break;
        }
      } catch {
        // Log from a different contract (e.g. EAS itself), skip
      }
    }

    console.log(
      `${LOG_PREFIX} Linked attestations created via ReputationOracle | attacker=${attackerUid} defender=${defenderUid} tx=${receipt.hash}`,
    );

    return { attackerUid, defenderUid };
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to create linked attestations via ReputationOracle:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if at least one attestation schema UID is configured.
 */
export function isAttestationConfigured(): boolean {
  return Boolean(ATTACKER_SCHEMA_UID || DEFENDER_SCHEMA_UID || AUDIT_SCHEMA_UID);
}

/**
 * Look up a single attestation by its UID via the on-chain EAS contract.
 */
export async function getAttestation(uid: string) {
  const easInstance = getEas();
  return easInstance.getAttestation(uid);
}
