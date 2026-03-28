/**
 * CDP On-chain SQL Analytics Service
 *
 * Uses the CDP SDK to query indexed Base blockchain data via SQL.
 * Requires CDP API credentials (CDP_API_KEY_ID, CDP_API_KEY_SECRET).
 *
 * SECURITY: This module only exposes pre-built query helpers with validated
 * parameters. It does NOT accept arbitrary SQL from callers to prevent
 * SQL injection against the CDP SQL API.
 */

import { CHALLENGE_FACTORY_ADDRESS, CHAIN_ID } from '../../config/main-config.ts';
import { isConfigured, getCdpClient } from './walletService.ts';

const LOG_PREFIX = '[CDPSql]';

// The network prefix for SQL table names (per CDP SQL API docs)
const NETWORK_PREFIX = CHAIN_ID === 8453 ? 'base' : 'base_sepolia';

/**
 * Result shape returned by the CDP SQL API.
 * Defined locally to avoid importing from a non-exported subpath of the SDK.
 */
export interface SqlQueryResult {
  result?: Record<string, unknown>[];
  schema?: {
    columns?: Array<{ name?: string; type?: string }>;
  };
  metadata?: {
    cached?: boolean;
    executionTimestamp?: string;
    executionDurationMs?: number;
  };
}

/**
 * Lazily loaded reference to the SDK's runSQLQuery function.
 * The CDP SDK does not export the sql-api subpath in its package.json exports
 * map, so we use a dynamic import with the internal path (Bun resolves this).
 */
let _runSQLQuery: ((query: { sql: string; cache?: { maxAgeMs?: number } }) => Promise<SqlQueryResult>) | null = null;

async function getRunSQLQuery() {
  if (_runSQLQuery) return _runSQLQuery;

  // Dynamic import from the SDK's internal ESM output.
  // The CDP SDK does not list this subpath in its package.json "exports" map,
  // but Bun resolves it correctly at runtime. TS error is expected.
  // @ts-expect-error: subpath not in CDP SDK exports map; Bun resolves at runtime
  const mod = await import('@coinbase/cdp-sdk/openapi-client/generated/sql-api/sql-api.js');
  _runSQLQuery = mod.runSQLQuery as typeof _runSQLQuery;
  return _runSQLQuery!;
}

/**
 * Ensure the CDP client is initialized (which configures the shared
 * OpenAPI axios instance), then execute a read-only SQL query.
 *
 * Returns null if CDP is not configured or the query fails.
 */
export async function queryOnchainData(
  sql: string,
  cacheMs: number = 5000,
): Promise<SqlQueryResult | null> {
  try {
    if (!isConfigured()) {
      console.warn(`${LOG_PREFIX} CDP is not configured, skipping SQL query`);
      return null;
    }

    // Ensure the CdpClient singleton is initialized, which calls
    // CdpOpenApiClient.configure() and sets up auth on the shared axios instance.
    getCdpClient();

    const runSQL = await getRunSQLQuery();

    // Clamp cache to the API's allowed range (500ms to 900000ms)
    const clampedCache = Math.max(500, Math.min(cacheMs, 900000));

    const response = await runSQL({
      sql,
      cache: { maxAgeMs: clampedCache },
    });

    return response;
  } catch (error) {
    console.error(`${LOG_PREFIX} Query failed:`, error);
    return null;
  }
}

/**
 * Get the SQL table prefix for the current network.
 */
export function getNetworkPrefix(): string {
  return NETWORK_PREFIX;
}

// ---------------------------------------------------------------------------
// Pre-built query helpers
//
// These are the ONLY queries exposed to the route layer. No arbitrary SQL
// is accepted from external callers.
// ---------------------------------------------------------------------------

/**
 * Query recent ChallengeCreated events from the factory contract.
 *
 * @param limit - Number of events to return (clamped to 1..100)
 */
export async function queryRecentChallenges(limit: number = 20): Promise<SqlQueryResult | null> {
  const factoryAddress = CHALLENGE_FACTORY_ADDRESS?.toLowerCase();
  if (!factoryAddress) {
    console.warn(`${LOG_PREFIX} CHALLENGE_FACTORY_ADDRESS not set, cannot query challenges`);
    return null;
  }

  const safeLimit = Math.max(1, Math.min(limit, 100));

  const sql = `
    SELECT block_number, block_timestamp, transaction_hash, parameters
    FROM ${NETWORK_PREFIX}.events
    WHERE address = '${factoryAddress}'
      AND event_name = 'ChallengeCreated'
    ORDER BY block_number DESC
    LIMIT ${safeLimit}
  `;

  return queryOnchainData(sql, 15000);
}

/**
 * Query USDC transfer volume to/from a specific contract address.
 *
 * @param contractAddress - 0x-prefixed EVM address (validated by caller)
 * @param days - Number of days to look back (clamped to 1..90)
 */
export async function queryUsdcVolume(
  contractAddress: string,
  days: number = 30,
): Promise<SqlQueryResult | null> {
  const addr = contractAddress.toLowerCase();
  const safeDays = Math.max(1, Math.min(days, 90));

  // Base Sepolia USDC contract
  const usdcAddress = '0x036cbd53842c5426634e7929541ec2318f3dcf7e';

  const sql = `
    SELECT
      toDate(block_timestamp) AS day,
      count() AS transfer_count,
      sum(CAST(value AS UInt256)) AS total_value
    FROM ${NETWORK_PREFIX}.events
    WHERE address = '${usdcAddress}'
      AND event_name = 'Transfer'
      AND (
        parameters LIKE '%${addr}%'
      )
      AND block_timestamp >= now() - INTERVAL ${safeDays} DAY
    GROUP BY day
    ORDER BY day DESC
    LIMIT ${safeDays}
  `;

  return queryOnchainData(sql, 30000);
}

/**
 * Query transaction count and gas usage for a contract address.
 *
 * @param contractAddress - 0x-prefixed EVM address (validated by caller)
 * @param days - Number of days to look back (clamped to 1..90)
 */
export async function queryContractActivity(
  contractAddress: string,
  days: number = 30,
): Promise<SqlQueryResult | null> {
  const addr = contractAddress.toLowerCase();
  const safeDays = Math.max(1, Math.min(days, 90));

  const sql = `
    SELECT
      toDate(block_timestamp) AS day,
      count() AS tx_count,
      sum(gas_used) AS total_gas
    FROM ${NETWORK_PREFIX}.transactions
    WHERE to_address = '${addr}'
      AND block_timestamp >= now() - INTERVAL ${safeDays} DAY
    GROUP BY day
    ORDER BY day DESC
    LIMIT ${safeDays}
  `;

  return queryOnchainData(sql, 30000);
}
