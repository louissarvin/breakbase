import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { isConfigured, getAgentAddress, getAgentBalance, publicClient } from '../lib/cdp/walletService.ts';
import { formatUnits } from 'viem';
import {
  isAgentKitReady,
  getAgentKitWalletAddress,
  runAgentTask,
  runAnalysis,
} from '../lib/cdp/agentKitService.ts';
import { ensureAgentPolicy, listPolicies } from '../lib/cdp/policyService.ts';
import { prismaQuery } from '../lib/prisma.ts';
import { handleError, handleDatabaseError } from '../utils/errorHandler.ts';
import { authMiddleware } from '../middlewares/authMiddleware.ts';
import { AGENT_CHAT_FEE_USDC, USDC_ADDRESS, X402_PAY_TO_ADDRESS } from '../config/main-config.ts';
import { createX402PreHandler, registerX402SettlementHook } from '../middlewares/x402Middleware.ts';
import type { preHandlerHookHandler } from 'fastify';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NETWORK = 'base-sepolia' as const;
const LOG_PREFIX = '[AgentRoutes]';

/** Max items per page for action history. */
const MAX_PAGE_LIMIT = 50;
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_NUMBER = 10_000;

/** Timeout for AI agent task execution (ms). */
const AGENT_TASK_TIMEOUT_MS = 120_000;

/** Max input lengths for agent chat. */
const MAX_TASK_LENGTH = 1_000;
const MAX_CONTEXT_LENGTH = 2_000;

/** Regex for validating transaction hash format (0x + 64 hex characters). */
const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;

/** Valid enum values (must match Prisma schema AgentActionType / ActionStatus). */
const VALID_ACTION_TYPES = new Set([
  'FeeDistribution',
  'ChallengeSeeded',
  'PrizePoolSeeded',
  'AttestationCreated',
  'Other',
]);

const VALID_ACTION_STATUSES = new Set([
  'Pending',
  'Success',
  'Failed',
]);

/** Valid analysis types for the convenience endpoint. */
const VALID_ANALYSIS_TYPES = new Set([
  'fee_distribution',
  'challenge_health',
  'platform_overview',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a numeric value between bounds. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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
// Route plugin
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// x402 gate for agent chat
// ---------------------------------------------------------------------------

let x402AgentChatGate: preHandlerHookHandler | null = null;

try {
  if (!X402_PAY_TO_ADDRESS) {
    console.warn('[AgentRoutes] X402_PAY_TO_ADDRESS not set. Agent chat will be free.');
  } else {
    x402AgentChatGate = createX402PreHandler({
      payTo: X402_PAY_TO_ADDRESS,
      priceUsd: `$${AGENT_CHAT_FEE_USDC}`,
      description: 'AI agent chat interaction',
      mimeType: 'application/json',
    });
  }
} catch (err) {
  console.error('[AgentRoutes] Failed to create x402 chat gate:', err);
}

export const agentRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {

  // Register x402 settlement hook for this plugin scope
  registerX402SettlementHook(app);

  // ==========================================================================
  // GET /agent/status  (public, protocol agent wallet status)
  // ==========================================================================
  app.get('/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    // AgentKit status (non-fatal if unavailable)
    const agentKitReady = isAgentKitReady();
    let agentKitWalletAddress: string | null = null;
    if (agentKitReady) {
      try {
        agentKitWalletAddress = await getAgentKitWalletAddress();
      } catch (error) {
        console.error(`${LOG_PREFIX} Failed to get AgentKit wallet address:`, error);
      }
    }

    // If CDP is not configured, return a safe default (not an error)
    if (!isConfigured()) {
      return reply.code(200).send({
        success: true,
        data: {
          isConfigured: false,
          walletAddress: null,
          usdcBalance: '0',
          network: NETWORK,
          agentKit: {
            isReady: agentKitReady,
            walletAddress: agentKitWalletAddress,
          },
        },
        error: null,
      });
    }

    // CDP is configured; fetch wallet address and balance
    let walletAddress: string;
    try {
      walletAddress = await getAgentAddress();
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to get agent address:`, error);
      return handleError(
        reply,
        502,
        'Failed to retrieve agent wallet address from CDP',
        'CDP_ADDRESS_FAILED',
        error as Error,
      );
    }

    let usdcBalance = '0';
    try {
      const balance = await getAgentBalance();
      usdcBalance = balance.formatted;
    } catch (error) {
      // Balance fetch failure is non-fatal; log and return "0"
      console.error(`${LOG_PREFIX} Failed to get agent balance, returning 0:`, error);
    }

    // Fetch AgentKit wallet USDC balance on-chain (this is where x402 payments go)
    let agentKitUsdcBalance = '0';
    if (agentKitWalletAddress) {
      try {
        const ERC20_BALANCE_ABI = [{ inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' }] as const;
        const raw = await publicClient.readContract({
          address: USDC_ADDRESS as `0x${string}`,
          abi: ERC20_BALANCE_ABI,
          functionName: 'balanceOf',
          args: [agentKitWalletAddress as `0x${string}`],
        });
        agentKitUsdcBalance = formatUnits(raw, 6);
      } catch (error) {
        console.error(`${LOG_PREFIX} Failed to get AgentKit wallet balance:`, error);
      }
    }

    return reply.code(200).send({
      success: true,
      data: {
        isConfigured: true,
        walletAddress,
        usdcBalance,
        network: NETWORK,
        agentKit: {
          isReady: agentKitReady,
          walletAddress: agentKitWalletAddress,
          usdcBalance: agentKitUsdcBalance,
        },
      },
      error: null,
    });
  });

  // ==========================================================================
  // GET /agent/actions  (public, paginated action history)
  // ==========================================================================
  app.get('/actions', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;

    // Pagination
    const page = clamp(Number(query.page) || 1, 1, MAX_PAGE_NUMBER);
    const limit = clamp(Number(query.limit) || DEFAULT_PAGE_LIMIT, 1, MAX_PAGE_LIMIT);
    const skip = (page - 1) * limit;

    // Filters
    const where: Record<string, unknown> = {};

    if (query.actionType) {
      if (!VALID_ACTION_TYPES.has(query.actionType)) {
        return handleError(
          reply,
          400,
          `Invalid actionType filter. Must be one of: ${[...VALID_ACTION_TYPES].join(', ')}`,
          'INVALID_ACTION_TYPE',
        );
      }
      where.actionType = query.actionType;
    }

    if (query.status) {
      if (!VALID_ACTION_STATUSES.has(query.status)) {
        return handleError(
          reply,
          400,
          `Invalid status filter. Must be one of: ${[...VALID_ACTION_STATUSES].join(', ')}`,
          'INVALID_ACTION_STATUS',
        );
      }
      where.status = query.status;
    }

    try {
      const [actions, total] = await Promise.all([
        prismaQuery.agentAction.findMany({
          where,
          select: {
            id: true,
            actionType: true,
            challengeId: true,
            description: true,
            txHash: true,
            status: true,
            error: true,
            amountUsdc: true,
            createdAt: true,
            completedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prismaQuery.agentAction.count({ where }),
      ]);

      const serialized = actions.map((a: Record<string, unknown>) =>
        serializeBigInts(a as Record<string, unknown>),
      );

      return reply.code(200).send({
        success: true,
        data: {
          actions: serialized,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
        error: null,
      });
    } catch (error) {
      return handleDatabaseError(reply, 'list agent actions', error as Error);
    }
  });

  // ==========================================================================
  // GET /agent/actions/stats  (public, aggregated agent statistics)
  // ==========================================================================
  app.get('/actions/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Run all aggregation queries in parallel
      const [
        totalActions,
        successfulActions,
        failedActions,
        distributionAgg,
        actionsByTypeRaw,
      ] = await Promise.all([
        prismaQuery.agentAction.count(),
        prismaQuery.agentAction.count({ where: { status: 'Success' } }),
        prismaQuery.agentAction.count({ where: { status: 'Failed' } }),
        prismaQuery.agentAction.aggregate({
          where: {
            actionType: 'FeeDistribution',
            status: 'Success',
          },
          _sum: { amountUsdc: true },
        }),
        prismaQuery.agentAction.groupBy({
          by: ['actionType'],
          _count: { _all: true },
        }),
      ]);

      // Convert grouped counts into a clean object
      const actionsByType: Record<string, number> = {};
      for (const group of actionsByTypeRaw) {
        actionsByType[group.actionType] = group._count._all;
      }

      // amountUsdc is BigInt, convert to string for safe JSON serialization
      const totalDistributed = distributionAgg._sum.amountUsdc
        ? distributionAgg._sum.amountUsdc.toString()
        : '0';

      return reply.code(200).send({
        success: true,
        data: {
          totalActions,
          successfulActions,
          failedActions,
          totalDistributed,
          actionsByType,
        },
        error: null,
      });
    } catch (error) {
      return handleDatabaseError(reply, 'aggregate agent action stats', error as Error);
    }
  });

  // ==========================================================================
  // GET /agent/chat/config  (public, returns chat fee and recipient address)
  // ==========================================================================
  app.get('/chat/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    let agentKitWalletAddress: string | null = null;
    try {
      if (isAgentKitReady()) {
        agentKitWalletAddress = await getAgentKitWalletAddress();
      }
    } catch { /* non-fatal */ }

    return reply.code(200).send({
      success: true,
      data: {
        feeUsdc: AGENT_CHAT_FEE_USDC,
        recipientAddress: agentKitWalletAddress,
        usdcAddress: USDC_ADDRESS,
        network: NETWORK,
      },
      error: null,
    });
  });

  // ==========================================================================
  // POST /agent/chat  (x402 payment-gated, AI agent interaction)
  // ==========================================================================
  const chatPreHandlers: preHandlerHookHandler[] = [];

  // Check AgentKit readiness BEFORE x402 gate so users are never charged
  // for a service that cannot respond.
  chatPreHandlers.push(async (_req: FastifyRequest, rep: FastifyReply) => {
    if (!isAgentKitReady()) {
      return handleError(
        rep,
        503,
        'AgentKit is not ready. Please try again later.',
        'AGENTKIT_NOT_READY',
      );
    }
  });

  if (x402AgentChatGate) {
    chatPreHandlers.push(x402AgentChatGate);
  }

  app.post('/chat', { preHandler: chatPreHandlers }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | null;

    // --- Input validation ---
    if (!body || typeof body !== 'object') {
      return handleError(reply, 400, 'Request body is required', 'VALIDATION_ERROR');
    }

    const { task, context } = body;

    if (typeof task !== 'string' || task.trim().length === 0) {
      return handleError(reply, 400, 'task is required and must be a non-empty string', 'VALIDATION_ERROR');
    }

    if (task.length > MAX_TASK_LENGTH) {
      return handleError(
        reply,
        400,
        `task must not exceed ${MAX_TASK_LENGTH} characters`,
        'VALIDATION_ERROR',
      );
    }

    if (context !== undefined && context !== null) {
      if (typeof context !== 'string') {
        return handleError(reply, 400, 'context must be a string', 'VALIDATION_ERROR');
      }
      if (context.length > MAX_CONTEXT_LENGTH) {
        return handleError(
          reply,
          400,
          `context must not exceed ${MAX_CONTEXT_LENGTH} characters`,
          'VALIDATION_ERROR',
        );
      }
    }

    // AgentKit readiness is already checked in the preHandler (before x402 payment).

    // --- Execute agent task with timeout ---
    try {
      const taskPromise = runAgentTask(
        task.trim(),
        typeof context === 'string' ? context.trim() : undefined,
      );

      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('Agent task timed out')), AGENT_TASK_TIMEOUT_MS);
      });

      const result = await Promise.race([taskPromise, timeoutPromise]);

      let walletAddress: string | null = null;
      try {
        walletAddress = await getAgentKitWalletAddress();
      } catch {
        // Non-fatal: wallet address is supplementary info
      }

      // Record the interaction in AgentAction table (non-blocking, non-fatal)
      try {
        await prismaQuery.agentAction.create({
          data: {
            actionType: 'Other',
            description: `Agent chat: "${task.slice(0, 100)}"`,
            status: result.success ? 'Success' : 'Failed',
            amountUsdc: BigInt(Math.round(parseFloat(AGENT_CHAT_FEE_USDC) * 1e6)),
            completedAt: new Date(),
          },
        });
      } catch (dbError) {
        console.error(`${LOG_PREFIX} Failed to record agent chat action:`, dbError);
      }

      return reply.code(200).send({
        success: true,
        data: {
          text: result.text,
          toolCalls: result.toolCalls,
          steps: result.steps,
          walletAddress,
        },
        error: null,
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === 'Agent task timed out') {
        return handleError(reply, 504, 'Agent task timed out', 'AGENT_TIMEOUT', err);
      }
      return handleError(reply, 500, 'Agent task failed', 'AGENT_TASK_FAILED', err);
    }
  });

  // ==========================================================================
  // GET /agent/analysis/:type  (public, pre-built AI analysis)
  // ==========================================================================
  app.get('/analysis/:type', async (request: FastifyRequest, reply: FastifyReply) => {
    const { type: rawType } = request.params as { type: string };

    // Normalize: accept both hyphens and underscores
    const normalizedType = rawType.replace(/-/g, '_');

    if (!VALID_ANALYSIS_TYPES.has(normalizedType)) {
      return handleError(
        reply,
        400,
        `Invalid analysis type. Must be one of: ${[...VALID_ANALYSIS_TYPES].join(', ')}`,
        'INVALID_ANALYSIS_TYPE',
      );
    }

    // --- AgentKit readiness gate ---
    if (!isAgentKitReady()) {
      return handleError(
        reply,
        503,
        'AgentKit is not ready. Please try again later.',
        'AGENTKIT_NOT_READY',
      );
    }

    try {
      const analysisType = normalizedType as 'fee_distribution' | 'challenge_health' | 'platform_overview';
      const analysis = await runAnalysis(analysisType);

      return reply.code(200).send({
        success: true,
        data: {
          analysisType,
          analysis,
          generatedAt: new Date().toISOString(),
        },
        error: null,
      });
    } catch (error) {
      return handleError(
        reply,
        500,
        'Analysis failed',
        'ANALYSIS_FAILED',
        error as Error,
      );
    }
  });

  // ==========================================================================
  // POST /agent/policies/init  (auth-protected, initialize agent wallet policy)
  // ==========================================================================
  app.post('/policies/init', { preHandler: [authMiddleware] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!isConfigured()) {
      return handleError(reply, 503, 'CDP is not configured', 'CDP_NOT_CONFIGURED');
    }

    try {
      const policyId = await ensureAgentPolicy();

      if (!policyId) {
        return handleError(reply, 500, 'Failed to create or find agent policy', 'POLICY_INIT_FAILED');
      }

      return reply.code(200).send({
        success: true,
        data: { policyId },
        error: null,
      });
    } catch (error) {
      return handleError(reply, 500, 'Policy initialization failed', 'POLICY_INIT_FAILED', error as Error);
    }
  });

  // ==========================================================================
  // GET /agent/policies  (auth-protected, list all policies)
  // ==========================================================================
  app.get('/policies', { preHandler: [authMiddleware] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!isConfigured()) {
      return handleError(reply, 503, 'CDP is not configured', 'CDP_NOT_CONFIGURED');
    }

    try {
      const policies = await listPolicies();

      if (policies === null) {
        return handleError(reply, 500, 'Failed to fetch policies', 'POLICIES_FETCH_FAILED');
      }

      return reply.code(200).send({
        success: true,
        data: { policies },
        error: null,
      });
    } catch (error) {
      return handleError(reply, 500, 'Failed to list policies', 'POLICIES_FETCH_FAILED', error as Error);
    }
  });

  // ==========================================================================
  // GET /agent/profile  (public, agent identity and capabilities)
  // ==========================================================================
  app.get('/profile', async (_request: FastifyRequest, reply: FastifyReply) => {
    let agentKitWalletAddress: string | null = null;
    try {
      if (isAgentKitReady()) {
        agentKitWalletAddress = await getAgentKitWalletAddress();
      }
    } catch { /* non-fatal */ }

    return reply.code(200).send({
      success: true,
      data: {
        name: 'BreakBase Protocol Agent',
        description: 'Autonomous AI agent that monitors challenges, distributes fees, and manages the protocol treasury on Base L2.',
        avatar: `https://api.dicebear.com/9.x/bottts/svg?seed=breakbase-agent&backgroundColor=0052FF`,
        walletAddress: agentKitWalletAddress,
        capabilities: [
          'Challenge monitoring & seeding',
          'Fee distribution',
          'DeFi treasury management (Compound, Morpho)',
          'Platform analytics & insights',
          'Market intelligence (Pyth, Allora)',
        ],
      },
      error: null,
    });
  });

  done();
};
