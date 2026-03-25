/**
 * Coinbase Verified Account attestation checker.
 *
 * Queries the EAS GraphQL API on Base Sepolia to determine whether a wallet
 * holds a valid (non-revoked, non-expired) Coinbase Verified Account
 * attestation.  Results are cached in-memory with a 5-minute TTL so the
 * frontend can poll cheaply before submitting an on-chain transaction.
 */

import {
  EAS_GRAPHQL_URL,
  CB_VERIFIED_SCHEMA_UID,
  CB_ATTESTER_ADDRESS,
} from '../../config/main-config.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerificationResult {
  isVerified: boolean;
  attestationUid: string | null;
  attestedAt: number | null;
}

interface EasAttestation {
  id: string;
  recipient: string;
  attester: string;
  time: number;
  revoked: boolean;
  expirationTime: number;
}

interface EasGraphQLResponse {
  data?: {
    attestations: EasAttestation[];
  };
  errors?: Array<{ message: string }>;
}

// ---------------------------------------------------------------------------
// Cache (in-memory, per-process)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ERROR_CACHE_TTL_MS = 30 * 1000; // 30 seconds for error results

interface CacheEntry {
  result: VerificationResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

// ---------------------------------------------------------------------------
// GraphQL query
// ---------------------------------------------------------------------------

const VERIFICATION_QUERY = `
  query CheckCoinbaseVerification($recipient: String!) {
    attestations(
      take: 1
      where: {
        schemaId: { equals: "${CB_VERIFIED_SCHEMA_UID}" }
        attester: { equals: "${CB_ATTESTER_ADDRESS}" }
        recipient: { equals: $recipient }
        revoked: { equals: false }
      }
      orderBy: [{ time: desc }]
    ) {
      id
      recipient
      attester
      time
      revoked
      expirationTime
    }
  }
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether `walletAddress` holds a valid Coinbase Verified Account
 * attestation on Base Sepolia.
 *
 * The address is normalised to lowercase before querying so callers do not
 * need to worry about checksum casing.
 */
export async function checkCoinbaseVerification(
  walletAddress: string,
): Promise<VerificationResult> {
  const normalisedAddress = walletAddress.toLowerCase();

  // --- cache hit ---
  const cached = cache.get(normalisedAddress);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  // --- fetch from EAS GraphQL ---
  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    response = await fetch(EAS_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: VERIFICATION_QUERY,
        variables: { recipient: normalisedAddress },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown fetch error';
    console.error(`[CoinbaseVerification] Fetch failed: ${message}`);

    // Cache the negative result briefly so we do not hammer a down service
    const errorResult: VerificationResult = {
      isVerified: false,
      attestationUid: null,
      attestedAt: null,
    };
    cache.set(normalisedAddress, {
      result: errorResult,
      expiresAt: Date.now() + ERROR_CACHE_TTL_MS,
    });

    throw new Error(`EAS GraphQL request failed: ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '<unreadable>');
    console.error(
      `[CoinbaseVerification] EAS returned HTTP ${response.status}: ${body}`,
    );

    const errorResult: VerificationResult = {
      isVerified: false,
      attestationUid: null,
      attestedAt: null,
    };
    cache.set(normalisedAddress, {
      result: errorResult,
      expiresAt: Date.now() + ERROR_CACHE_TTL_MS,
    });

    throw new Error(`EAS GraphQL returned HTTP ${response.status}`);
  }

  // --- parse response ---
  let json: EasGraphQLResponse;
  try {
    json = (await response.json()) as EasGraphQLResponse;
  } catch {
    console.error('[CoinbaseVerification] Failed to parse EAS JSON response');
    throw new Error('Failed to parse EAS GraphQL response');
  }

  if (json.errors && json.errors.length > 0) {
    const gqlError = json.errors.map((e) => e.message).join('; ');
    console.error(`[CoinbaseVerification] GraphQL errors: ${gqlError}`);
    throw new Error(`EAS GraphQL errors: ${gqlError}`);
  }

  const attestations = json.data?.attestations ?? [];

  // --- evaluate the most recent attestation ---
  let result: VerificationResult;

  if (attestations.length === 0) {
    result = { isVerified: false, attestationUid: null, attestedAt: null };
  } else {
    const att = attestations[0];
    const now = Math.floor(Date.now() / 1000);
    const isExpired = att.expirationTime > 0 && att.expirationTime < now;

    result = {
      isVerified: !att.revoked && !isExpired,
      attestationUid: att.id,
      attestedAt: att.time,
    };
  }

  // --- cache and return ---
  cache.set(normalisedAddress, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return result;
}

/**
 * Manually clear the verification cache (useful for testing).
 */
export function clearVerificationCache(): void {
  cache.clear();
}
