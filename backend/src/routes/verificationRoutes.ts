import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { checkCoinbaseVerification } from '../lib/eas/coinbaseVerification.ts';
import { handleError, handleServerError } from '../utils/errorHandler.ts';

// Ethereum address: 0x followed by exactly 40 hex characters
const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export const verificationRoutes: FastifyPluginCallback = (
  app: FastifyInstance,
  _opts,
  done,
) => {
  /**
   * GET /verification/:address
   *
   * Public endpoint (no auth required).
   * Returns the Coinbase Verified Account status for the given wallet address
   * so the frontend can gate on-chain calls and avoid wasting gas on a revert.
   */
  app.get(
    '/:address',
    async (request: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
      const { address } = request.params;

      // --- input validation ---
      if (!address || !ETH_ADDRESS_RE.test(address)) {
        return handleError(
          reply,
          400,
          'Invalid Ethereum address format. Expected 0x followed by 40 hex characters.',
          'INVALID_ADDRESS',
        );
      }

      // --- query EAS ---
      try {
        const result = await checkCoinbaseVerification(address);

        return reply.send({
          success: true,
          data: result,
          error: null,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        // Distinguish between EAS being unreachable vs other failures
        if (error.message.includes('EAS GraphQL')) {
          return handleError(
            reply,
            502,
            'Verification service temporarily unavailable',
            'EAS_UNAVAILABLE',
            error,
          );
        }

        return handleServerError(reply, error);
      }
    },
  );

  done();
};
