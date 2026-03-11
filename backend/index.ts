import './dotenv.ts';

import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import FastifyCors from '@fastify/cors';
import FastifyRawBody from 'fastify-raw-body';
import { APP_PORT, API_URL, APP_URL, FARCASTER_HEADER, FARCASTER_PAYLOAD, FARCASTER_SIGNATURE } from './src/config/main-config.ts';

// Routes
import { exampletRoute } from './src/routes/exampleRoutes.ts';
import { authRoutes } from './src/routes/authRoutes.ts';
import { challengeRoutes } from './src/routes/challengeRoutes.ts';
import { paymasterRoutes } from './src/routes/paymasterRoutes.ts';
import { x402Routes } from './src/routes/x402Routes.ts';
import { verificationRoutes } from './src/routes/verificationRoutes.ts';
import { agentRoutes } from './src/routes/agentRoutes.ts';
import { basenameRoutes } from './src/routes/basenameRoutes.ts';
import { attestationRoutes } from './src/routes/attestationRoutes.ts';
import { webhookRoutes } from './src/routes/webhookRoutes.ts';
import { leaderboardRoutes } from './src/routes/leaderboardRoutes.ts';
import { modelsRoutes } from './src/routes/modelsRoutes.ts';
import { testSuiteRoutes } from './src/routes/testSuiteRoutes.ts';
import { frameRoutes } from './src/routes/frameRoutes.ts';
import { dataMarketplaceRoutes } from './src/routes/dataMarketplaceRoutes.ts';
import { onchainDataRoutes } from './src/routes/onchainDataRoutes.ts';

// Workers
import { startErrorLogCleanupWorker } from './src/workers/errorLogCleanup.ts';
import { startEventIndexerWorker } from './src/workers/eventIndexer.ts';
import { startChallengeExpiryWorker } from './src/workers/challengeExpiry.ts';
import { startProtocolAgentWorker } from './src/workers/protocolAgent.ts';

console.log(
  '======================\n======================\nBREAKBASE BACKEND STARTED!\n======================\n======================\n'
);

const fastify = Fastify({
  logger: false,
});

fastify.register(FastifyCors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'token', 'payment-signature', 'x-payment', 'access-control-expose-headers'],
  exposedHeaders: ['payment-required', 'payment-response', 'x-payment-response'],
});

// Enable raw body for webhook signature verification
fastify.register(FastifyRawBody, {
  field: 'rawBody',
  global: false,        // Only routes that opt-in get raw body
  encoding: 'utf8',
  runFirst: true,
});

// Health check endpoint
fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
  return reply.status(200).send({
    success: true,
    message: 'BreakBase API is running',
    error: null,
    data: null,
  });
});

// Farcaster MiniApp discovery (must be at root level)
fastify.get('/.well-known/farcaster.json', async (_request: FastifyRequest, reply: FastifyReply) => {
  const manifest: Record<string, unknown> = {
    accountAssociation: {
      header: FARCASTER_HEADER || 'breakbase',
      payload: FARCASTER_PAYLOAD || 'breakbase',
      signature: FARCASTER_SIGNATURE || 'breakbase',
    },
    miniapp: {
      version: '1',
      name: 'BreakBase',
      iconUrl: `${API_URL}/frames/og`,
      homeUrl: APP_URL,
      splashImageUrl: `${API_URL}/frames/og`,
      splashBackgroundColor: '#0A0A0B',
      webhookUrl: `${API_URL}/frames/webhook`,
    },
  };

  return reply.code(200).send(manifest);
});

// Register routes with prefixes
fastify.register(exampletRoute, { prefix: '/example' });
fastify.register(authRoutes, { prefix: '/auth' });
fastify.register(challengeRoutes, { prefix: '/challenges' });
fastify.register(paymasterRoutes, { prefix: '/paymaster' });
fastify.register(x402Routes, { prefix: '/x402' });
fastify.register(verificationRoutes, { prefix: '/verification' });
fastify.register(agentRoutes, { prefix: '/agent' });
fastify.register(basenameRoutes, { prefix: '/basenames' });
fastify.register(attestationRoutes, { prefix: '/attestations' });
fastify.register(webhookRoutes, { prefix: '/webhooks' });
fastify.register(leaderboardRoutes, { prefix: '/leaderboard' });
fastify.register(modelsRoutes, { prefix: '/models' });
fastify.register(testSuiteRoutes, { prefix: '/test-suite' });
fastify.register(frameRoutes, { prefix: '/frames' });
fastify.register(dataMarketplaceRoutes, { prefix: '/data' });
fastify.register(onchainDataRoutes, { prefix: '/onchain' });

const start = async (): Promise<void> => {
  try {
    // Start workers
    startErrorLogCleanupWorker();
    startEventIndexerWorker();
    startChallengeExpiryWorker();
    startProtocolAgentWorker();

    await fastify.listen({
      port: APP_PORT,
      host: '0.0.0.0',
    });

    const address = fastify.server.address();
    const port = typeof address === 'object' && address ? address.port : APP_PORT;

    console.log(`Server started successfully on port ${port}`);
    console.log(`http://localhost:${port}`);
  } catch (error) {
    console.log('Error starting server: ', error);
    process.exit(1);
  }
};

start();
