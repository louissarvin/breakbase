/**
 * x402 Payment Protocol Service
 *
 * Initializes the x402 resource server and HTTP server for payment-gated endpoints.
 * Uses the public x402 facilitator for payment verification and settlement on Base Sepolia.
 *
 * References:
 *  - @x402/core v2.9.0 type declarations
 *  - @x402/evm v2.9.0 exact scheme server
 */

import { HTTPFacilitatorClient, x402ResourceServer } from '@x402/core/server';
import { x402HTTPResourceServer } from '@x402/core/http';
import type { RoutesConfig } from '@x402/core/http';
import { registerExactEvmScheme } from '@x402/evm/exact/server';
import { X402_FACILITATOR_URL } from '../../config/main-config.ts';

const NETWORK = 'eip155:84532' as const; // Base Sepolia (CAIP-2)
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// ---------------------------------------------------------------------------
// Facilitator client (communicates with public x402 facilitator for verify/settle)
// ---------------------------------------------------------------------------
const facilitatorClient = new HTTPFacilitatorClient({
  url: X402_FACILITATOR_URL,
});

// ---------------------------------------------------------------------------
// Core resource server (transport-agnostic payment protocol engine)
// ---------------------------------------------------------------------------
const resourceServer = new x402ResourceServer(facilitatorClient);

// Register the EVM "exact" scheme so the server can parse prices and build
// payment requirements for any eip155:* network.
registerExactEvmScheme(resourceServer);

// ---------------------------------------------------------------------------
// Initialization flag. The resource server must call initialize() once to
// fetch supported kinds from the facilitator. We lazily initialize on the
// first request rather than at import time so the server can start even if
// the facilitator is temporarily unreachable.
// ---------------------------------------------------------------------------
let initialized = false;
let initializePromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  // Deduplicate concurrent initialization attempts
  if (!initializePromise) {
    initializePromise = resourceServer
      .initialize()
      .then(() => {
        initialized = true;
        console.log('[x402] Resource server initialized successfully');
      })
      .catch((err) => {
        // Reset so next request retries
        initializePromise = null;
        throw err;
      });
  }

  return initializePromise;
}

// ---------------------------------------------------------------------------
// Factory: create an x402HTTPResourceServer for a given routes config
// ---------------------------------------------------------------------------

/**
 * Creates a new x402HTTPResourceServer bound to the shared resource server
 * and the provided routes configuration. The caller is responsible for calling
 * `ensureInitialized()` before using the returned instance.
 */
function createX402HTTPServer(routes: RoutesConfig): x402HTTPResourceServer {
  return new x402HTTPResourceServer(resourceServer, routes);
}

export {
  NETWORK,
  USDC_BASE_SEPOLIA,
  facilitatorClient,
  resourceServer,
  createX402HTTPServer,
  ensureInitialized,
};
