/**
 * CDP Webhook Routes
 *
 * Receives push notifications from Coinbase Developer Platform for on-chain
 * events. Complements the polling-based event indexer with real-time event
 * delivery.
 *
 * Events handled:
 *  - USDC transfers to/from challenge contracts
 *  - ChallengeCreated, ChallengeResolved, ChallengeExpired events
 *
 * Webhook signatures are verified using the Svix protocol (HMAC-SHA256).
 */

import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { Webhook } from 'svix';
import { prismaQuery } from '../lib/prisma.ts';
import { CDP_WEBHOOK_SECRET } from '../config/main-config.ts';
import { handleError } from '../utils/errorHandler.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[CDPWebhook]';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebhookEvent {
  eventType: string;
  data: {
    network?: string;
    contractAddress?: string;
    eventName?: string;
    eventSignature?: string;
    transactionHash?: string;
    blockNumber?: number;
    logIndex?: number;
    params?: Record<string, unknown>;
    from?: string;
    to?: string;
    value?: string;
  };
  timestamp: string;
  subscriptionId: string;
}

// ---------------------------------------------------------------------------
// Event processing
// ---------------------------------------------------------------------------

/**
 * Process incoming CDP webhook events.
 * Updates the database based on the event type.
 */
async function processWebhookEvent(event: WebhookEvent): Promise<void> {
  const { eventType, data } = event;

  switch (eventType) {
    case 'onchain.activity.detected': {
      await handleOnchainActivity(data);
      break;
    }

    case 'wallet.transaction.created':
    case 'wallet.transaction.confirmed': {
      console.log(`${LOG_PREFIX} Wallet transaction event: ${eventType} | tx: ${data.transactionHash}`);
      break;
    }

    default: {
      console.log(`${LOG_PREFIX} Unhandled event type: ${eventType}`);
    }
  }
}

/**
 * Handle on-chain activity events (contract events, transfers).
 */
async function handleOnchainActivity(data: WebhookEvent['data']): Promise<void> {
  const eventName = data.eventName || data.params?.['eventName'];
  const txHash = data.transactionHash;

  if (!txHash) {
    console.warn(`${LOG_PREFIX} On-chain activity without txHash, skipping`);
    return;
  }

  // Log all events for observability
  console.log(`${LOG_PREFIX} On-chain activity: event=${eventName} contract=${data.contractAddress} tx=${txHash}`);

  switch (eventName) {
    case 'ChallengeCreated': {
      console.log(`${LOG_PREFIX} ChallengeCreated detected via webhook, tx: ${txHash}`);
      // The event indexer will pick this up and create the DB record.
      // Here we just log it for faster visibility.
      break;
    }

    case 'ChallengeResolved': {
      console.log(`${LOG_PREFIX} ChallengeResolved detected via webhook, tx: ${txHash}`);
      // Try to update challenge status immediately
      const cloneAddress = data.contractAddress?.toLowerCase();
      if (cloneAddress) {
        await prismaQuery.challenge.updateMany({
          where: { cloneAddress, status: 'Active' },
          data: { status: 'Resolved' },
        });
        console.log(`${LOG_PREFIX} Challenge ${cloneAddress} marked as Resolved via webhook`);
      }
      break;
    }

    case 'ChallengeExpired': {
      console.log(`${LOG_PREFIX} ChallengeExpired detected via webhook, tx: ${txHash}`);
      const cloneAddress = data.contractAddress?.toLowerCase();
      if (cloneAddress) {
        await prismaQuery.challenge.updateMany({
          where: { cloneAddress, status: 'Active' },
          data: { status: 'Expired' },
        });
        console.log(`${LOG_PREFIX} Challenge ${cloneAddress} marked as Expired via webhook`);
      }
      break;
    }

    case 'Transfer': {
      // USDC transfer events (ERC20)
      const from = (data.params?.['from'] as string || data.from || '').toLowerCase();
      const to = (data.params?.['to'] as string || data.to || '').toLowerCase();
      const value = data.params?.['value'] as string || data.value || '0';

      console.log(`${LOG_PREFIX} Transfer: ${from} -> ${to} | value: ${value} | tx: ${txHash}`);

      // If transfer is to a known challenge address, update prize pool
      if (to) {
        const challenge = await prismaQuery.challenge.findFirst({
          where: { cloneAddress: to, status: 'Active' },
          select: { id: true, prizePool: true },
        });

        if (challenge) {
          try {
            await prismaQuery.challenge.update({
              where: { id: challenge.id },
              data: {
                prizePool: { increment: BigInt(value) },
              },
            });
            console.log(`${LOG_PREFIX} Updated prize pool for challenge ${challenge.id}`);
          } catch (err) {
            console.error(`${LOG_PREFIX} Failed to update prize pool:`, err);
          }
        }
      }
      break;
    }

    default: {
      console.log(`${LOG_PREFIX} Unhandled on-chain event: ${eventName}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const webhookRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {

  // ==========================================================================
  // POST /webhooks/cdp  (CDP webhook receiver)
  // ==========================================================================
  app.post('/cdp', {
    config: { rawBody: true },  // Enable raw body for this route
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // 1. Check webhook secret is configured
    if (!CDP_WEBHOOK_SECRET) {
      console.warn(`${LOG_PREFIX} Webhook received but CDP_WEBHOOK_SECRET not configured`);
      return reply.code(200).send({ success: true, message: 'Webhook acknowledged (unconfigured)' });
    }

    // 2. Verify signature using Svix
    const svixId = request.headers['svix-id'] as string;
    const svixTimestamp = request.headers['svix-timestamp'] as string;
    const svixSignature = request.headers['svix-signature'] as string;

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.warn(`${LOG_PREFIX} Missing Svix headers`);
      return handleError(reply, 401, 'Missing webhook signature headers', 'WEBHOOK_UNAUTHORIZED');
    }

    let payload: WebhookEvent;
    try {
      const wh = new Webhook(CDP_WEBHOOK_SECRET);
      // rawBody is the unparsed request body string needed for signature verification
      const rawBody = request.rawBody;
      if (!rawBody) {
        return handleError(reply, 400, 'Missing raw body for verification', 'WEBHOOK_BAD_REQUEST');
      }

      payload = wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as WebhookEvent;
    } catch (err) {
      console.warn(`${LOG_PREFIX} Signature verification failed:`, err);
      return handleError(reply, 401, 'Invalid webhook signature', 'WEBHOOK_UNAUTHORIZED');
    }

    // 3. Process the event
    console.log(`${LOG_PREFIX} Received event: ${payload.eventType} | tx: ${payload.data?.transactionHash || 'N/A'}`);

    try {
      await processWebhookEvent(payload);
    } catch (err) {
      // Log but still return 200 to prevent CDP from retrying
      console.error(`${LOG_PREFIX} Error processing event:`, err);
    }

    return reply.code(200).send({ success: true });
  });

  // ==========================================================================
  // GET /webhooks/health  (health check for webhook endpoint)
  // ==========================================================================
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send({
      success: true,
      data: {
        webhookConfigured: Boolean(CDP_WEBHOOK_SECRET),
        endpoint: '/webhooks/cdp',
      },
      error: null,
    });
  });

  done();
};
