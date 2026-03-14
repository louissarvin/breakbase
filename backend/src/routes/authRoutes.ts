import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { SiweMessage } from 'siwe';
import jwt from 'jsonwebtoken';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { prismaQuery } from '../lib/prisma.ts';
import { JWT_SECRET, JWT_EXPIRES_IN, CHAIN_ID, RPC_URL } from '../config/main-config.ts';
import { handleError, handleValidationError, handleDatabaseError } from '../utils/errorHandler.ts';
import { authMiddleware } from '../middlewares/authMiddleware.ts';
import { getAlphanumericId } from '../utils/miscUtils.ts';

// Viem client for ERC-1271 signature verification (Smart Wallet support)
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

export const authRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {

  // POST /auth/nonce
  // Generate a nonce and SIWE message for wallet signing
  app.post('/nonce', async (request: FastifyRequest, reply: FastifyReply) => {
    const { walletAddress } = request.body as { walletAddress?: string };

    if (!walletAddress) {
      return handleValidationError(reply, ['walletAddress']);
    }

    // Validate Ethereum address format (0x + 40 hex chars)
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return handleError(reply, 400, 'Invalid wallet address format', 'INVALID_ADDRESS');
    }

    const nonce = getAlphanumericId(16);

    // Upsert user with new nonce (creates on first interaction, updates on subsequent)
    try {
      await prismaQuery.user.upsert({
        where: { walletAddress: walletAddress.toLowerCase() },
        update: { nonce },
        create: {
          walletAddress: walletAddress.toLowerCase(),
          nonce,
        },
      });
    } catch (error) {
      return handleDatabaseError(reply, 'upsert user nonce', error as Error);
    }

    // Build SIWE message
    const siweMessage = new SiweMessage({
      domain: request.hostname || 'localhost',
      address: walletAddress,
      statement: 'Sign in to BreakBase',
      uri: `${request.protocol}://${request.hostname}`,
      version: '1',
      chainId: CHAIN_ID,
      nonce,
    });

    return reply.send({
      success: true,
      data: {
        nonce,
        message: siweMessage.prepareMessage(),
      },
      error: null,
    });
  });

  // POST /auth/verify
  // Verify SIWE signature and issue JWT
  app.post('/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const { message, signature } = request.body as { message?: string; signature?: string };

    if (!message || !signature) {
      return handleValidationError(reply, ['message', 'signature']);
    }

    // Parse the SIWE message
    let siweMessage: SiweMessage;
    try {
      siweMessage = new SiweMessage(message);
    } catch {
      return handleError(reply, 400, 'Invalid SIWE message format', 'INVALID_SIWE_MESSAGE');
    }

    // Verify signature using viem (supports both EOA and ERC-1271 Smart Wallet signatures)
    let isValid: boolean;
    try {
      isValid = await publicClient.verifyMessage({
        address: siweMessage.address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
      console.log('[Auth] Signature verification:', isValid ? 'valid' : 'invalid', 'for', siweMessage.address);
    } catch (err) {
      console.error('[Auth] Signature verification error:', (err as Error).message);
      return handleError(reply, 401, 'Signature verification failed', 'SIGNATURE_FAILED');
    }

    if (!isValid) {
      return handleError(reply, 401, 'Invalid signature', 'INVALID_SIGNATURE');
    }

    const walletAddress = siweMessage.address.toLowerCase();

    // Find user and verify nonce matches
    let user;
    try {
      user = await prismaQuery.user.findUnique({
        where: { walletAddress },
      });
    } catch (error) {
      return handleDatabaseError(reply, 'find user for verification', error as Error);
    }

    if (!user) {
      return handleError(reply, 401, 'User not found. Request a nonce first.', 'USER_NOT_FOUND');
    }

    if (user.nonce !== siweMessage.nonce) {
      return handleError(reply, 401, 'Invalid nonce', 'INVALID_NONCE');
    }

    // Clear nonce (single-use) and update last sign in timestamp
    try {
      await prismaQuery.user.update({
        where: { walletAddress },
        data: {
          nonce: null,
          lastSignIn: new Date(),
        },
      });
    } catch (error) {
      return handleDatabaseError(reply, 'clear nonce after verification', error as Error);
    }

    // Issue JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    return reply.send({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          totalMessages: user.totalMessages,
          totalWins: user.totalWins,
        },
      },
      error: null,
    });
  });

  // GET /auth/me
  // Protected: returns current authenticated user profile
  app.get('/me', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;

    if (!user) {
      return handleError(reply, 401, 'Not authenticated', 'NOT_AUTHENTICATED');
    }

    return reply.send({
      success: true,
      data: {
        id: user.id,
        walletAddress: user.walletAddress,
        totalMessages: user.totalMessages ?? 0,
        totalWins: user.totalWins ?? 0,
        lastSignIn: user.lastSignIn,
        createdAt: user.createdAt,
      },
      error: null,
    });
  });

  done();
};
