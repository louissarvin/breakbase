/**
 * Data Marketplace Routes (x402 Payment-Gated)
 *
 * Provides x402-gated access to aggregated attack/defense data for
 * researchers and enterprises. All endpoints return anonymized,
 * aggregate statistics. No PII (wallet addresses, raw messages) is
 * ever exposed.
 *
 * Endpoints:
 *  - GET /data/stats           ($0.001) Public aggregate statistics
 *  - GET /data/attacks/:owaspCategory ($0.01)  Attack patterns by OWASP category
 *  - GET /data/models          ($0.01)  Model defense comparison
 *  - GET /data/trends          ($0.05)  Time-series trend data (last 30 days)
 */

import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import type { preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import { prismaQuery } from '../lib/prisma.ts';
import { X402_PAY_TO_ADDRESS } from '../config/main-config.ts';
import { createX402PreHandler, registerX402SettlementHook } from '../middlewares/x402Middleware.ts';
import { handleError, handleDatabaseError } from '../utils/errorHandler.ts';
import {
  BAZAAR_PLATFORM_STATS,
  BAZAAR_ATTACK_DATA,
  BAZAAR_MODEL_DATA,
  BAZAAR_TREND_DATA,
} from '../lib/x402/bazaarMetadata.ts';

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const owaspCategorySchema = z.coerce.number().int().min(1).max(10);

// ---------------------------------------------------------------------------
// x402 preHandler instances
// ---------------------------------------------------------------------------

interface GateDefinition {
  name: string;
  priceUsd: string;
  description: string;
  extensions?: Record<string, unknown>;
}

const gateDefinitions: Record<string, GateDefinition> = {
  stats: {
    name: 'stats',
    priceUsd: '$0.001',
    description: 'Aggregate platform statistics',
    extensions: BAZAAR_PLATFORM_STATS,
  },
  attacks: {
    name: 'attacks',
    priceUsd: '$0.01',
    description: 'Attack pattern data by OWASP category',
    extensions: BAZAAR_ATTACK_DATA,
  },
  models: {
    name: 'models',
    priceUsd: '$0.01',
    description: 'AI model defense comparison data',
    extensions: BAZAAR_MODEL_DATA,
  },
  trends: {
    name: 'trends',
    priceUsd: '$0.05',
    description: 'Time-series trend data (30 days)',
    extensions: BAZAAR_TREND_DATA,
  },
};

const x402Gates: Record<string, preHandlerHookHandler | null> = {};

for (const [key, def] of Object.entries(gateDefinitions)) {
  try {
    if (!X402_PAY_TO_ADDRESS) {
      console.warn(
        `[dataMarketplaceRoutes] X402_PAY_TO_ADDRESS is not set. ${def.name} route will return 503.`,
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
    console.error(`[dataMarketplaceRoutes] Failed to create x402 preHandler for ${def.name}:`, err);
    x402Gates[key] = null;
  }
}

// ---------------------------------------------------------------------------
// Helper: build preHandler array from a gate (with 503 fallback)
// ---------------------------------------------------------------------------

function buildPreHandlers(gate: preHandlerHookHandler | null): preHandlerHookHandler[] {
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

export const dataMarketplaceRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {

  // Register the settlement onSend hook for this plugin scope.
  registerX402SettlementHook(app);

  // ==========================================================================
  // GET /data/stats  ($0.001)
  //
  // Returns public aggregate statistics:
  //  - Total challenges, total messages, total USDC volume
  //  - Defense rate by OWASP category
  //  - Most common attack types
  // ==========================================================================

  app.get(
    '/stats',
    { preHandler: buildPreHandlers(x402Gates.stats ?? null) },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Aggregate counts
        const [totalChallenges, totalMessages, volumeResult] = await Promise.all([
          prismaQuery.challenge.count(),
          prismaQuery.message.count(),
          prismaQuery.challenge.aggregate({
            _sum: { prizePool: true },
          }),
        ]);

        const totalVolumeUsdc = (volumeResult._sum.prizePool ?? BigInt(0)).toString();

        // Defense rate by OWASP category (1-10)
        const allCategorizedMessages = await prismaQuery.message.groupBy({
          by: ['owaspCategory', 'evaluation'],
          _count: { id: true },
          where: { owaspCategory: { not: null } },
        });

        const categoryStats: Record<number, { total: number; defended: number }> = {};
        for (const row of allCategorizedMessages) {
          const cat = row.owaspCategory as number;
          if (!categoryStats[cat]) {
            categoryStats[cat] = { total: 0, defended: 0 };
          }
          categoryStats[cat].total += row._count.id;
          if (row.evaluation === 'Defended') {
            categoryStats[cat].defended += row._count.id;
          }
        }

        const defenseRateByCategory = Object.entries(categoryStats)
          .map(([category, stats]) => ({
            owaspCategory: Number(category),
            total: stats.total,
            defended: stats.defended,
            defenseRate: stats.total > 0
              ? Number(((stats.defended / stats.total) * 100).toFixed(1))
              : 0,
          }))
          .sort((a, b) => a.owaspCategory - b.owaspCategory);

        // Most common attack types
        const attackTypeGroups = await prismaQuery.message.groupBy({
          by: ['attackType'],
          _count: { id: true },
          where: { attackType: { not: null } },
          orderBy: { _count: { id: 'desc' } },
          take: 20,
        });

        const mostCommonAttackTypes = attackTypeGroups.map((row) => ({
          attackType: row.attackType,
          count: row._count.id,
        }));

        return reply.code(200).send({
          success: true,
          data: {
            totalChallenges,
            totalMessages,
            totalVolumeUsdc,
            defenseRateByCategory,
            mostCommonAttackTypes,
          },
          error: null,
        });
      } catch (error) {
        return handleDatabaseError(reply, 'fetch aggregate statistics', error as Error);
      }
    },
  );

  // ==========================================================================
  // GET /data/attacks/:owaspCategory  ($0.01)
  //
  // Returns anonymized attack pattern data for a specific OWASP category:
  //  - Attack type distribution
  //  - Success rate
  //  - Severity distribution
  // ==========================================================================

  app.get(
    '/attacks/:owaspCategory',
    { preHandler: buildPreHandlers(x402Gates.attacks ?? null) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { owaspCategory } = request.params as { owaspCategory: string };

      const parseResult = owaspCategorySchema.safeParse(owaspCategory);
      if (!parseResult.success) {
        return handleError(
          reply,
          400,
          'owaspCategory must be an integer between 1 and 10',
          'INVALID_OWASP_CATEGORY',
        );
      }

      const category = parseResult.data;

      try {
        // Attack type distribution
        const attackTypeGroups = await prismaQuery.message.groupBy({
          by: ['attackType'],
          _count: { id: true },
          where: {
            owaspCategory: category,
            attackType: { not: null },
          },
          orderBy: { _count: { id: 'desc' } },
        });

        const attackTypeDistribution = attackTypeGroups.map((row) => ({
          attackType: row.attackType,
          count: row._count.id,
        }));

        // Success rate (Broken = successful attack)
        const evaluationGroups = await prismaQuery.message.groupBy({
          by: ['evaluation'],
          _count: { id: true },
          where: { owaspCategory: category },
        });

        let totalAttempts = 0;
        let successfulAttacks = 0;
        for (const row of evaluationGroups) {
          totalAttempts += row._count.id;
          if (row.evaluation === 'Broken') {
            successfulAttacks += row._count.id;
          }
        }

        const successRate = totalAttempts > 0
          ? Number(((successfulAttacks / totalAttempts) * 100).toFixed(1))
          : 0;

        // Severity distribution
        const severityGroups = await prismaQuery.message.groupBy({
          by: ['severity'],
          _count: { id: true },
          where: {
            owaspCategory: category,
            severity: { not: null },
          },
          orderBy: { severity: 'asc' },
        });

        const severityDistribution = severityGroups.map((row) => ({
          severity: row.severity,
          count: row._count.id,
        }));

        return reply.code(200).send({
          success: true,
          data: {
            owaspCategory: category,
            totalAttempts,
            successfulAttacks,
            successRate,
            attackTypeDistribution,
            severityDistribution,
          },
          error: null,
        });
      } catch (error) {
        return handleDatabaseError(reply, 'fetch attack pattern data', error as Error);
      }
    },
  );

  // ==========================================================================
  // GET /data/models  ($0.01)
  //
  // Returns AI model defense comparison:
  //  - Defense rate per AI model
  //  - Average security score by model (derived from defense rate)
  //  - Number of challenges per model
  // ==========================================================================

  app.get(
    '/models',
    { preHandler: buildPreHandlers(x402Gates.models ?? null) },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Challenges per model
        const challengesByModel = await prismaQuery.challenge.groupBy({
          by: ['aiModel'],
          _count: { id: true },
        });

        // For each model, compute defense rate from messages
        const modelIds = challengesByModel.map((row) => row.aiModel);

        // Get all challenges with their models, then aggregate messages
        const challenges = await prismaQuery.challenge.findMany({
          where: { aiModel: { in: modelIds } },
          select: { id: true, aiModel: true },
        });

        const challengeIdsByModel: Record<string, string[]> = {};
        for (const c of challenges) {
          if (!challengeIdsByModel[c.aiModel]) {
            challengeIdsByModel[c.aiModel] = [];
          }
          challengeIdsByModel[c.aiModel].push(c.id);
        }

        // Aggregate message evaluations grouped by model
        const modelStats: Array<{
          aiModel: string;
          challengeCount: number;
          totalMessages: number;
          defendedMessages: number;
          defenseRate: number;
          securityScore: number;
        }> = [];

        for (const modelRow of challengesByModel) {
          const model = modelRow.aiModel;
          const ids = challengeIdsByModel[model] ?? [];

          if (ids.length === 0) {
            modelStats.push({
              aiModel: model,
              challengeCount: modelRow._count.id,
              totalMessages: 0,
              defendedMessages: 0,
              defenseRate: 0,
              securityScore: 0,
            });
            continue;
          }

          const evalGroups = await prismaQuery.message.groupBy({
            by: ['evaluation'],
            _count: { id: true },
            where: { challengeId: { in: ids } },
          });

          let total = 0;
          let defended = 0;
          for (const row of evalGroups) {
            total += row._count.id;
            if (row.evaluation === 'Defended') {
              defended += row._count.id;
            }
          }

          const defenseRate = total > 0
            ? Number(((defended / total) * 100).toFixed(1))
            : 0;

          // Security score: 0-100 scale based on defense rate
          const securityScore = Number(defenseRate.toFixed(1));

          modelStats.push({
            aiModel: model,
            challengeCount: modelRow._count.id,
            totalMessages: total,
            defendedMessages: defended,
            defenseRate,
            securityScore,
          });
        }

        // Sort by defense rate descending
        modelStats.sort((a, b) => b.defenseRate - a.defenseRate);

        return reply.code(200).send({
          success: true,
          data: { models: modelStats },
          error: null,
        });
      } catch (error) {
        return handleDatabaseError(reply, 'fetch model comparison data', error as Error);
      }
    },
  );

  // ==========================================================================
  // GET /data/trends  ($0.05)
  //
  // Returns time-series trend data for the last 30 days:
  //  - Daily challenge creation count
  //  - Daily message volume
  //  - Defense rate over time
  // ==========================================================================

  app.get(
    '/trends',
    { preHandler: buildPreHandlers(x402Gates.trends ?? null) },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        // Daily challenge creation count
        const recentChallenges = await prismaQuery.challenge.findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        });

        const dailyChallenges: Record<string, number> = {};
        for (const c of recentChallenges) {
          const day = c.createdAt.toISOString().split('T')[0];
          dailyChallenges[day] = (dailyChallenges[day] ?? 0) + 1;
        }

        // Daily message volume and defense rate
        const recentMessages = await prismaQuery.message.findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: { createdAt: true, evaluation: true },
          orderBy: { createdAt: 'asc' },
        });

        const dailyMessages: Record<string, { total: number; defended: number }> = {};
        for (const m of recentMessages) {
          const day = m.createdAt.toISOString().split('T')[0];
          if (!dailyMessages[day]) {
            dailyMessages[day] = { total: 0, defended: 0 };
          }
          dailyMessages[day].total += 1;
          if (m.evaluation === 'Defended') {
            dailyMessages[day].defended += 1;
          }
        }

        // Build ordered trend arrays
        const challengeTrend = Object.entries(dailyChallenges)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({ date, count }));

        const messageTrend = Object.entries(dailyMessages)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, stats]) => ({
            date,
            totalMessages: stats.total,
            defendedMessages: stats.defended,
            defenseRate: stats.total > 0
              ? Number(((stats.defended / stats.total) * 100).toFixed(1))
              : 0,
          }));

        return reply.code(200).send({
          success: true,
          data: {
            period: {
              from: thirtyDaysAgo.toISOString().split('T')[0],
              to: new Date().toISOString().split('T')[0],
            },
            challengeTrend,
            messageTrend,
          },
          error: null,
        });
      } catch (error) {
        return handleDatabaseError(reply, 'fetch trend data', error as Error);
      }
    },
  );

  done();
};
