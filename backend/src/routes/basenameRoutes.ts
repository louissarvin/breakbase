import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { handleError, handleValidationError } from '../utils/errorHandler.ts';
import {
  resolveAddressToBasename,
  resolveBasenameToAddress,
  batchResolveAddresses,
  resolveTextRecord,
  resolveTextRecords,
} from '../lib/basenames/basenameService.ts';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const MAX_BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const basenameRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {

  // ==========================================================================
  // GET /basenames/resolve/:address  (public, resolve address to basename)
  // ==========================================================================
  app.get('/resolve/:address', async (request: FastifyRequest, reply: FastifyReply) => {
    const { address } = request.params as { address: string };

    if (!address || !ETH_ADDRESS_REGEX.test(address)) {
      return handleError(reply, 400, 'Invalid Ethereum address format. Expected 0x followed by 40 hex characters.', 'INVALID_ADDRESS');
    }

    try {
      const basename = await resolveAddressToBasename(address);

      return reply.code(200).send({
        success: true,
        data: {
          address: address.toLowerCase(),
          basename,
        },
        error: null,
      });
    } catch (error) {
      return handleError(
        reply,
        502,
        'Failed to resolve basename from chain',
        'BASENAME_RESOLUTION_FAILED',
        error as Error
      );
    }
  });

  // ==========================================================================
  // POST /basenames/batch  (public, batch resolve addresses for leaderboard)
  // ==========================================================================
  app.post('/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { addresses?: unknown } | null;

    if (!body || !body.addresses) {
      return handleValidationError(reply, ['addresses']);
    }

    if (!Array.isArray(body.addresses)) {
      return handleError(reply, 400, 'addresses must be an array of Ethereum addresses', 'INVALID_INPUT');
    }

    if (body.addresses.length === 0) {
      return reply.code(200).send({
        success: true,
        data: { results: {} },
        error: null,
      });
    }

    if (body.addresses.length > MAX_BATCH_SIZE) {
      return handleError(
        reply,
        400,
        `Batch size exceeds maximum of ${MAX_BATCH_SIZE} addresses`,
        'BATCH_TOO_LARGE'
      );
    }

    // Validate every address in the array
    for (let i = 0; i < body.addresses.length; i++) {
      const addr = body.addresses[i];
      if (typeof addr !== 'string' || !ETH_ADDRESS_REGEX.test(addr)) {
        return handleError(
          reply,
          400,
          `Invalid Ethereum address at index ${i}: expected 0x followed by 40 hex characters`,
          'INVALID_ADDRESS'
        );
      }
    }

    try {
      const resolved = await batchResolveAddresses(body.addresses as string[]);

      // Convert Map to plain object for JSON serialization
      const results: Record<string, string | null> = {};
      for (const [addr, basename] of resolved) {
        results[addr] = basename;
      }

      return reply.code(200).send({
        success: true,
        data: { results },
        error: null,
      });
    } catch (error) {
      return handleError(
        reply,
        502,
        'Failed to batch resolve basenames from chain',
        'BATCH_RESOLUTION_FAILED',
        error as Error
      );
    }
  });

  // ==========================================================================
  // GET /basenames/text/:name/:key  (public, resolve a single text record)
  // ==========================================================================
  app.get('/text/:name/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, key } = request.params as { name: string; key: string };

    if (!name || !key) {
      return handleError(reply, 400, 'Name and key are required', 'MISSING_PARAMS');
    }

    try {
      const value = await resolveTextRecord(name, key);
      return reply.code(200).send({
        success: true,
        data: { name, key, value },
        error: null,
      });
    } catch (error) {
      return handleError(reply, 500, 'Failed to resolve text record', 'TEXT_RECORD_FAILED', error as Error);
    }
  });

  // ==========================================================================
  // GET /basenames/profile/:name  (public, resolve all standard text records)
  // ==========================================================================
  app.get('/profile/:name', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name } = request.params as { name: string };

    if (!name) {
      return handleError(reply, 400, 'Name is required', 'MISSING_NAME');
    }

    try {
      const records = await resolveTextRecords(name);
      const address = await resolveBasenameToAddress(name);
      return reply.code(200).send({
        success: true,
        data: { name, address, records },
        error: null,
      });
    } catch (error) {
      return handleError(reply, 500, 'Failed to resolve profile', 'PROFILE_FAILED', error as Error);
    }
  });

  done();
};
