/**
 * Shared viem public client for batch contract reads.
 * Uses Multicall3 for efficient batched eth_call requests.
 *
 * Base Sepolia and Base mainnet both have Multicall3 deployed at the
 * canonical address, which viem's chain definitions already include.
 */

import { createPublicClient, http } from 'viem';
import { baseSepolia, base } from 'viem/chains';
import { CHAIN_ID, RPC_URL } from '../../config/main-config.ts';

const chain = CHAIN_ID === 8453 ? base : baseSepolia;

export const viemPublicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
  batch: {
    multicall: {
      wait: 50, // batch window in ms for automatic batching
    },
  },
});
