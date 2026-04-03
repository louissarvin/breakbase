import {
  createPublicClient,
  http,
  isAddress,
  type Address,
} from 'viem';
import { base } from 'viem/chains';
import { namehash, normalize } from 'viem/ens';

// ---------------------------------------------------------------------------
// L2Resolver contract details (Base Mainnet)
// Basenames are always registered on Base Mainnet (chain 8453), regardless
// of which network the rest of the application targets.
// ---------------------------------------------------------------------------

const L2_RESOLVER_ADDRESS = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD';
const BASE_MAINNET_CHAIN_ID = 8453;

const L2_RESOLVER_ABI = [
  {
    inputs: [{ name: 'node', type: 'bytes32' }],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'node', type: 'bytes32' }],
    name: 'addr',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
    ],
    name: 'text',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ---------------------------------------------------------------------------
// Viem public client (singleton)
// ---------------------------------------------------------------------------

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

// ---------------------------------------------------------------------------
// In-memory cache with TTL
// ---------------------------------------------------------------------------

interface CacheEntry {
  value: string | null;
  expiresAt: number;
}

const reverseCache = new Map<string, CacheEntry>();
const forwardCache = new Map<string, CacheEntry>();
const textRecordCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached(cache: Map<string, CacheEntry>, key: string): { hit: boolean; value: string | null } {
  const entry = cache.get(key);
  if (!entry) return { hit: false, value: null };
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return { hit: false, value: null };
  }
  return { hit: true, value: entry.value };
}

function setCache(cache: Map<string, CacheEntry>, key: string, value: string | null): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// ENSIP-19 reverse node computation
// ---------------------------------------------------------------------------

function computeReverseNode(address: Address, chainId: number): `0x${string}` {
  const addressFormatted = address.toLowerCase().slice(2); // remove 0x prefix
  const coinTypeHex = (0x80000000 | chainId).toString(16);
  return namehash(`${addressFormatted}.${coinTypeHex}.reverse`);
}

// ---------------------------------------------------------------------------
// Reverse resolution: 0x address -> basename
// ---------------------------------------------------------------------------

export async function resolveAddressToBasename(address: string): Promise<string | null> {
  if (!isAddress(address)) {
    console.error('[Basenames] Invalid address provided for reverse resolution:', address);
    return null;
  }

  const cacheKey = address.toLowerCase();
  const cached = getCached(reverseCache, cacheKey);
  if (cached.hit) {
    return cached.value;
  }

  try {
    const reverseNode = computeReverseNode(address as Address, BASE_MAINNET_CHAIN_ID);

    const name = await publicClient.readContract({
      address: L2_RESOLVER_ADDRESS as Address,
      abi: L2_RESOLVER_ABI,
      functionName: 'name',
      args: [reverseNode],
    });

    // Resolver returns empty string for unregistered addresses
    const result = name && name.length > 0 ? name : null;
    setCache(reverseCache, cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Basenames] Reverse resolution failed for', address, error);
    // Cache the failure to avoid hammering the RPC on repeated requests
    setCache(reverseCache, cacheKey, null);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Forward resolution: basename -> 0x address
// ---------------------------------------------------------------------------

export async function resolveBasenameToAddress(name: string): Promise<string | null> {
  let normalizedName: string;
  try {
    normalizedName = normalize(name);
  } catch {
    console.error('[Basenames] Invalid name for forward resolution:', name);
    return null;
  }

  const cacheKey = normalizedName.toLowerCase();
  const cached = getCached(forwardCache, cacheKey);
  if (cached.hit) {
    return cached.value;
  }

  try {
    const node = namehash(normalizedName);

    const addr = await publicClient.readContract({
      address: L2_RESOLVER_ADDRESS as Address,
      abi: L2_RESOLVER_ABI,
      functionName: 'addr',
      args: [node],
    });

    // Zero address means unregistered
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    const result = addr && addr !== zeroAddress ? addr : null;
    setCache(forwardCache, cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Basenames] Forward resolution failed for', name, error);
    setCache(forwardCache, cacheKey, null);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Batch resolution: multiple addresses -> Map<address, basename | null>
// Uses Promise.allSettled so one failure does not break the batch
// ---------------------------------------------------------------------------

const MAX_BATCH_SIZE = 50;

export async function batchResolveAddresses(
  addresses: string[]
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  if (!addresses || addresses.length === 0) {
    return results;
  }

  // Enforce max batch size
  const batch = addresses.slice(0, MAX_BATCH_SIZE);

  // Deduplicate to avoid redundant RPC calls
  const unique = [...new Set(batch.map((a) => a.toLowerCase()))];

  const settled = await Promise.allSettled(
    unique.map(async (addr) => {
      const basename = await resolveAddressToBasename(addr);
      return { addr, basename };
    })
  );

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results.set(result.value.addr, result.value.basename);
    } else {
      // This branch handles unexpected rejections that escape the try/catch
      // inside resolveAddressToBasename. Log and mark as null.
      console.error('[Basenames] Unexpected batch resolution failure:', result.reason);
    }
  }

  // Fill in any addresses from the original batch that were deduplicated
  for (const addr of batch) {
    const key = addr.toLowerCase();
    if (!results.has(key)) {
      results.set(key, null);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Text record resolution: basename + key -> text value
// ---------------------------------------------------------------------------

/** Standard text record keys supported by Basenames (ENSIP-5 / EIP-634) */
export const TEXT_RECORD_KEYS = [
  'avatar',
  'description',
  'url',
  'com.twitter',
  'com.github',
  'org.telegram',
  'com.discord',
  'display',
] as const;

export type TextRecordKey = typeof TEXT_RECORD_KEYS[number] | string;

export async function resolveTextRecord(name: string, key: string): Promise<string | null> {
  let normalizedName: string;
  try {
    normalizedName = normalize(name);
  } catch {
    console.error('[Basenames] Invalid name for text record resolution:', name);
    return null;
  }

  const cacheKey = `${normalizedName.toLowerCase()}:${key}`;
  const cached = getCached(textRecordCache, cacheKey);
  if (cached.hit) {
    return cached.value;
  }

  try {
    const node = namehash(normalizedName);

    const value = await publicClient.readContract({
      address: L2_RESOLVER_ADDRESS as Address,
      abi: L2_RESOLVER_ABI,
      functionName: 'text',
      args: [node, key],
    });

    const result = value && value.length > 0 ? value : null;
    setCache(textRecordCache, cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Basenames] Text record resolution failed for', name, key, error);
    setCache(textRecordCache, cacheKey, null);
    return null;
  }
}

/**
 * Resolve multiple text records for a basename at once.
 * Returns a map of key -> value (null if not set).
 */
export async function resolveTextRecords(
  name: string,
  keys: string[] = TEXT_RECORD_KEYS as unknown as string[],
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};

  const settled = await Promise.allSettled(
    keys.map(async (key) => {
      const value = await resolveTextRecord(name, key);
      return { key, value };
    })
  );

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results[result.value.key] = result.value.value;
    } else {
      // Promise.allSettled rejected entries do not carry the key on the
      // result object, so we cannot map them back. This path is defensive
      // since resolveTextRecord already catches internally.
    }
  }

  return results;
}
