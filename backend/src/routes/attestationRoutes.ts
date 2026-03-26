import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
import {
  EAS_ADDRESS,
  SCHEMA_REGISTRY_ADDRESS,
  ATTACKER_SCHEMA_UID,
  DEFENDER_SCHEMA_UID,
  AUDIT_SCHEMA_UID,
  IS_DEV,
} from '../config/main-config.ts';
import {
  registerSchemas,
  getAttestation,
  isAttestationConfigured,
} from '../lib/eas/attestationService.ts';
import { handleError } from '../utils/errorHandler.ts';

const LOG_PREFIX = '[AttestationRoutes]';

const ATTESTATION_UID_REGEX = /^0x[0-9a-fA-F]{64}$/;

/** Schema definitions matching ReputationOracle.sol for decoding. */
const SCHEMA_MAP: Record<string, string> = {
  [ATTACKER_SCHEMA_UID]: 'address attacker,bytes32 challengeId,string attackType,uint8 severity,uint8 owaspCategory,uint256 attemptNumber,uint256 prizeWon,uint256 timestamp',
  [DEFENDER_SCHEMA_UID]: 'address defender,bytes32 challengeId,uint256 totalAttempts,uint256 survivalDuration,uint256 prizePoolSize,bool wasBreached,string modelUsed,uint256 timestamp',
  [AUDIT_SCHEMA_UID]: 'address agent,bytes32 auditId,uint256 totalTests,uint256 passed,uint256 failed,string owaspCoverage,uint8 securityScore,uint256 timestamp',
};

export const attestationRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {

  // GET /attestations/schemas
  app.get('/schemas', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send({
      success: true,
      data: {
        attacker: ATTACKER_SCHEMA_UID || null,
        defender: DEFENDER_SCHEMA_UID || null,
        audit: AUDIT_SCHEMA_UID || null,
        easAddress: EAS_ADDRESS,
        schemaRegistryAddress: SCHEMA_REGISTRY_ADDRESS,
        network: 'base-sepolia',
      },
      error: null,
    });
  });

  // POST /attestations/register-schemas
  app.post('/register-schemas', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!IS_DEV) {
      const adminKey = (request.headers as Record<string, string | undefined>)['x-admin-key'];
      const expectedKey = process.env.ADMIN_API_KEY;
      if (!expectedKey || adminKey !== expectedKey) {
        return handleError(reply, 403, 'Schema registration is restricted outside of development mode', 'FORBIDDEN');
      }
    }

    if (isAttestationConfigured()) {
      return handleError(reply, 409, 'Schemas are already registered. Set schema UIDs as environment variables.', 'SCHEMAS_ALREADY_REGISTERED');
    }

    try {
      console.log(`${LOG_PREFIX} Starting one-time schema registration...`);
      const uids = await registerSchemas();
      console.log(`${LOG_PREFIX} Schema registration complete:`, uids);

      return reply.code(201).send({
        success: true,
        data: {
          message: 'Schemas registered. Set these UIDs as environment variables:',
          schemas: {
            ATTACKER_SCHEMA_UID: uids.attacker,
            DEFENDER_SCHEMA_UID: uids.defender,
            AUDIT_SCHEMA_UID: uids.audit,
          },
        },
        error: null,
      });
    } catch (error) {
      console.error(`${LOG_PREFIX} Schema registration failed:`, error);
      return handleError(reply, 500, 'Schema registration failed', 'SCHEMA_REGISTRATION_FAILED', error as Error);
    }
  });

  // GET /attestations/:uid
  app.get('/:uid', async (request: FastifyRequest, reply: FastifyReply) => {
    const { uid } = request.params as { uid: string };

    if (!uid || !ATTESTATION_UID_REGEX.test(uid)) {
      return handleError(reply, 400, 'Invalid attestation UID format. Expected 0x followed by 64 hex characters.', 'INVALID_UID_FORMAT');
    }

    try {
      const attestation = await getAttestation(uid);

      if (!attestation || attestation.uid === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        return handleError(reply, 404, 'Attestation not found', 'ATTESTATION_NOT_FOUND');
      }

      let decodedData: Record<string, unknown> | null = null;
      const schemaString = SCHEMA_MAP[attestation.schema];
      if (schemaString) {
        try {
          const encoder = new SchemaEncoder(schemaString);
          const decoded = encoder.decodeData(attestation.data);
          decodedData = {};
          for (const item of decoded) {
            const val = item.value.value;
            decodedData[item.name] = typeof val === 'bigint' ? val.toString() : val;
          }
        } catch {
          console.warn(`${LOG_PREFIX} Failed to decode attestation data for ${uid}`);
        }
      }

      return reply.code(200).send({
        success: true,
        data: {
          uid: attestation.uid,
          schema: attestation.schema,
          recipient: attestation.recipient,
          attester: attestation.attester,
          time: attestation.time.toString(),
          expirationTime: attestation.expirationTime.toString(),
          revocationTime: attestation.revocationTime.toString(),
          revocable: attestation.revocable,
          refUID: attestation.refUID,
          data: attestation.data,
          decodedData,
        },
        error: null,
      });
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to fetch attestation ${uid}:`, error);
      return handleError(reply, 500, 'Failed to fetch attestation from chain', 'ATTESTATION_FETCH_FAILED', error as Error);
    }
  });

  done();
};
