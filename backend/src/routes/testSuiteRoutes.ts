import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import type { preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import { runBattery, computeReportFromMessages } from '../services/attackBatteryService.ts';
import { prismaQuery } from '../lib/prisma.ts';
import { handleError, handleNotFoundError, handleDatabaseError } from '../utils/errorHandler.ts';
import { authMiddleware } from '../middlewares/authMiddleware.ts';
import { createX402PreHandler, registerX402SettlementHook } from '../middlewares/x402Middleware.ts';
import { X402_PAY_TO_ADDRESS } from '../config/main-config.ts';
import { attestAudit } from '../lib/eas/attestationService.ts';
import { BAZAAR_TEST_SUITE } from '../lib/x402/bazaarMetadata.ts';

const runBatterySchema = z.object({
  systemPrompt: z.string().min(1).max(10_000),
  aiModel: z.string().optional(),
  categories: z.array(z.number().int().min(1).max(10)).optional(),
  maxPrompts: z.number().int().min(1).max(100).optional(),
});

// ---------------------------------------------------------------------------
// x402 preHandler for test suite runs ($0.05 per run)
// ---------------------------------------------------------------------------

let x402TestSuiteGate: preHandlerHookHandler | null = null;

try {
  if (!X402_PAY_TO_ADDRESS) {
    console.warn(
      '[testSuiteRoutes] X402_PAY_TO_ADDRESS is not set. x402 payment routes will return 503.',
    );
  } else {
    x402TestSuiteGate = createX402PreHandler({
      payTo: X402_PAY_TO_ADDRESS,
      priceUsd: '$0.05',
      description: 'Automated attack battery test suite run',
      mimeType: 'application/json',
      extensions: BAZAAR_TEST_SUITE,
    });
  }
} catch (err) {
  console.error('[testSuiteRoutes] Failed to create x402 preHandler:', err);
}

export const testSuiteRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {

  // Register the settlement onSend hook for this plugin scope.
  registerX402SettlementHook(app);

  // Build preHandler array for the x402-gated POST /run route
  const runPreHandlers: preHandlerHookHandler[] = [];

  if (x402TestSuiteGate) {
    runPreHandlers.push(x402TestSuiteGate);
  } else {
    // Fallback: reject requests when x402 is not configured
    runPreHandlers.push(async (_req: FastifyRequest, rep: FastifyReply) => {
      await handleError(
        rep,
        503,
        'x402 payment service is not configured',
        'X402_NOT_CONFIGURED',
      );
    });
  }

  // ==========================================================================
  // POST /test-suite/run  (x402-gated, $0.05 per run)
  // ==========================================================================
  app.post('/run', { preHandler: runPreHandlers }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = runBatterySchema.safeParse(request.body);

    if (!parseResult.success) {
      return handleError(reply, 400, 'Invalid request body. systemPrompt is required (1-10000 chars).', 'INVALID_REQUEST');
    }

    const { systemPrompt, aiModel, categories, maxPrompts } = parseResult.data;

    try {
      console.log('[TestSuite] Starting attack battery run...');
      const report = await runBattery({
        systemPrompt,
        aiModel,
        categories,
        maxPrompts,
      });
      console.log(`[TestSuite] Battery complete: ${report.totalTests} tests, score=${report.securityScore}`);

      // Fire-and-forget EAS audit attestation
      const owaspCats = Object.keys(report.owaspCoverage ?? {}).join(',');
      attestAudit({
        agentAddress: X402_PAY_TO_ADDRESS || '0x0000000000000000000000000000000000000000',
        auditId: `battery-${Date.now()}`,
        totalTests: report.totalTests,
        passed: report.passed,
        failed: report.failed,
        owaspCoverage: owaspCats,
        securityScore: Math.round(report.securityScore),
      }).catch((err) => {
        console.error('[TestSuite] EAS attestAudit failed (non-fatal):', err);
      });

      return reply.code(200).send({
        success: true,
        data: report,
        error: null,
      });
    } catch (error) {
      console.error('[TestSuite] Battery run failed:', error);
      return handleError(reply, 500, 'Attack battery run failed', 'BATTERY_RUN_FAILED', error as Error);
    }
  });

  // ==========================================================================
  // GET /test-suite/report/:challengeId  (auth, generate report from challenge messages)
  // ==========================================================================
  app.get('/report/:challengeId', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { challengeId } = request.params as { challengeId: string };

    if (!challengeId) {
      return handleError(reply, 400, 'challengeId is required', 'MISSING_CHALLENGE_ID');
    }

    try {
      // Look up challenge
      const challenge = await prismaQuery.challenge.findFirst({
        where: { id: challengeId },
        select: {
          id: true,
          challengeId: true,
          title: true,
          aiModel: true,
          defender: true,
          status: true,
        },
      });

      if (!challenge) {
        return handleNotFoundError(reply, 'Challenge');
      }

      // Fetch all messages for the challenge
      const messages = await prismaQuery.message.findMany({
        where: { challengeId: challenge.id },
        select: {
          evaluation: true,
          attackType: true,
          owaspCategory: true,
          severity: true,
          playerMessage: true,
          aiResponse: true,
          evaluationReason: true,
          attemptNumber: true,
        },
        orderBy: { attemptNumber: 'asc' },
      });

      if (messages.length === 0) {
        return handleError(reply, 404, 'No messages found for this challenge', 'NO_MESSAGES');
      }

      const report = computeReportFromMessages(messages as any);

      return reply.code(200).send({
        success: true,
        data: {
          challengeId: challenge.challengeId,
          challengeTitle: challenge.title,
          aiModel: challenge.aiModel,
          status: challenge.status,
          ...report,
        },
        error: null,
      });
    } catch (error) {
      return handleDatabaseError(reply, 'generate challenge report', error as Error);
    }
  });

  done();
};
