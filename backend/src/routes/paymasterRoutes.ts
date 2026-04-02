import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { handleError, handleServerError } from '../utils/errorHandler.ts';
import { CDP_PAYMASTER_URL } from '../config/main-config.ts';

// ---------------------------------------------------------------------------
// JSON-RPC method allowlist (only these are forwarded to CDP)
// ---------------------------------------------------------------------------

const ALLOWED_METHODS = new Set([
  // Paymaster methods
  'pm_getPaymasterStubData',
  'pm_getPaymasterData',
  'pm_sponsorUserOperation',
  'pm_getAcceptedPaymentTokens',
  'pm_getAddressSponsorshipInfo',
  // Bundler methods
  'eth_sendUserOperation',
  'eth_estimateUserOperationGas',
  'eth_getUserOperationByHash',
  'eth_getUserOperationReceipt',
  'eth_supportedEntryPoints',
  // Standard RPC (read-only, needed for smart wallet flows)
  'eth_chainId',
  'eth_getBalance',
  'eth_call',
  'eth_getTransactionCount',
  'eth_getCode',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_estimateGas',
  'eth_maxPriorityFeePerGas',
  'eth_getTransactionReceipt',
]);

// ---------------------------------------------------------------------------
// JSON-RPC types
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: string;
  id: unknown;
  method: string;
  params?: unknown[];
}

interface JsonRpcError {
  jsonrpc: string;
  id: unknown;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/** Build a JSON-RPC error response. */
function jsonRpcError(id: unknown, code: number, message: string): JsonRpcError {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message },
  };
}

// ---------------------------------------------------------------------------
// Request body validation
// ---------------------------------------------------------------------------

/** Validate that the body looks like a valid JSON-RPC 2.0 request. */
function validateJsonRpcBody(body: unknown): { valid: true; rpc: JsonRpcRequest } | { valid: false; reason: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, reason: 'Request body must be a JSON object' };
  }

  const rpc = body as Record<string, unknown>;

  if (rpc.jsonrpc !== '2.0') {
    return { valid: false, reason: 'jsonrpc field must be "2.0"' };
  }

  if (rpc.id === undefined) {
    return { valid: false, reason: 'id field is required' };
  }

  if (typeof rpc.method !== 'string' || rpc.method.length === 0) {
    return { valid: false, reason: 'method field must be a non-empty string' };
  }

  if (rpc.params !== undefined && !Array.isArray(rpc.params)) {
    return { valid: false, reason: 'params field must be an array when present' };
  }

  return {
    valid: true,
    rpc: {
      jsonrpc: rpc.jsonrpc as string,
      id: rpc.id,
      method: rpc.method as string,
      params: rpc.params as unknown[] | undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// CDP fetch timeout (15 seconds)
// ---------------------------------------------------------------------------

const CDP_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const paymasterRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {

  // POST /paymaster
  // Authenticated proxy that forwards JSON-RPC requests to CDP Paymaster/Bundler RPC
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user?.id ?? 'anonymous';

    // ---- Gate: paymaster must be configured ----
    if (!CDP_PAYMASTER_URL) {
      console.error('[Paymaster] CDP_PAYMASTER_URL is not configured');
      return reply.code(503).send(
        jsonRpcError(null, -32603, 'Paymaster is not configured on this server'),
      );
    }

    // ---- Validate JSON-RPC body ----
    const validation = validateJsonRpcBody(request.body);
    if (!validation.valid) {
      return reply.code(400).send(
        jsonRpcError(null, -32600, validation.reason),
      );
    }

    const { rpc } = validation;

    // ---- Check method allowlist ----
    if (!ALLOWED_METHODS.has(rpc.method)) {
      console.warn(`[Paymaster] Blocked method=${rpc.method}, user=${userId}`);
      return reply.code(403).send(
        jsonRpcError(rpc.id, -32601, `Method not allowed: ${rpc.method}`),
      );
    }

    // ---- Audit log ----
    console.log(`[Paymaster] method=${rpc.method}, user=${userId}`);

    // ---- Forward to CDP ----
    const forwardBody = JSON.stringify({
      jsonrpc: rpc.jsonrpc,
      id: rpc.id,
      method: rpc.method,
      params: rpc.params ?? [],
    });

    let cdpResponse: Response;
    try {
      cdpResponse = await fetch(CDP_PAYMASTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: forwardBody,
        signal: AbortSignal.timeout(CDP_TIMEOUT_MS),
      });
    } catch (error) {
      const err = error as Error;
      // Distinguish between timeout and other network failures
      const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
      const message = isTimeout
        ? 'CDP RPC request timed out'
        : 'Failed to reach CDP RPC endpoint';

      console.error(`[Paymaster] CDP fetch failed: method=${rpc.method}, user=${userId}, error=${err.message}`);
      return reply.code(502).send(
        jsonRpcError(rpc.id, -32603, message),
      );
    }

    // ---- Forward CDP response ----
    let responseBody: unknown;
    try {
      responseBody = await cdpResponse.json();
    } catch {
      console.error(`[Paymaster] CDP returned non-JSON: status=${cdpResponse.status}, method=${rpc.method}, user=${userId}`);
      return reply.code(502).send(
        jsonRpcError(rpc.id, -32603, 'CDP RPC returned an invalid response'),
      );
    }

    // Return the raw JSON-RPC response from CDP (not wrapped in our API format).
    // Preserve CDP's HTTP status for transparency.
    return reply
      .code(cdpResponse.ok ? 200 : cdpResponse.status)
      .header('content-type', 'application/json')
      .send(responseBody);
  });

  done();
};
