import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middlewares/authMiddleware.ts';
import { prismaQuery } from '../lib/prisma.ts';
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handleDatabaseError,
  handleServerError,
  handleForbiddenError,
} from '../utils/errorHandler.ts';
import { evaluate } from '../services/aiEvaluationService.ts';
import { signChallengeResult, getChallengeId } from '../services/oracleService.ts';
import {
  getProvider,
  getFactoryContract,
  getChallengeStatus,
  getCurrentFee,
  getPrizePool,
  getMessageCount,
  verifyMessageSentTx,
} from '../lib/contracts/contractService.ts';
import { CHALLENGE_FACTORY_ADDRESS, DEFAULT_AI_MODEL, APP_URL } from '../config/main-config.ts';
import { sendNotification, getAllTokensGroupedByUrl } from '../lib/farcaster/notificationService.ts';
import { attestAttacker, attestChallengeLinked } from '../lib/eas/attestationService.ts';
import {
  ChallengeStatus,
  PricingModel,
  Difficulty,
  ChallengeType,
  EvaluationResult,
} from '../types/index.ts';
import type {
  CreateChallengeRequest,
  SubmitMessageRequest,
} from '../types/index.ts';

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
// Accept standard tx hashes (0x + 64 hex) and EIP-5792 batch call IDs (any non-empty string)
const TX_HASH_REGEX = /^.{1,256}$/;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_SYSTEM_PROMPT_LENGTH = 10_000;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 50;
const VALID_SORT_FIELDS = new Set(['createdAt', 'prizePool', 'messageCount', 'endTime', 'basePrice']);
const VALID_SORT_ORDERS = new Set(['asc', 'desc']);

function isValidEnum<T extends Record<string, string>>(value: string, enumObj: T): boolean {
  return Object.values(enumObj).includes(value);
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

/** Strip systemPrompt from a challenge object before sending to client. */
function sanitizeChallenge(challenge: Record<string, unknown>): Record<string, unknown> {
  const serialized = serializeBigInts(challenge);
  delete serialized.systemPrompt;
  return serialized;
}

/** Clamp a numeric value between bounds. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const challengeRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {

  // ==========================================================================
  // GET /challenges  (public, paginated, filterable)
  // ==========================================================================
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;

    // Pagination
    const page = clamp(Number(query.page) || 1, 1, 10_000);
    const limit = clamp(Number(query.limit) || 20, 1, 50);
    const skip = (page - 1) * limit;

    // Sorting
    const sortBy = VALID_SORT_FIELDS.has(query.sortBy || '') ? query.sortBy! : 'createdAt';
    const sortOrder = VALID_SORT_ORDERS.has(query.sortOrder || '') ? query.sortOrder! : 'desc';

    // Filters
    const where: Record<string, unknown> = {};

    if (query.status) {
      if (!isValidEnum(query.status, ChallengeStatus)) {
        return handleError(reply, 400, 'Invalid status filter. Must be one of: Active, Resolved, Expired, Cancelled', 'INVALID_STATUS');
      }
      where.status = query.status;
    }

    if (query.defender) {
      if (!ETH_ADDRESS_REGEX.test(query.defender)) {
        return handleError(reply, 400, 'Invalid defender address format', 'INVALID_ADDRESS');
      }
      where.defender = query.defender.toLowerCase();
    }

    if (query.difficulty) {
      if (!isValidEnum(query.difficulty, Difficulty)) {
        return handleError(reply, 400, 'Invalid difficulty filter. Must be one of: Easy, Medium, Hard, Expert', 'INVALID_DIFFICULTY');
      }
      where.difficulty = query.difficulty;
    }

    if (query.challengeType) {
      if (!isValidEnum(query.challengeType, ChallengeType)) {
        return handleError(reply, 400, 'Invalid challengeType filter', 'INVALID_CHALLENGE_TYPE');
      }
      where.challengeType = query.challengeType;
    }

    if (query.pricingModel) {
      if (!isValidEnum(query.pricingModel, PricingModel)) {
        return handleError(reply, 400, 'Invalid pricingModel filter. Must be one of: Fixed, Escalating', 'INVALID_PRICING_MODEL');
      }
      where.pricingModel = query.pricingModel;
    }

    try {
      const [challenges, total] = await Promise.all([
        prismaQuery.challenge.findMany({
          where,
          select: {
            id: true,
            challengeId: true,
            cloneAddress: true,
            defender: true,
            basePrice: true,
            maxFee: true,
            duration: true,
            growthRateBps: true,
            pricingModel: true,
            endTime: true,
            title: true,
            description: true,
            // systemPrompt intentionally excluded
            aiModel: true,
            difficulty: true,
            challengeType: true,
            tags: true,
            agentName: true,
            status: true,
            prizePool: true,
            messageCount: true,
            winnerAddress: true,
            isProtocol: true,
            createdAt: true,
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
        }),
        prismaQuery.challenge.count({ where }),
      ]);

      // Serialize BigInt fields
      const serialized = challenges.map((c: Record<string, unknown>) => serializeBigInts(c as Record<string, unknown>));

      return reply.code(200).send({
        success: true,
        data: {
          challenges: serialized,
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
      return handleDatabaseError(reply, 'list challenges', error as Error);
    }
  });

  // ==========================================================================
  // GET /challenges/:id  (public, single challenge with paginated messages)
  // ==========================================================================
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, string | undefined>;

    if (!id || id.trim().length === 0) {
      return handleValidationError(reply, ['id']);
    }

    // Message pagination
    const messagePage = clamp(Number(query.messagePage) || 1, 1, 10_000);
    const messageLimit = clamp(Number(query.messageLimit) || 20, 1, 50);
    const messageSkip = (messagePage - 1) * messageLimit;

    try {
      // Look up by database ID or cloneAddress
      const isAddress = ETH_ADDRESS_REGEX.test(id);
      const challenge = await prismaQuery.challenge.findFirst({
        where: isAddress ? { cloneAddress: id.toLowerCase() } : { id },
        select: {
          id: true,
          challengeId: true,
          cloneAddress: true,
          factoryAddress: true,
          txHash: true,
          defender: true,
          basePrice: true,
          maxFee: true,
          duration: true,
          growthRateBps: true,
          pricingModel: true,
          endTime: true,
          title: true,
          description: true,
          // systemPrompt intentionally excluded
          aiModel: true,
          difficulty: true,
          challengeType: true,
          tags: true,
          agentEndpoint: true,
          agentName: true,
          agentStyle: true,
          agentGreeting: true,
          status: true,
          prizePool: true,
          messageCount: true,
          winnerAddress: true,
          winnerAttempt: true,
          resolvedAt: true,
          isProtocol: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!challenge) {
        return handleNotFoundError(reply, 'Challenge');
      }

      // Fetch paginated messages (never expose systemPrompt through message data either)
      const [messages, messageTotal] = await Promise.all([
        prismaQuery.message.findMany({
          where: { challengeId: challenge.id },
          select: {
            id: true,
            playerAddress: true,
            attemptNumber: true,
            playerMessage: true,
            aiResponse: true,
            evaluation: true,
            evaluationReason: true,
            attackType: true,
            feePaid: true,
            txHash: true,
            oracleSignature: true,
            oracleDeadline: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
          skip: messageSkip,
          take: messageLimit,
        }),
        prismaQuery.message.count({ where: { challengeId: challenge.id } }),
      ]);

      // Fetch live on-chain state for Active challenges (with 6s timeout)
      let onChainState: Record<string, string | null> | null = null;
      if (challenge.status === ChallengeStatus.Active) {
        try {
          const chainReads = Promise.all([
            getPrizePool(challenge.cloneAddress),
            getMessageCount(challenge.cloneAddress),
            getCurrentFee(challenge.cloneAddress),
          ]);
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Chain read timeout')), 6000),
          );
          const [chainPrizePool, chainMessageCount, chainCurrentFee] = await Promise.race([chainReads, timeout]);
          onChainState = {
            prizePool: chainPrizePool.toString(),
            messageCount: chainMessageCount.toString(),
            currentFee: chainCurrentFee.toString(),
          };
        } catch (chainError) {
          // Chain read failure is non-fatal; log and continue with DB data
          console.error('[ChallengeRoutes] Chain read failed for', challenge.cloneAddress, chainError);
          onChainState = null;
        }
      }

      const serializedChallenge = serializeBigInts(challenge as unknown as Record<string, unknown>);
      const serializedMessages = messages.map((m: Record<string, unknown>) => serializeBigInts(m as Record<string, unknown>));

      return reply.code(200).send({
        success: true,
        data: {
          challenge: serializedChallenge,
          messages: {
            items: serializedMessages,
            pagination: {
              page: messagePage,
              limit: messageLimit,
              total: messageTotal,
              totalPages: Math.ceil(messageTotal / messageLimit),
            },
          },
          onChainState,
        },
        error: null,
      });
    } catch (error) {
      return handleDatabaseError(reply, 'get challenge detail', error as Error);
    }
  });

  // ==========================================================================
  // POST /challenges  (auth required, register challenge after on-chain creation)
  // ==========================================================================
  app.post('/', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateChallengeRequest | null;
    const user = request.user!;

    if (!body) {
      return handleValidationError(reply, ['title', 'description', 'systemPrompt', 'txHash', 'basePrice', 'duration', 'pricingModel']);
    }

    // ---- Required field validation ----
    const missing: string[] = [];
    if (!body.title) missing.push('title');
    if (!body.description) missing.push('description');
    if (!body.systemPrompt) missing.push('systemPrompt');
    if (!body.txHash) missing.push('txHash');
    if (!body.basePrice) missing.push('basePrice');
    if (body.duration === undefined || body.duration === null) missing.push('duration');
    if (!body.pricingModel) missing.push('pricingModel');
    if (missing.length > 0) {
      return handleValidationError(reply, missing);
    }

    // ---- Format validation ----
    if (!TX_HASH_REGEX.test(body.txHash)) {
      return handleError(reply, 400, 'Invalid transaction hash format', 'INVALID_TX_HASH');
    }

    if (typeof body.title !== 'string' || body.title.trim().length === 0 || body.title.length > MAX_TITLE_LENGTH) {
      return handleError(reply, 400, `Title must be between 1 and ${MAX_TITLE_LENGTH} characters`, 'INVALID_TITLE');
    }

    if (typeof body.description !== 'string' || body.description.trim().length === 0 || body.description.length > MAX_DESCRIPTION_LENGTH) {
      return handleError(reply, 400, `Description must be between 1 and ${MAX_DESCRIPTION_LENGTH} characters`, 'INVALID_DESCRIPTION');
    }

    if (typeof body.systemPrompt !== 'string' || body.systemPrompt.trim().length === 0 || body.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
      return handleError(reply, 400, `System prompt must be between 1 and ${MAX_SYSTEM_PROMPT_LENGTH} characters`, 'INVALID_SYSTEM_PROMPT');
    }

    if (!isValidEnum(body.pricingModel, PricingModel)) {
      return handleError(reply, 400, 'Invalid pricingModel. Must be Fixed or Escalating', 'INVALID_PRICING_MODEL');
    }

    if (body.difficulty && !isValidEnum(body.difficulty, Difficulty)) {
      return handleError(reply, 400, 'Invalid difficulty. Must be Easy, Medium, Hard, or Expert', 'INVALID_DIFFICULTY');
    }

    if (body.challengeType && !isValidEnum(body.challengeType, ChallengeType)) {
      return handleError(reply, 400, 'Invalid challengeType', 'INVALID_CHALLENGE_TYPE');
    }

    if (body.agentEndpoint) {
      try {
        const url = new URL(body.agentEndpoint);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          return handleError(reply, 400, 'agentEndpoint must use http or https', 'INVALID_AGENT_ENDPOINT');
        }
      } catch {
        return handleError(reply, 400, 'agentEndpoint must be a valid URL', 'INVALID_AGENT_ENDPOINT');
      }
    }

    if (body.tags) {
      if (!Array.isArray(body.tags) || body.tags.length > MAX_TAGS) {
        return handleError(reply, 400, `Tags must be an array with at most ${MAX_TAGS} items`, 'INVALID_TAGS');
      }
      for (const tag of body.tags) {
        if (typeof tag !== 'string' || tag.trim().length === 0 || tag.length > MAX_TAG_LENGTH) {
          return handleError(reply, 400, `Each tag must be a non-empty string of at most ${MAX_TAG_LENGTH} characters`, 'INVALID_TAG');
        }
      }
    }

    if (body.agentName && (typeof body.agentName !== 'string' || body.agentName.length > 50)) {
      return handleError(reply, 400, 'Agent name must be at most 50 characters', 'INVALID_AGENT_NAME');
    }

    if (body.agentPersona && (typeof body.agentPersona !== 'string' || body.agentPersona.length > MAX_SYSTEM_PROMPT_LENGTH)) {
      return handleError(reply, 400, `Agent persona must be at most ${MAX_SYSTEM_PROMPT_LENGTH} characters`, 'INVALID_AGENT_PERSONA');
    }

    if (body.agentStyle && (typeof body.agentStyle !== 'string' || body.agentStyle.length > 50)) {
      return handleError(reply, 400, 'Agent style must be at most 50 characters', 'INVALID_AGENT_STYLE');
    }

    if (body.agentGreeting && (typeof body.agentGreeting !== 'string' || body.agentGreeting.length > 1000)) {
      return handleError(reply, 400, 'Agent greeting must be at most 1000 characters', 'INVALID_AGENT_GREETING');
    }

    if (typeof body.duration !== 'number' || body.duration <= 0 || !Number.isInteger(body.duration)) {
      return handleError(reply, 400, 'Duration must be a positive integer (seconds)', 'INVALID_DURATION');
    }

    // ---- Check txHash uniqueness (prevent replay) ----
    try {
      const existingChallenge = await prismaQuery.challenge.findFirst({
        where: { txHash: body.txHash },
        select: { id: true },
      });
      if (existingChallenge) {
        return handleError(reply, 409, 'A challenge with this transaction hash already exists', 'DUPLICATE_TX_HASH');
      }
    } catch (error) {
      return handleDatabaseError(reply, 'check duplicate txHash', error as Error);
    }

    // ---- Verify on-chain transaction ----
    let eventData: {
      challengeId: string;
      clone: string;
      defender: string;
      basePrice: bigint;
      duration: number;
      pricingModel: number;
    } | null = null;

    try {
      // Retry up to 8 times (16s of delays) because the tx might not be indexed yet
      // when the frontend sends this request right after EIP-5792 confirmation.
      let receipt = await getProvider().getTransactionReceipt(body.txHash);
      if (!receipt) {
        for (let attempt = 0; attempt < 8 && !receipt; attempt++) {
          await new Promise((r) => setTimeout(r, 2000));
          receipt = await getProvider().getTransactionReceipt(body.txHash);
        }
      }
      if (!receipt) {
        return handleError(reply, 400, 'Transaction not found on-chain after retries. It may still be pending.', 'TX_NOT_FOUND');
      }

      if (receipt.status === 0) {
        return handleError(reply, 400, 'Transaction reverted on-chain', 'TX_REVERTED');
      }

      // NOTE: We do NOT check receipt.to against the factory address because
      // Smart Wallet (EIP-5792) batch calls route through the wallet contract,
      // so receipt.to is the Smart Wallet, not the factory. Instead we rely on
      // the ChallengeCreated event emitted by the factory in the logs below.

      // Parse ChallengeCreated event from receipt logs
      const factory = getFactoryContract();
      for (const log of receipt.logs) {
        try {
          const parsed = factory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (parsed?.name === 'ChallengeCreated') {
            eventData = {
              challengeId: parsed.args[0], // bytes32 challengeId (indexed)
              clone: parsed.args[1],       // address clone (indexed)
              defender: parsed.args[2],    // address defender (indexed)
              basePrice: parsed.args[3],   // uint256 basePrice
              duration: Number(parsed.args[4]), // uint48 duration
              pricingModel: Number(parsed.args[5]), // uint8 pricingModel
            };
            break;
          }
        } catch {
          // Not a ChallengeCreated event from factory, skip
        }
      }

      if (!eventData) {
        return handleError(reply, 400, 'ChallengeCreated event not found in transaction logs', 'EVENT_NOT_FOUND');
      }
    } catch (error) {
      // Distinguish between validation errors (already returned) and RPC errors
      if ((error as { statusCode?: number }).statusCode) {
        throw error; // Re-throw Fastify replies
      }
      return handleError(reply, 502, 'Failed to verify transaction on-chain', 'CHAIN_VERIFICATION_FAILED', error as Error);
    }

    // ---- Verify caller is the defender ----
    if (eventData.defender.toLowerCase() !== user.walletAddress.toLowerCase()) {
      return handleForbiddenError(reply, 'Your wallet address does not match the defender in the on-chain event');
    }

    // ---- Compute endTime from on-chain duration ----
    const endTime = new Date(Date.now() + eventData.duration * 1000);

    // ---- Upsert: the event indexer may have already created a placeholder record
    // with "Untitled Challenge". If so, update it with the real metadata from the
    // user. Otherwise create a new record. ----
    try {
      const challenge = await prismaQuery.challenge.upsert({
        where: { cloneAddress: eventData.clone.toLowerCase() },
        update: {
          txHash: body.txHash,
          maxFee: body.maxFee ? BigInt(body.maxFee) : BigInt(0),
          growthRateBps: body.growthRateBps ?? 0,
          title: body.title.trim(),
          description: body.description.trim(),
          systemPrompt: body.systemPrompt,
          aiModel: body.aiModel || DEFAULT_AI_MODEL,
          difficulty: body.difficulty || Difficulty.Medium,
          challengeType: body.challengeType || ChallengeType.Custom,
          tags: body.tags?.map((t) => t.trim().toLowerCase()) ?? [],
          agentEndpoint: body.agentEndpoint?.trim() || null,
          agentName: body.agentName?.trim() || null,
          agentPersona: body.agentPersona || null,
          agentStyle: body.agentStyle?.trim() || null,
          agentGreeting: body.agentGreeting?.trim() || null,
        },
        create: {
          challengeId: eventData.challengeId,
          cloneAddress: eventData.clone.toLowerCase(),
          factoryAddress: CHALLENGE_FACTORY_ADDRESS.toLowerCase(),
          txHash: body.txHash,
          defender: eventData.defender.toLowerCase(),
          basePrice: eventData.basePrice,
          maxFee: body.maxFee ? BigInt(body.maxFee) : BigInt(0),
          duration: eventData.duration,
          growthRateBps: body.growthRateBps ?? 0,
          pricingModel: eventData.pricingModel === 0 ? PricingModel.Fixed : PricingModel.Escalating,
          endTime,
          title: body.title.trim(),
          description: body.description.trim(),
          systemPrompt: body.systemPrompt,
          aiModel: body.aiModel || DEFAULT_AI_MODEL,
          difficulty: body.difficulty || Difficulty.Medium,
          challengeType: body.challengeType || ChallengeType.Custom,
          tags: body.tags?.map((t) => t.trim().toLowerCase()) ?? [],
          agentEndpoint: body.agentEndpoint?.trim() || null,
          agentName: body.agentName?.trim() || null,
          agentPersona: body.agentPersona || null,
          agentStyle: body.agentStyle?.trim() || null,
          agentGreeting: body.agentGreeting?.trim() || null,
          status: ChallengeStatus.Active,
        },
      });

      return reply.code(201).send({
        success: true,
        data: { challenge: sanitizeChallenge(challenge as unknown as Record<string, unknown>) },
        error: null,
      });
    } catch (error) {
      return handleDatabaseError(reply, 'create challenge', error as Error);
    }
  });

  // ==========================================================================
  // POST /challenges/:id/messages  (auth required, core game loop)
  // ==========================================================================
  app.post('/:id/messages', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as SubmitMessageRequest | null;
    const user = request.user!;

    if (!id || id.trim().length === 0) {
      return handleValidationError(reply, ['id']);
    }

    if (!body || !body.content || !body.txHash) {
      const missing: string[] = [];
      if (!body?.content) missing.push('content');
      if (!body?.txHash) missing.push('txHash');
      return handleValidationError(reply, missing);
    }

    // ---- Input validation ----
    if (typeof body.content !== 'string' || body.content.trim().length === 0 || body.content.length > MAX_MESSAGE_LENGTH) {
      return handleError(reply, 400, `Message content must be between 1 and ${MAX_MESSAGE_LENGTH} characters`, 'INVALID_CONTENT');
    }

    if (!TX_HASH_REGEX.test(body.txHash)) {
      return handleError(reply, 400, 'Invalid transaction hash format', 'INVALID_TX_HASH');
    }

    // ---- Look up challenge ----
    let challenge;
    try {
      const isAddress = ETH_ADDRESS_REGEX.test(id);
      challenge = await prismaQuery.challenge.findFirst({
        where: isAddress ? { cloneAddress: id.toLowerCase() } : { id },
      });
    } catch (error) {
      return handleDatabaseError(reply, 'find challenge for message', error as Error);
    }

    if (!challenge) {
      return handleNotFoundError(reply, 'Challenge');
    }

    // ---- Verify challenge is Active ----
    if (challenge.status !== ChallengeStatus.Active) {
      return handleError(reply, 400, `Challenge is not active (current status: ${challenge.status})`, 'CHALLENGE_NOT_ACTIVE');
    }

    // ---- Check challenge hasn't expired by time ----
    if (new Date() > challenge.endTime) {
      return handleError(reply, 400, 'Challenge has expired', 'CHALLENGE_EXPIRED');
    }

    // ---- Check txHash hasn't been used before (prevent replay attacks) ----
    try {
      const existingMessage = await prismaQuery.message.findFirst({
        where: { txHash: body.txHash },
        select: { id: true },
      });
      if (existingMessage) {
        return handleError(reply, 409, 'This transaction hash has already been used for a message', 'DUPLICATE_TX_HASH');
      }
    } catch (error) {
      return handleDatabaseError(reply, 'check duplicate message txHash', error as Error);
    }

    // ---- Verify on-chain MessageSent transaction ----
    let txVerification;
    try {
      txVerification = await verifyMessageSentTx(
        body.txHash,
        user.walletAddress,
        challenge.cloneAddress,
      );
    } catch (error) {
      return handleError(reply, 502, 'Failed to verify message transaction on-chain', 'CHAIN_VERIFICATION_FAILED', error as Error);
    }

    if (!txVerification.valid) {
      return handleError(reply, 400, 'Transaction does not contain a valid MessageSent event for this player and challenge', 'INVALID_MESSAGE_TX');
    }

    const feePaid = txVerification.fee ?? BigInt(0);
    const attemptNumber = txVerification.messageCount ?? (challenge.messageCount + 1);

    // ---- Build message history for AI context ----
    let messageHistory: Array<{ role: 'player' | 'ai'; content: string }>;
    try {
      const previousMessages = await prismaQuery.message.findMany({
        where: { challengeId: challenge.id },
        select: { playerMessage: true, aiResponse: true },
        orderBy: { createdAt: 'asc' },
        take: 50, // Cap history to prevent token abuse
      });
      messageHistory = previousMessages.flatMap((m: { playerMessage: string; aiResponse: string }) => [
        { role: 'player' as const, content: m.playerMessage },
        { role: 'ai' as const, content: m.aiResponse },
      ]);
    } catch (error) {
      return handleDatabaseError(reply, 'fetch message history', error as Error);
    }

    // ---- Run AI evaluation (two-phase: respond then judge) ----
    let evaluationResult;
    try {
      evaluationResult = await evaluate({
        systemPrompt: challenge.systemPrompt,
        playerMessage: body.content.trim(),
        messageHistory,
        aiModel: challenge.aiModel,
        agentEndpoint: challenge.agentEndpoint ?? undefined,
        agentName: challenge.agentName ?? undefined,
        agentPersona: challenge.agentPersona ?? undefined,
        agentStyle: challenge.agentStyle ?? undefined,
      });
    } catch (error) {
      // AI failure is not the player's fault. Log it, save as Error evaluation,
      // but do NOT charge them again. We still record the attempt.
      console.error('[ChallengeRoutes] AI evaluation failed for challenge', challenge.id, error);
      evaluationResult = {
        broken: false,
        aiResponse: 'The AI defender encountered an internal error. Your attempt has been recorded and you will not be charged again for this message.',
        reason: 'AI evaluation service failure',
        attackType: null,
        owaspCategory: null,
        severity: null,
        confidence: 0,
      };

      // Save the errored message so the txHash can't be replayed
      try {
        await prismaQuery.$transaction([
          prismaQuery.message.create({
            data: {
              challengeId: challenge.id,
              playerAddress: user.walletAddress.toLowerCase(),
              userId: user.id,
              attemptNumber,
              playerMessage: body.content.trim(),
              aiResponse: evaluationResult.aiResponse,
              evaluation: EvaluationResult.Error,
              evaluationReason: evaluationResult.reason,
              attackType: null,
              feePaid,
              txHash: body.txHash,
            },
          }),
          prismaQuery.challenge.update({
            where: { id: challenge.id },
            data: { messageCount: { increment: 1 } },
          }),
          prismaQuery.user.update({
            where: { id: user.id },
            data: {
              totalMessages: { increment: 1 },
              totalSpentUsdc: { increment: feePaid },
            },
          }),
        ]);
      } catch (dbError) {
        console.error('[ChallengeRoutes] Failed to save errored message', dbError);
      }

      return reply.code(200).send({
        success: true,
        data: {
          aiResponse: evaluationResult.aiResponse,
          evaluation: EvaluationResult.Error,
          evaluationReason: evaluationResult.reason,
          attackType: null,
          oracleSignature: null,
        },
        error: null,
      });
    }

    // ---- If broken, sign oracle result for on-chain resolution ----
    let oracleData: { signature: string; deadline: number; challengeId: string } | null = null;
    if (evaluationResult.broken) {
      try {
        oracleData = await signChallengeResult({
          cloneAddress: challenge.cloneAddress,
          winner: user.walletAddress,
          attemptNumber,
        });
      } catch (error) {
        // Oracle signing failure is critical. Log heavily but still record the message.
        console.error('[ChallengeRoutes] CRITICAL: Oracle signing failed for broken challenge', challenge.id, error);
        return handleServerError(reply, error as Error);
      }
    }

    // ---- Persist message, update challenge, update user stats (atomic) ----
    const evaluation = evaluationResult.broken ? EvaluationResult.Broken : EvaluationResult.Defended;

    try {
      const messageData = {
        challengeId: challenge.id,
        playerAddress: user.walletAddress.toLowerCase(),
        userId: user.id,
        attemptNumber,
        playerMessage: body.content.trim(),
        aiResponse: evaluationResult.aiResponse,
        evaluation,
        evaluationReason: evaluationResult.reason,
        attackType: evaluationResult.attackType,
        owaspCategory: evaluationResult.owaspCategory ?? null,
        severity: evaluationResult.severity ?? null,
        feePaid,
        txHash: body.txHash,
        oracleSignature: oracleData?.signature ?? null,
        oracleDeadline: oracleData ? new Date(oracleData.deadline * 1000) : null,
      };

      const challengeUpdate: Record<string, unknown> = {
        messageCount: { increment: 1 },
      };

      // If broken, mark the challenge as resolved
      if (evaluationResult.broken && oracleData) {
        challengeUpdate.winnerAddress = user.walletAddress.toLowerCase();
        challengeUpdate.winnerAttempt = attemptNumber;
        challengeUpdate.status = ChallengeStatus.Resolved;
        challengeUpdate.resolvedAt = new Date();
      }

      await prismaQuery.$transaction([
        prismaQuery.message.create({ data: messageData }),
        prismaQuery.challenge.update({
          where: { id: challenge.id },
          data: challengeUpdate,
        }),
        prismaQuery.user.update({
          where: { id: user.id },
          data: {
            totalMessages: { increment: 1 },
            totalSpentUsdc: { increment: feePaid },
            ...(evaluationResult.broken ? { totalWins: { increment: 1 }, totalEarningsUsdc: { increment: challenge.prizePool } } : {}),
          },
        }),
      ]);
    } catch (error) {
      return handleDatabaseError(reply, 'save message and update stats', error as Error);
    }

    // ---- Fire-and-forget EAS attestations on break ----
    if (evaluationResult.broken && oracleData) {
      const survivalDuration = Math.floor((Date.now() - challenge.createdAt.getTime()) / 1000);

      attestChallengeLinked({
        attackerAddress: user.walletAddress,
        defenderAddress: challenge.defender,
        challengeId: challenge.challengeId,
        attackType: evaluationResult.attackType || 'unknown',
        severity: evaluationResult.severity ?? 0,
        owaspCategory: evaluationResult.owaspCategory ?? 0,
        attemptNumber,
        prizeWon: challenge.prizePool,
        totalAttempts: challenge.messageCount + 1,
        survivalDuration,
        prizePoolSize: challenge.prizePool,
        wasBreached: true,
        modelUsed: challenge.aiModel,
      }).catch((err) => {
        console.error('[ChallengeRoutes] EAS attestChallengeLinked failed (non-fatal):', err);
      });

      // Fire-and-forget Farcaster notification on break
      getAllTokensGroupedByUrl().then(async (grouped) => {
        if (grouped.size === 0) return;
        const tokens: Array<{ token: string; url: string }> = [];
        for (const [url, urlTokens] of grouped) {
          for (const t of urlTokens) {
            tokens.push({ token: t, url });
          }
        }
        await sendNotification({
          notificationId: `break-${challenge.id}`,
          title: 'Challenge Broken!',
          body: `${challenge.title} was just broken!`,
          targetUrl: `${APP_URL}/challenges/${challenge.id}`,
          tokens,
        });
      }).catch((err) => {
        console.error('[ChallengeRoutes] Farcaster notification failed (non-fatal):', err);
      });
    }

    // ---- Build response ----
    const responseData: Record<string, unknown> = {
      aiResponse: evaluationResult.aiResponse,
      evaluation,
      evaluationReason: evaluationResult.reason,
      attackType: evaluationResult.attackType,
      attemptNumber,
      oracleSignature: null as Record<string, unknown> | null,
    };

    if (evaluationResult.broken && oracleData) {
      responseData.oracleSignature = {
        signature: oracleData.signature,
        winner: user.walletAddress,
        attemptNumber,
        deadline: oracleData.deadline,
        challengeId: oracleData.challengeId,
        cloneAddress: challenge.cloneAddress,
      };
    }

    return reply.code(200).send({
      success: true,
      data: responseData,
      error: null,
    });
  });

  // ==========================================================================
  // GET /challenges/:id/fee  (public, live on-chain fee read)
  // ==========================================================================
  app.get('/:id/fee', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    if (!id || id.trim().length === 0) {
      return handleValidationError(reply, ['id']);
    }

    // Look up challenge to get cloneAddress
    let challenge;
    try {
      const isAddress = ETH_ADDRESS_REGEX.test(id);
      challenge = await prismaQuery.challenge.findFirst({
        where: isAddress ? { cloneAddress: id.toLowerCase() } : { id },
        select: { cloneAddress: true, status: true },
      });
    } catch (error) {
      return handleDatabaseError(reply, 'find challenge for fee lookup', error as Error);
    }

    if (!challenge) {
      return handleNotFoundError(reply, 'Challenge');
    }

    try {
      const fee = await getCurrentFee(challenge.cloneAddress);

      return reply.code(200).send({
        success: true,
        data: {
          fee: fee.toString(),
          cloneAddress: challenge.cloneAddress,
          status: challenge.status,
        },
        error: null,
      });
    } catch (error) {
      return handleError(reply, 502, 'Failed to read current fee from chain', 'CHAIN_READ_FAILED', error as Error);
    }
  });

  done();
};
