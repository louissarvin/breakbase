import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prismaQuery } from '../lib/prisma.ts';
import { handleError, handleDatabaseError } from '../utils/errorHandler.ts';

const leaderboardQuerySchema = z.object({
  metric: z.enum(['wins', 'messages', 'earnings', 'spent']).default('wins'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const METRIC_TO_ORDER_BY: Record<string, string> = {
  wins: 'totalWins',
  messages: 'totalMessages',
  earnings: 'totalEarningsUsdc',
  spent: 'totalSpentUsdc',
};

function serializeLeaderboardEntry(user: Record<string, unknown>, rank: number): Record<string, unknown> {
  return {
    rank,
    walletAddress: user.walletAddress,
    totalWins: user.totalWins,
    totalMessages: user.totalMessages,
    totalEarningsUsdc: typeof user.totalEarningsUsdc === 'bigint' ? user.totalEarningsUsdc.toString() : String(user.totalEarningsUsdc ?? '0'),
    totalSpentUsdc: typeof user.totalSpentUsdc === 'bigint' ? user.totalSpentUsdc.toString() : String(user.totalSpentUsdc ?? '0'),
  };
}

export const leaderboardRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {

  // GET /leaderboard (public, paginated)
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = leaderboardQuerySchema.safeParse(request.query);

    if (!parseResult.success) {
      return handleError(reply, 400, 'Invalid query parameters. metric must be one of: wins, messages, earnings, spent', 'INVALID_QUERY_PARAMS');
    }

    const { metric, limit, offset } = parseResult.data;
    const orderByField = METRIC_TO_ORDER_BY[metric];

    try {
      const users = await prismaQuery.user.findMany({
        select: {
          walletAddress: true,
          totalWins: true,
          totalMessages: true,
          totalEarningsUsdc: true,
          totalSpentUsdc: true,
        },
        orderBy: { [orderByField]: 'desc' },
        skip: offset,
        take: limit,
      });

      const leaderboard = users.map((user: Record<string, unknown>, index: number) =>
        serializeLeaderboardEntry(user, offset + index + 1),
      );

      return reply.code(200).send({
        success: true,
        data: { leaderboard, metric, limit, offset },
        error: null,
      });
    } catch (error) {
      return handleDatabaseError(reply, 'fetch leaderboard', error as Error);
    }
  });

  done();
};
