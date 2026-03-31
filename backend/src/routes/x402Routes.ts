/**
 * x402 Payment-Gated Routes
 *
 * Demonstrates the x402 payment middleware on endpoints that require USDC
 * micropayments via the HTTP 402 protocol. These routes are gated at the
 * protocol level: clients that don't include a valid payment-signature
 * header receive a 402 Payment Required response with machine-readable
 * payment instructions.
 *
 * Currently exposes:
 *  - GET /x402/challenge-insights/:id  ($0.01 USDC to view AI evaluation insights)
 */

import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { prismaQuery } from '../lib/prisma.ts';
import { X402_PAY_TO_ADDRESS } from '../config/main-config.ts';
import { createX402PreHandler, registerX402SettlementHook } from '../middlewares/x402Middleware.ts';
import type { preHandlerHookHandler } from 'fastify';
import {
  handleError,
  handleNotFoundError,
} from '../utils/errorHandler.ts';
import {
  BAZAAR_CHALLENGE_INSIGHTS,
  BAZAAR_PLATFORM_STATS,
  BAZAAR_ATTACK_DATA,
  BAZAAR_MODEL_DATA,
  BAZAAR_TREND_DATA,
  BAZAAR_TEST_SUITE,
  BAZAAR_ONCHAIN_CHALLENGES,
  BAZAAR_ONCHAIN_VOLUME,
  BAZAAR_ONCHAIN_ACTIVITY,
} from '../lib/x402/bazaarMetadata.ts';

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** Convert BigInt fields to strings for JSON serialization. */
function serializeBigInts<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'bigint') {
      result[key] = value.toString();
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = serializeBigInts(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object'
          ? serializeBigInts(item as Record<string, unknown>)
          : typeof item === 'bigint'
            ? item.toString()
            : item,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// x402 preHandler instance
// ---------------------------------------------------------------------------

let x402ChallengeInsightsGate: preHandlerHookHandler | null = null;

try {
  if (!X402_PAY_TO_ADDRESS) {
    console.warn(
      '[x402Routes] X402_PAY_TO_ADDRESS is not set. x402 payment routes will return 503.',
    );
  } else {
    x402ChallengeInsightsGate = createX402PreHandler({
      payTo: X402_PAY_TO_ADDRESS,
      priceUsd: '$0.01',
      description: 'AI evaluation insights for a challenge',
      mimeType: 'application/json',
      extensions: BAZAAR_CHALLENGE_INSIGHTS,
    });
  }
} catch (err) {
  console.error('[x402Routes] Failed to create x402 preHandler:', err);
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const x402Routes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {

  // Register the settlement onSend hook for this plugin scope.
  // It will settle verified x402 payments after the route handler responds.
  registerX402SettlementHook(app);

  // ==========================================================================
  // GET /x402/challenge-insights/:id
  //
  // Payment-gated endpoint that returns detailed AI evaluation analytics for
  // a given challenge. Requires $0.01 USDC via x402 payment protocol.
  //
  // The response includes:
  //  - Aggregated evaluation statistics (broken/defended/error counts)
  //  - Attack type distribution
  //  - Recent evaluation details (last 20 messages)
  //
  // The systemPrompt is NEVER exposed.
  // ==========================================================================

  const preHandlers: preHandlerHookHandler[] = [];

  if (x402ChallengeInsightsGate) {
    preHandlers.push(x402ChallengeInsightsGate);
  } else {
    // Fallback: reject requests when x402 is not configured
    preHandlers.push(async (_req: FastifyRequest, rep: FastifyReply) => {
      await handleError(
        rep,
        503,
        'x402 payment service is not configured',
        'X402_NOT_CONFIGURED',
      );
    });
  }

  app.get(
    '/challenge-insights/:id',
    { preHandler: preHandlers },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      if (!id || id.trim().length === 0) {
        return handleError(reply, 400, 'Challenge ID is required', 'MISSING_CHALLENGE_ID');
      }

      // Look up by database ID or clone address
      const isAddress = ETH_ADDRESS_REGEX.test(id);

      let challenge;
      try {
        challenge = await prismaQuery.challenge.findFirst({
          where: isAddress ? { cloneAddress: id.toLowerCase() } : { id },
          select: {
            id: true,
            challengeId: true,
            cloneAddress: true,
            title: true,
            description: true,
            aiModel: true,
            difficulty: true,
            status: true,
            messageCount: true,
            prizePool: true,
            createdAt: true,
          },
        });
      } catch (error) {
        return handleError(
          reply,
          500,
          'Failed to retrieve challenge',
          'DATABASE_ERROR',
          error instanceof Error ? error : null,
        );
      }

      if (!challenge) {
        return handleNotFoundError(reply, 'Challenge');
      }

      // Fetch evaluation insights from messages
      let messages: Array<{
        evaluation: string;
        evaluationReason: string | null;
        attackType: string | null;
        createdAt: Date;
      }>;
      try {
        messages = await prismaQuery.message.findMany({
          where: { challengeId: challenge.id },
          select: {
            evaluation: true,
            evaluationReason: true,
            attackType: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 100, // Cap to prevent excessive data transfer
        });
      } catch (error) {
        return handleError(
          reply,
          500,
          'Failed to retrieve evaluation data',
          'DATABASE_ERROR',
          error instanceof Error ? error : null,
        );
      }

      // Aggregate evaluation statistics
      const stats = {
        total: messages.length,
        broken: 0,
        defended: 0,
        error: 0,
      };

      const attackTypes: Record<string, number> = {};

      for (const msg of messages) {
        const evaluation = msg.evaluation as string;
        if (evaluation === 'Broken') stats.broken++;
        else if (evaluation === 'Defended') stats.defended++;
        else if (evaluation === 'Error') stats.error++;

        const attackType = msg.attackType as string | null;
        if (attackType) {
          attackTypes[attackType] = (attackTypes[attackType] ?? 0) + 1;
        }
      }

      // Sort attack types by frequency (descending)
      const sortedAttackTypes = Object.entries(attackTypes)
        .sort(([, a], [, b]) => b - a)
        .map(([type, count]) => ({ type, count }));

      // Recent evaluations (last 20, with reasons)
      const recentEvaluations = messages.slice(0, 20).map((msg) => ({
        evaluation: msg.evaluation,
        reason: msg.evaluationReason,
        attackType: msg.attackType,
        timestamp: (msg.createdAt as Date).toISOString(),
      }));

      const serializedChallenge = serializeBigInts(
        challenge as unknown as Record<string, unknown>,
      );

      return reply.code(200).send({
        success: true,
        data: {
          challenge: serializedChallenge,
          insights: {
            evaluationStats: stats,
            defenseRate:
              stats.total > 0
                ? Number(((stats.defended / stats.total) * 100).toFixed(1))
                : 0,
            attackTypeDistribution: sortedAttackTypes,
            recentEvaluations,
          },
        },
        error: null,
      });
    },
  );

  // ==========================================================================
  // GET /x402/catalog
  //
  // Public discovery endpoint for AI agents. Lists all available x402-gated
  // endpoints with pricing and Bazaar metadata. No payment required.
  // ==========================================================================

  app.get(
    '/catalog',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const bazaarMeta = (ext: Record<string, unknown>) =>
        (ext.bazaar ?? {}) as Record<string, unknown>;

      const catalog = [
        {
          path: '/x402/challenge-insights/:id',
          method: 'GET',
          price: '$0.01',
          ...bazaarMeta(BAZAAR_CHALLENGE_INSIGHTS),
        },
        {
          path: '/data/stats',
          method: 'GET',
          price: '$0.001',
          ...bazaarMeta(BAZAAR_PLATFORM_STATS),
        },
        {
          path: '/data/attacks/:owaspCategory',
          method: 'GET',
          price: '$0.01',
          ...bazaarMeta(BAZAAR_ATTACK_DATA),
        },
        {
          path: '/data/models',
          method: 'GET',
          price: '$0.01',
          ...bazaarMeta(BAZAAR_MODEL_DATA),
        },
        {
          path: '/data/trends',
          method: 'GET',
          price: '$0.05',
          ...bazaarMeta(BAZAAR_TREND_DATA),
        },
        {
          path: '/test-suite/run',
          method: 'POST',
          price: '$0.05',
          ...bazaarMeta(BAZAAR_TEST_SUITE),
        },
        {
          path: '/onchain/challenges',
          method: 'GET',
          price: '$0.01',
          ...bazaarMeta(BAZAAR_ONCHAIN_CHALLENGES),
        },
        {
          path: '/onchain/volume/:address',
          method: 'GET',
          price: '$0.01',
          ...bazaarMeta(BAZAAR_ONCHAIN_VOLUME),
        },
        {
          path: '/onchain/activity/:address',
          method: 'GET',
          price: '$0.01',
          ...bazaarMeta(BAZAAR_ONCHAIN_ACTIVITY),
        },
      ];

      return reply.code(200).send({
        success: true,
        data: {
          provider: 'BreakBase',
          description: 'AI Adversarial Testing Platform - x402 Payment-Gated APIs',
          baseUrl: process.env.API_URL || 'http://localhost:3700',
          endpoints: catalog,
        },
        error: null,
      });
    },
  );

  done();
};
