/**
 * Farcaster Frames / MiniApp Routes
 *
 * Serves Frame metadata, OG images, and the MiniApp manifest for
 * BreakBase when shared on Warpcast and other Farcaster clients.
 *
 * Endpoints:
 *  - GET  /frames           Frame embed meta tags (HTML)
 *  - GET  /frames/og        Dynamic SVG Open Graph image
 *  - GET  /frames/manifest  MiniApp manifest JSON
 *  - POST /frames/webhook   Farcaster event webhook receiver
 */

import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { APP_URL, API_URL } from '../config/main-config.ts';
import { storeNotificationToken, removeNotificationTokens } from '../lib/farcaster/notificationService.ts';
import { parseWebhookEvent, verifyAppKeyWithNeynar } from '@farcaster/miniapp-node';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[Frames]';
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const BG_COLOR = '#0A0A0B';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the static SVG string used as the OG image.
 * No external dependencies; pure string template.
 */
function buildOgSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${BG_COLOR};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#111113;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)" />

  <!-- Accent bar -->
  <rect x="0" y="0" width="${OG_WIDTH}" height="4" fill="url(#accent)" />

  <!-- Shield icon -->
  <g transform="translate(100, 200)">
    <path d="M50 10 L90 30 L90 65 C90 90 70 110 50 120 C30 110 10 90 10 65 L10 30 Z"
          fill="none" stroke="#3B82F6" stroke-width="3" opacity="0.9" />
    <path d="M50 35 L40 55 L60 55 L55 50 L65 70 L35 70 L45 50 Z"
          fill="#3B82F6" opacity="0.7" />
  </g>

  <!-- BreakBase title -->
  <text x="220" y="260" font-family="system-ui, -apple-system, sans-serif"
        font-size="64" font-weight="700" fill="#FFFFFF">BreakBase</text>

  <!-- Tagline -->
  <text x="220" y="310" font-family="system-ui, -apple-system, sans-serif"
        font-size="24" fill="#9CA3AF">AI Adversarial Testing on Base</text>

  <!-- CTA -->
  <text x="100" y="440" font-family="system-ui, -apple-system, sans-serif"
        font-size="36" font-weight="600" fill="#F9FAFB">Break AI. Earn USDC.</text>

  <!-- Footer -->
  <text x="100" y="560" font-family="system-ui, -apple-system, sans-serif"
        font-size="18" fill="#6B7280">Powered by Base L2</text>
</svg>`;
}

/**
 * Build the Frame embed HTML page returned when the app URL is
 * shared on Farcaster.
 */
function buildFrameHtml(): string {
  const ogImageUrl = `${API_URL}/frames/og`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BreakBase</title>

  <!-- Open Graph -->
  <meta property="og:title" content="BreakBase" />
  <meta property="og:description" content="AI Adversarial Testing on Base" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${APP_URL}" />

  <!-- Farcaster Frame (vNext) -->
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${ogImageUrl}" />
  <meta property="fc:frame:button:1" content="Break an AI" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${APP_URL}" />
  <meta property="fc:frame:button:2" content="Leaderboard" />
  <meta property="fc:frame:button:2:action" content="link" />
  <meta property="fc:frame:button:2:target" content="${APP_URL}/leaderboard" />
</head>
<body></body>
</html>`;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const frameRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {

  // ==========================================================================
  // GET /frames   (Frame embed meta tags)
  // ==========================================================================
  app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .code(200)
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Cache-Control', 'public, max-age=300')
      .send(buildFrameHtml());
  });

  // ==========================================================================
  // GET /frames/og   (Dynamic SVG OG image)
  // ==========================================================================
  app.get('/og', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .code(200)
      .header('Content-Type', 'image/svg+xml')
      .header('Cache-Control', 'public, max-age=3600')
      .send(buildOgSvg());
  });

  // ==========================================================================
  // GET /frames/manifest   (Farcaster MiniApp manifest)
  // ==========================================================================
  app.get('/manifest', async (_request: FastifyRequest, reply: FastifyReply) => {
    const manifest = {
      name: 'BreakBase',
      description: 'AI Adversarial Testing Platform on Base L2',
      icon: `${API_URL}/frames/og`,
      homeUrl: APP_URL,
      splashImageUrl: `${API_URL}/frames/og`,
      splashBackgroundColor: BG_COLOR,
      webhookUrl: `${API_URL}/frames/webhook`,
    };

    return reply.code(200).send({
      success: true,
      data: manifest,
      error: null,
    });
  });

  // ==========================================================================
  // POST /frames/webhook   (Farcaster event receiver)
  //
  // Handles MiniApp lifecycle events from Farcaster clients.
  // Supports both legacy (frame_added/frame_removed) and new
  // (miniapp_added/miniapp_removed) event names.
  //
  // Signature verification via @farcaster/miniapp-node is active when
  // NEYNAR_API_KEY is configured. Falls back to unverified mode in dev.
  // ==========================================================================
  app.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body) {
      console.warn(`${LOG_PREFIX} Webhook received empty body`);
      return reply.code(200).send({ success: true, data: null, error: null });
    }

    let fid: number;
    let eventType: string;
    let notificationDetails: { url?: string; token?: string } | undefined;

    // Use cryptographic verification if NEYNAR_API_KEY is available
    if (process.env.NEYNAR_API_KEY) {
      try {
        const data = await parseWebhookEvent(body, verifyAppKeyWithNeynar);
        fid = data.fid;
        eventType = data.event.event;
        notificationDetails = (data.event as any).notificationDetails;
        console.log(`${LOG_PREFIX} Verified webhook event="${eventType}" fid=${fid}`);
      } catch (e: any) {
        const errorType = e?.name || 'UnknownError';
        if (errorType === 'VerifyAppKeyError') {
          console.error(`${LOG_PREFIX} Webhook verification service error, retryable:`, e);
          return reply.code(500).send({ success: false, data: null, error: { code: 'WEBHOOK_VERIFY_FAILED', message: 'Verification service error' } });
        }
        console.warn(`${LOG_PREFIX} Webhook verification failed (${errorType}):`, e?.message);
        return reply.code(401).send({ success: false, data: null, error: { code: 'WEBHOOK_INVALID', message: 'Invalid webhook signature' } });
      }
    } else {
      // Fallback: unverified (development mode)
      console.warn(`${LOG_PREFIX} NEYNAR_API_KEY not set, accepting webhook without verification`);
      eventType = (body.event ?? body.type ?? 'unknown') as string;
      fid = typeof body.fid === 'number' ? body.fid : 0;
      notificationDetails = body.notificationDetails as { url?: string; token?: string } | undefined;
      if (fid === 0) {
        console.warn(`${LOG_PREFIX} Webhook missing fid, skipping`);
        return reply.code(200).send({ success: true, data: null, error: null });
      }
    }

    try {
      switch (eventType) {
        case 'frame_added':
        case 'miniapp_added': {
          if (notificationDetails?.token && notificationDetails?.url) {
            await storeNotificationToken(fid, notificationDetails.token, notificationDetails.url);
            console.log(`${LOG_PREFIX} Stored notification token for fid=${fid}`);
          }
          break;
        }
        case 'frame_removed':
        case 'miniapp_removed': {
          await removeNotificationTokens(fid);
          console.log(`${LOG_PREFIX} Removed all notification tokens for fid=${fid}`);
          break;
        }
        case 'notifications_enabled': {
          if (notificationDetails?.token && notificationDetails?.url) {
            await storeNotificationToken(fid, notificationDetails.token, notificationDetails.url);
            console.log(`${LOG_PREFIX} Notifications enabled for fid=${fid}`);
          }
          break;
        }
        case 'notifications_disabled': {
          await removeNotificationTokens(fid);
          console.log(`${LOG_PREFIX} Notifications disabled for fid=${fid}`);
          break;
        }
        default: {
          console.log(`${LOG_PREFIX} Unhandled event type: ${eventType}`);
        }
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Webhook handler error for event="${eventType}" fid=${fid}:`, error);
    }

    return reply.code(200).send({ success: true, data: null, error: null });
  });

  done();
};
