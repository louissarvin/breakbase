/**
 * CDP Wallet Policy Service
 *
 * Creates and manages security policies for the BreakBase agent wallet.
 * Policies restrict what transactions the agent can execute (address allowlists,
 * amount caps, network locks).
 *
 * NOTE: createPolicy uses a direct REST call with a signed JWT instead of the
 * SDK's `cdp.policies.createPolicy()` because the SDK v1.47 bundles Zod v3
 * but `abitype/zod` resolves to the project's Zod v4, causing
 * `_parseSync is not a function` during validation.  The JWT auth helper IS
 * a public export (`@coinbase/cdp-sdk/auth`), so this approach avoids
 * reaching into internal/unexported subpaths.
 */

import { getCdpClient, isConfigured } from './walletService.ts';
import type { CdpClient } from '@coinbase/cdp-sdk';
import { generateJwt } from '@coinbase/cdp-sdk/auth';
import {
  USDC_ADDRESS,
  CHALLENGE_FACTORY_ADDRESS,
  FEE_DISTRIBUTOR_ADDRESS,
  REPUTATION_ORACLE_ADDRESS,
  CHAIN_ID,
  CDP_API_KEY_ID,
  CDP_API_KEY_SECRET,
} from '../../config/main-config.ts';

const LOG_PREFIX = '[PolicyService]';
const POLICY_DESCRIPTION = 'BreakBase agent governance';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeCdpClient(): CdpClient | null {
  if (!isConfigured()) return null;
  try {
    return getCdpClient();
  } catch {
    return null;
  }
}

function isValidEvmAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

// ---------------------------------------------------------------------------
// Core policy operations
// ---------------------------------------------------------------------------

/**
 * Create or update the agent wallet policy.
 * Idempotent: checks for existing policy first.
 */
export async function ensureAgentPolicy(): Promise<string | null> {
  const cdp = safeCdpClient();
  if (!cdp) {
    console.warn(`${LOG_PREFIX} CDP not configured, skipping policy creation`);
    return null;
  }

  try {
    // Check for existing policies (SDK listPolicies works fine)
    const { policies } = await cdp.policies.listPolicies({ scope: 'account' });
    const existing = policies?.find(
      (p: any) => p.description === POLICY_DESCRIPTION,
    );

    if (existing) {
      console.log(`${LOG_PREFIX} Policy already exists: ${existing.id}`);
      return existing.id;
    }

    // Build allowlisted addresses from config
    const rawAddresses: string[] = [
      USDC_ADDRESS,
      CHALLENGE_FACTORY_ADDRESS,
      FEE_DISTRIBUTOR_ADDRESS,
      REPUTATION_ORACLE_ADDRESS,
      '0x571621Ce60Cebb0c1D442b5afb38B1663C6Bf017', // Compound Comet Base Sepolia
      '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb', // Morpho Base
    ];

    const allowedAddresses = rawAddresses
      .filter((addr): addr is string => Boolean(addr) && addr.length > 0)
      .map((addr) => addr.toLowerCase())
      .filter((addr) => isValidEvmAddress(addr));

    if (allowedAddresses.length === 0) {
      console.warn(`${LOG_PREFIX} No valid addresses for policy allowlist, skipping`);
      return null;
    }

    const networkName = CHAIN_ID === 8453 ? 'base' : 'base-sepolia';

    const policyBody = {
      scope: 'account',
      description: POLICY_DESCRIPTION,
      rules: [
        {
          action: 'reject',
          operation: 'sendEvmTransaction',
          criteria: [
            {
              type: 'evmNetwork',
              networks: [networkName],
              operator: 'not in',
            },
          ],
        },
        {
          action: 'accept',
          operation: 'sendEvmTransaction',
          criteria: [
            {
              type: 'evmAddress',
              addresses: allowedAddresses,
              operator: 'in',
            },
          ],
        },
        {
          action: 'reject',
          operation: 'sendEvmTransaction',
          criteria: [
            {
              type: 'ethValue',
              ethValue: '100000000000000000', // 0.1 ETH in wei
              operator: '>',
            },
          ],
        },
      ],
    };

    // Direct REST call with signed JWT to bypass the SDK's broken Zod
    // validation layer (Zod v3/v4 conflict on Address type).
    const CDP_API_BASE = 'https://api.cdp.coinbase.com';
    const CDP_POLICY_PATH = '/platform/v2/policy-engine/policies';

    const jwt = await generateJwt({
      apiKeyId: CDP_API_KEY_ID,
      apiKeySecret: CDP_API_KEY_SECRET,
      requestMethod: 'POST',
      requestHost: 'api.cdp.coinbase.com',
      requestPath: CDP_POLICY_PATH,
    });

    const response = await fetch(`${CDP_API_BASE}${CDP_POLICY_PATH}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(policyBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `${LOG_PREFIX} CDP API error ${response.status}:`,
        errorBody,
      );
      return null;
    }

    const policy = (await response.json()) as { id: string };
    console.log(`${LOG_PREFIX} Created policy: ${policy.id}`);
    return policy.id;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to create policy:`, error);
    return null;
  }
}

/**
 * List all policies for the current project.
 */
export async function listPolicies(): Promise<any[] | null> {
  const cdp = safeCdpClient();
  if (!cdp) return null;

  try {
    const { policies } = await cdp.policies.listPolicies({});
    return policies ?? [];
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to list policies:`, error);
    return null;
  }
}

/**
 * Delete a policy by ID.
 */
export async function deletePolicy(policyId: string): Promise<boolean> {
  const cdp = safeCdpClient();
  if (!cdp) return false;

  try {
    await cdp.policies.deletePolicy({ id: policyId });
    console.log(`${LOG_PREFIX} Deleted policy: ${policyId}`);
    return true;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to delete policy:`, error);
    return false;
  }
}
