/**
 * x402 Payment Middleware for Fastify
 *
 * Provides a reusable preHandler hook that gates Fastify routes behind x402
 * micropayments. The middleware:
 *  1. Wraps the Fastify request into the framework-agnostic HTTPAdapter
 *  2. Delegates to x402HTTPResourceServer.processHTTPRequest() for payment
 *     header parsing, verification, and 402 response generation
 *  3. On successful verification, continues to the route handler
 *  4. After the route handler responds, the companion onSend hook settles
 *     the payment via the facilitator and attaches settlement proof headers
 *
 * Usage:
 *   import { createX402PreHandler, registerX402SettlementHook } from '../middlewares/x402Middleware.ts';
 *
 *   // In your route plugin:
 *   registerX402SettlementHook(app);
 *
 *   const x402Gate = createX402PreHandler({
 *     payTo: '0xYourAddress',
 *     priceUsd: '$0.01',
 *     network: 'eip155:84532',
 *     description: 'Premium endpoint',
 *   });
 *
 *   app.get('/premium', { preHandler: [x402Gate] }, handler);
 */

import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  preHandlerHookHandler,
} from 'fastify';
import type { HTTPAdapter, RoutesConfig } from '@x402/core/http';
import type { Network } from '@x402/core/types';
import type { x402HTTPResourceServer } from '@x402/core/http';
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import {
  createX402HTTPServer,
  ensureInitialized,
  NETWORK as DEFAULT_NETWORK,
} from '../lib/x402/x402Service.ts';
import { handleError } from '../utils/errorHandler.ts';

// ---------------------------------------------------------------------------
// Module augmentation: attach x402 context to FastifyRequest
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyRequest {
    x402Context?: {
      httpServer: x402HTTPResourceServer;
      paymentPayload: PaymentPayload;
      paymentRequirements: PaymentRequirements;
      declaredExtensions?: Record<string, unknown>;
    };
  }
}

// ---------------------------------------------------------------------------
// HTTPAdapter: bridges Fastify request to x402's framework-agnostic interface
// ---------------------------------------------------------------------------

function createFastifyAdapter(request: FastifyRequest): HTTPAdapter {
  return {
    getHeader(name: string): string | undefined {
      const val = request.headers[name.toLowerCase()];
      if (Array.isArray(val)) return val[0];
      return val ?? undefined;
    },
    getMethod(): string {
      return request.method;
    },
    getPath(): string {
      const url = request.url;
      const qIdx = url.indexOf('?');
      return qIdx >= 0 ? url.slice(0, qIdx) : url;
    },
    getUrl(): string {
      const proto = request.protocol ?? 'http';
      const host = request.hostname ?? 'localhost';
      return `${proto}://${host}${request.url}`;
    },
    getAcceptHeader(): string {
      return (request.headers.accept as string) ?? '*/*';
    },
    getUserAgent(): string {
      return (request.headers['user-agent'] as string) ?? '';
    },
    getQueryParams(): Record<string, string | string[]> {
      const query = request.query as Record<string, string | string[] | undefined>;
      const result: Record<string, string | string[]> = {};
      for (const [key, val] of Object.entries(query)) {
        if (val !== undefined) result[key] = val;
      }
      return result;
    },
    getQueryParam(name: string): string | string[] | undefined {
      return (request.query as Record<string, string | string[] | undefined>)[name];
    },
    getBody(): unknown {
      return request.body;
    },
  };
}

// ---------------------------------------------------------------------------
// Configuration for a payment-gated route
// ---------------------------------------------------------------------------

export interface X402GateConfig {
  /** Wallet address that receives payments */
  payTo: string;
  /** Price in USD string format, e.g. "$0.01" or "0.01" */
  priceUsd: string;
  /** CAIP-2 network identifier. Defaults to Base Sepolia (eip155:84532) */
  network?: Network;
  /** Human-readable description of what the payment buys */
  description?: string;
  /** MIME type of the response. Defaults to "application/json" */
  mimeType?: string;
  /** x402 extension metadata (e.g. Bazaar discovery) */
  extensions?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Settlement hook (registered once per Fastify plugin scope)
// ---------------------------------------------------------------------------

/**
 * Registers an onSend hook on the Fastify instance that settles verified
 * x402 payments after the route handler has produced a successful response.
 *
 * Call this once in every Fastify plugin scope that uses x402 preHandlers.
 * The hook is a no-op for requests without x402 context.
 */
export function registerX402SettlementHook(app: FastifyInstance): void {
  app.addHook(
    'onSend',
    async (request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
      const ctx = request.x402Context;
      if (!ctx) return payload;

      // Only settle on successful responses (2xx)
      const statusCode = reply.statusCode;
      if (statusCode < 200 || statusCode >= 300) {
        return payload;
      }

      try {
        const settleResult = await ctx.httpServer.processSettlement(
          ctx.paymentPayload,
          ctx.paymentRequirements,
          ctx.declaredExtensions,
        );

        if (settleResult.success) {
          for (const [key, value] of Object.entries(settleResult.headers)) {
            reply.header(key, value);
          }
        } else {
          // Settlement failed. Log but still return the response.
          // The payment was verified, so the client already authorized it.
          console.error(
            '[x402] Settlement failed after successful verification:',
            settleResult.errorReason,
            settleResult.errorMessage,
          );
        }
      } catch (settleErr) {
        console.error('[x402] Settlement error:', settleErr);
        // Do not fail the response due to settlement issues.
        // The payment was verified; settlement can be retried.
      }

      // Ensure CORS exposes payment response headers
      reply.header(
        'access-control-expose-headers',
        'payment-required, payment-response, x-payment-response',
      );

      return payload;
    },
  );
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Creates a Fastify preHandler that enforces x402 payment for the decorated route.
 *
 * The returned hook builds a single-route x402HTTPResourceServer with a
 * wildcard pattern so every request through the preHandler is treated as
 * protected. Fastify's own router handles route matching; the x402 layer
 * only needs to know payment terms.
 */
export function createX402PreHandler(config: X402GateConfig): preHandlerHookHandler {
  // Input validation at construction time
  if (!config.payTo || !/^0x[a-fA-F0-9]{40}$/.test(config.payTo)) {
    throw new Error('[x402] Invalid payTo address in middleware config');
  }

  if (!config.priceUsd) {
    throw new Error('[x402] priceUsd is required in middleware config');
  }

  const network: Network = config.network ?? DEFAULT_NETWORK;

  // Build a routes config with a wildcard pattern that matches any method/path.
  // Since this preHandler only runs on the specific Fastify route it's attached
  // to, the wildcard is safe and avoids path-mismatch issues with parameterized
  // Fastify routes (e.g. /x402/challenge-insights/:id).
  const routesConfig: RoutesConfig = {
    '* /*': {
      accepts: {
        scheme: 'exact',
        network,
        payTo: config.payTo,
        price: config.priceUsd,
      },
      description: config.description ?? 'x402 payment-gated resource',
      mimeType: config.mimeType ?? 'application/json',
      ...(config.extensions ? { extensions: config.extensions } : {}),
    },
  };

  const httpServer = createX402HTTPServer(routesConfig);
  let httpServerInitialized = false;

  return async function x402PreHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // Ensure the resource server has fetched facilitator capabilities
    try {
      await ensureInitialized();
    } catch (initErr) {
      console.error('[x402] Failed to initialize resource server:', initErr);
      await handleError(
        reply,
        503,
        'Payment service temporarily unavailable',
        'X402_INIT_FAILED',
        initErr instanceof Error ? initErr : null,
      );
      return;
    }

    // Initialize the HTTP server once (validates route config against facilitator)
    if (!httpServerInitialized) {
      try {
        await httpServer.initialize();
        httpServerInitialized = true;
      } catch (initErr) {
        console.error('[x402] Failed to initialize HTTP server:', initErr);
        await handleError(
          reply,
          503,
          'Payment service configuration error',
          'X402_CONFIG_ERROR',
          initErr instanceof Error ? initErr : null,
        );
        return;
      }
    }

    const adapter = createFastifyAdapter(request);

    const requestContext = {
      adapter,
      path: adapter.getPath(),
      method: adapter.getMethod(),
      paymentHeader:
        adapter.getHeader('payment-signature') ??
        adapter.getHeader('x-payment'),
    };

    // Process the HTTP request through x402
    let result;
    try {
      result = await httpServer.processHTTPRequest(requestContext);
    } catch (err) {
      console.error('[x402] Error processing payment request:', err);
      await handleError(
        reply,
        500,
        'Payment processing failed',
        'X402_PROCESS_ERROR',
        err instanceof Error ? err : null,
      );
      return;
    }

    switch (result.type) {
      case 'no-payment-required':
        // Route doesn't require payment (should not happen with our config, but safe)
        return;

      case 'payment-error': {
        // Missing or invalid payment. Return the 402 (or other status) with
        // the headers/body the x402 SDK constructed.
        const resp = result.response;
        for (const [key, value] of Object.entries(resp.headers)) {
          reply.header(key, value);
        }

        // Ensure CORS exposes the payment headers
        reply.header(
          'access-control-expose-headers',
          'payment-required, payment-response, x-payment-response',
        );

        if (resp.isHtml) {
          reply.header('content-type', 'text/html; charset=utf-8');
        }

        reply.code(resp.status).send(resp.body ?? {});
        return;
      }

      case 'payment-verified': {
        // Payment verified. Attach context for the settlement onSend hook.
        request.x402Context = {
          httpServer,
          paymentPayload: result.paymentPayload,
          paymentRequirements: result.paymentRequirements,
          declaredExtensions: result.declaredExtensions,
        };

        // Continue to route handler
        return;
      }

      default: {
        console.error('[x402] Unknown process result type:', result);
        await handleError(
          reply,
          500,
          'Unexpected payment processing result',
          'X402_UNKNOWN_RESULT',
        );
        return;
      }
    }
  };
}
