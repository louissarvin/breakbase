/**
 * On-chain Data Routes (x402 Payment-Gated)
 *
 * Provides x402-gated access to on-chain analytics from the LOCAL DATABASE.
 * The event indexer stores all on-chain events in Prisma, so we query locally
 * instead of the CDP SQL API (which has intermittent TLS issues).
 *
 * Endpoints:
 *  - GET /onchain/challenges           ($0.01) Recent challenge events
 *  - GET /onchain/volume/:address      ($0.01) USDC volume analytics
 *  - GET /onchain/activity/:address    ($0.01) Transaction activity
 */

import type {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyRequest,
  FastifyReply,
} from 'fastify';
import type { preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import { X402_PAY_TO_ADDRESS } from '../config/main-config.ts';
import { createX402PreHandler, registerX402SettlementHook } from '../middlewares/x402Middleware.ts';
import { handleError } from '../utils/errorHandler.ts';
import {
  BAZAAR_ONCHAIN_CHALLENGES,
  BAZAAR_ONCHAIN_VOLUME,
  BAZAAR_ONCHAIN_ACTIVITY,
} from '../lib/x402/bazaarMetadata.ts';
import { prismaQuery } from '../lib/prisma.ts';

// ---------------------------------------------------------------------------
// Input validation schemas
// ---------------------------------------------------------------------------

const limitSchema = z.coerce.number().int().min(1).max(50).default(20);
const daysSchema = z.coerce.number().int().min(1).max(90).default(30);
const evmAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address format');

// ---------------------------------------------------------------------------
// x402 gate definitions
// ---------------------------------------------------------------------------

interface GateDefinition {
  name: string;
  priceUsd: string;
  description: string;
  extensions?: Record<string, unknown>;
}

const gateDefinitions: Record<string, GateDefinition> = {
  challenges: {
    name: 'challenges',
    priceUsd: '$0.01',
    description: 'Recent on-chain challenge creation events',
    extensions: BAZAAR_ONCHAIN_CHALLENGES,
  },
  volume: {
    name: 'volume',
    priceUsd: '$0.01',
    description: 'USDC transfer volume analytics for a contract',
    extensions: BAZAAR_ONCHAIN_VOLUME,
  },
  activity: {
    name: 'activity',
    priceUsd: '$0.01',
    description: 'Transaction activity analytics for a contract',
    extensions: BAZAAR_ONCHAIN_ACTIVITY,
  },
};

const x402Gates: Record<string, preHandlerHookHandler | null> = {};

for (const [key, def] of Object.entries(gateDefinitions)) {
  try {
    if (!X402_PAY_TO_ADDRESS) {
      console.warn(
        `[onchainDataRoutes] X402_PAY_TO_ADDRESS is not set. ${def.name} route will return 503.`,
      );
      x402Gates[key] = null;
    } else {
      x402Gates[key] = createX402PreHandler({
        payTo: X402_PAY_TO_ADDRESS,
        priceUsd: def.priceUsd,
        description: def.description,
        mimeType: 'application/json',
        ...(def.extensions ? { extensions: def.extensions } : {}),
      });
    }
  } catch (err) {
    console.error(
      `[onchainDataRoutes] Failed to create x402 preHandler for ${def.name}:`,
      err,
    );
    x402Gates[key] = null;
  }
}

// ---------------------------------------------------------------------------
// Helper: build preHandler array from a gate (with 503 fallback)
// ---------------------------------------------------------------------------

function buildPreHandlers(
  gate: preHandlerHookHandler | null,
): preHandlerHookHandler[] {
  if (gate) {
    return [gate];
  }
  return [
    async (_req: FastifyRequest, rep: FastifyReply) => {
      await handleError(
        rep,
        503,
        'x402 payment service is not configured',
        'X402_NOT_CONFIGURED',
      );
    },
  ];
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const onchainDataRoutes: FastifyPluginCallback = (
  app: FastifyInstance,
  _opts,
  done,
) => {
  // Register the settlement onSend hook for this plugin scope.
  registerX402SettlementHook(app);

  // ========================================================================
  // GET /onchain/challenges  ($0.01)
  //
  // Returns recent challenge events from the local database.
  // Query params: limit (1..50, default 20)
  // ========================================================================

  app.get(
    '/challenges',
    { preHandler: buildPreHandlers(x402Gates.challenges ?? null) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { limit: rawLimit } = request.query as { limit?: string };
        const parseResult = limitSchema.safeParse(rawLimit);
        if (!parseResult.success) {
          return handleError(
            reply,
            400,
            'limit must be an integer between 1 and 50',
            'INVALID_LIMIT',
          );
        }

        const challenges = await prismaQuery.challenge.findMany({
          where: { txHash: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: parseResult.data,
          select: {
            txHash: true,
            challengeId: true,
            cloneAddress: true,
            factoryAddress: true,
            defender: true,
            basePrice: true,
            prizePool: true,
            status: true,
            createdAt: true,
          },
        });

        const result = challenges.map((c) => ({
          txHash: c.txHash ?? '',
          blockNumber: 0,
          challengeId: c.challengeId,
          eventType: 'ChallengeCreated',
          data: {
            cloneAddress: c.cloneAddress,
            factoryAddress: c.factoryAddress,
            defender: c.defender,
            basePrice: c.basePrice.toString(),
            prizePool: c.prizePool.toString(),
            status: c.status,
          },
          timestamp: c.createdAt.toISOString(),
        }));

        return reply.code(200).send({
          success: true,
          data: result,
          error: null,
        });
      } catch (error) {
        console.error('[onchainDataRoutes] Failed to query challenges:', error);
        return handleError(reply, 500, 'Failed to query challenge data', 'QUERY_FAILED');
      }
    },
  );

  // ========================================================================
  // GET /onchain/volume/:address  ($0.01)
  //
  // Returns USDC volume from local challenge and message data.
  // Path params: address (0x + 40 hex chars)
  // Query params: days (1..90, default 30)
  // ========================================================================

  app.get(
    '/volume/:address',
    { preHandler: buildPreHandlers(x402Gates.volume ?? null) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { address } = request.params as { address: string };
        const addrResult = evmAddressSchema.safeParse(address);
        if (!addrResult.success) {
          return handleError(
            reply,
            400,
            'address must be a valid EVM address (0x followed by 40 hex characters)',
            'INVALID_ADDRESS',
          );
        }

        const { days: rawDays } = request.query as { days?: string };
        const daysResult = daysSchema.safeParse(rawDays);
        if (!daysResult.success) {
          return handleError(
            reply,
            400,
            'days must be an integer between 1 and 90',
            'INVALID_DAYS',
          );
        }

        const days = daysResult.data;
        const since = new Date();
        since.setDate(since.getDate() - days);

        // Get all challenges created by this factory in the time period
        const challenges = await prismaQuery.challenge.findMany({
          where: {
            factoryAddress: { equals: addrResult.data, mode: 'insensitive' },
            createdAt: { gte: since },
          },
          select: {
            id: true,
            prizePool: true,
            basePrice: true,
            createdAt: true,
            txHash: true,
          },
        });

        // Get message fees for these challenges
        const challengeIds = challenges.map((c) => c.id);
        const messages = challengeIds.length > 0
          ? await prismaQuery.message.findMany({
              where: {
                challengeId: { in: challengeIds },
                createdAt: { gte: since },
              },
              select: {
                feePaid: true,
                createdAt: true,
                txHash: true,
              },
            })
          : [];

        // Calculate total volume (prize pools + message fees) in USDC (6 decimals)
        const totalPrizePool = challenges.reduce((sum, c) => sum + c.prizePool, 0n);
        const totalFees = messages.reduce((sum, m) => sum + m.feePaid, 0n);
        const totalVolume = totalPrizePool + totalFees;
        const totalVolumeUsdc = (Number(totalVolume) / 1e6).toFixed(2);

        // Count transactions
        const txHashes = new Set<string>();
        for (const c of challenges) if (c.txHash) txHashes.add(c.txHash);
        for (const m of messages) if (m.txHash) txHashes.add(m.txHash);

        // Build daily breakdown
        const dailyMap = new Map<string, { volume: bigint; count: number }>();
        for (const c of challenges) {
          const dateKey = c.createdAt.toISOString().split('T')[0];
          const entry = dailyMap.get(dateKey) ?? { volume: 0n, count: 0 };
          entry.volume += c.prizePool;
          entry.count += 1;
          dailyMap.set(dateKey, entry);
        }
        for (const m of messages) {
          const dateKey = m.createdAt.toISOString().split('T')[0];
          const entry = dailyMap.get(dateKey) ?? { volume: 0n, count: 0 };
          entry.volume += m.feePaid;
          entry.count += 1;
          dailyMap.set(dateKey, entry);
        }

        const breakdown = Array.from(dailyMap.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([date, { volume, count }]) => ({
            date,
            volume: (Number(volume) / 1e6).toFixed(2),
            count,
          }));

        return reply.code(200).send({
          success: true,
          data: {
            address: addrResult.data,
            days,
            totalVolumeUsdc,
            transactionCount: txHashes.size,
            breakdown,
          },
          error: null,
        });
      } catch (error) {
        console.error('[onchainDataRoutes] Failed to query volume:', error);
        return handleError(reply, 500, 'Failed to query volume data', 'QUERY_FAILED');
      }
    },
  );

  // ========================================================================
  // GET /onchain/activity/:address  ($0.01)
  //
  // Returns transaction activity from local challenge/message data.
  // Path params: address (0x + 40 hex chars)
  // Query params: days (1..90, default 30)
  // ========================================================================

  app.get(
    '/activity/:address',
    { preHandler: buildPreHandlers(x402Gates.activity ?? null) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { address } = request.params as { address: string };
        const addrResult = evmAddressSchema.safeParse(address);
        if (!addrResult.success) {
          return handleError(
            reply,
            400,
            'address must be a valid EVM address (0x followed by 40 hex characters)',
            'INVALID_ADDRESS',
          );
        }

        const { days: rawDays } = request.query as { days?: string };
        const daysResult = daysSchema.safeParse(rawDays);
        if (!daysResult.success) {
          return handleError(
            reply,
            400,
            'days must be an integer between 1 and 90',
            'INVALID_DAYS',
          );
        }

        const days = daysResult.data;
        const since = new Date();
        since.setDate(since.getDate() - days);

        // Get challenges from this factory
        const challenges = await prismaQuery.challenge.findMany({
          where: {
            factoryAddress: { equals: addrResult.data, mode: 'insensitive' },
            createdAt: { gte: since },
            txHash: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            txHash: true,
            challengeId: true,
            status: true,
            prizePool: true,
            createdAt: true,
          },
        });

        // Get messages with on-chain txHash for these challenges
        const messages = challenges.length > 0
          ? await prismaQuery.message.findMany({
              where: {
                challenge: {
                  factoryAddress: { equals: addrResult.data, mode: 'insensitive' },
                },
                createdAt: { gte: since },
                txHash: { not: null },
              },
              orderBy: { createdAt: 'desc' },
              take: 50,
              select: {
                txHash: true,
                feePaid: true,
                evaluation: true,
                createdAt: true,
              },
            })
          : [];

        // Build events list
        const events: Array<{
          txHash: string;
          eventType: string;
          data: Record<string, unknown>;
          timestamp: string;
        }> = [];

        for (const c of challenges) {
          events.push({
            txHash: c.txHash!,
            eventType: 'ChallengeCreated',
            data: {
              challengeId: c.challengeId,
              prizePool: c.prizePool.toString(),
              status: c.status,
            },
            timestamp: c.createdAt.toISOString(),
          });
        }

        for (const m of messages) {
          events.push({
            txHash: m.txHash!,
            eventType: m.evaluation === 'Broken' ? 'ChallengeWon' : 'MessageSent',
            data: {
              feePaid: m.feePaid.toString(),
              evaluation: m.evaluation,
            },
            timestamp: m.createdAt.toISOString(),
          });
        }

        // Sort by timestamp descending
        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return reply.code(200).send({
          success: true,
          data: {
            address: addrResult.data,
            days,
            events: events.slice(0, 50),
          },
          error: null,
        });
      } catch (error) {
        console.error('[onchainDataRoutes] Failed to query activity:', error);
        return handleError(reply, 500, 'Failed to query activity data', 'QUERY_FAILED');
      }
    },
  );

  done();
};
