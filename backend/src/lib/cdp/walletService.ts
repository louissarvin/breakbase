/**
 * CDP Wallet Service
 *
 * Manages the BreakBase protocol agent wallet via Coinbase Developer Platform.
 * This wallet holds USDC, distributes fees, and seeds challenge prize pools.
 *
 * Uses @coinbase/cdp-sdk server accounts (NOT AgentKit).
 */

import { CdpClient, parseUnits } from "@coinbase/cdp-sdk";
import type { EvmServerAccount } from "@coinbase/cdp-sdk";
import {
  encodeFunctionData,
  createPublicClient,
  http,
  formatUnits,
  type Abi,
  type TransactionReceipt,
} from "viem";
import { baseSepolia } from "viem/chains";
import {
  CDP_API_KEY_ID,
  CDP_API_KEY_SECRET,
  CDP_WALLET_SECRET,
  IS_PROD,
} from "../../config/main-config.ts";
import { appendBuilderCode } from "../builderCode.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENT_ACCOUNT_NAME = "breakbase-protocol-agent";
const NETWORK = "base-sepolia" as const;
const USDC_DECIMALS = 6;
const LOG_PREFIX = "[CDPWallet]";

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

let cdpClient: CdpClient | null = null;
let cachedAccount: EvmServerAccount | null = null;

// ---------------------------------------------------------------------------
// Public client for on-chain reads (tx receipt polling)
// ---------------------------------------------------------------------------

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Check whether the required CDP environment variables are present.
 * Returns false gracefully without throwing if keys are empty strings.
 */
export function isConfigured(): boolean {
  return (
    CDP_API_KEY_ID.length > 0 &&
    CDP_API_KEY_SECRET.length > 0 &&
    CDP_WALLET_SECRET.length > 0
  );
}

/**
 * Lazily initialize the CdpClient singleton.
 * Throws if CDP is not configured.
 */
export function getCdpClient(): CdpClient {
  if (cdpClient) return cdpClient;

  if (!isConfigured()) {
    throw new Error(
      `${LOG_PREFIX} CDP is not configured. Set CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET.`,
    );
  }

  cdpClient = new CdpClient({
    apiKeyId: CDP_API_KEY_ID,
    apiKeySecret: CDP_API_KEY_SECRET,
    walletSecret: CDP_WALLET_SECRET,
  });

  console.log(`${LOG_PREFIX} CdpClient initialized`);
  return cdpClient;
}

// ---------------------------------------------------------------------------
// Core account management
// ---------------------------------------------------------------------------

/**
 * Idempotent get-or-create of the protocol agent EVM server account.
 * The account object is cached in memory after the first successful call.
 */
export async function getAgentAccount(): Promise<EvmServerAccount> {
  if (cachedAccount) return cachedAccount;

  try {
    const client = getCdpClient();
    const account = await client.evm.getOrCreateAccount({
      name: AGENT_ACCOUNT_NAME,
    });

    cachedAccount = account;
    console.log(`${LOG_PREFIX} Agent account ready: ${account.address}`);
    return account;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to get/create agent account:`, error);
    throw error;
  }
}

/**
 * Quick accessor for the agent wallet's EVM address.
 */
export async function getAgentAddress(): Promise<string> {
  const account = await getAgentAccount();
  return account.address;
}

// ---------------------------------------------------------------------------
// USDC transfers
// ---------------------------------------------------------------------------

/**
 * Transfer USDC from the protocol agent wallet to a recipient address.
 *
 * @param to   - 0x-prefixed EVM address of the recipient
 * @param amount - Human-readable USDC amount as a string (e.g. "10.5" for 10.5 USDC)
 * @returns The transaction hash
 */
export async function transferUsdc(
  to: string,
  amount: string,
): Promise<{ transactionHash: string }> {
  if (!to || !to.startsWith("0x") || to.length !== 42) {
    throw new Error(`${LOG_PREFIX} Invalid recipient address: ${to}`);
  }

  const parsedAmount = parseUnits(amount, USDC_DECIMALS);
  if (parsedAmount <= 0n) {
    throw new Error(`${LOG_PREFIX} Amount must be positive, got: ${amount}`);
  }

  try {
    const account = await getAgentAccount();
    const result = await account.transfer({
      to: to as `0x${string}`,
      amount: parsedAmount,
      token: "usdc",
      network: NETWORK,
    });

    console.log(
      `${LOG_PREFIX} Transferred ${amount} USDC to ${to} | tx: ${result.transactionHash}`,
    );
    return { transactionHash: result.transactionHash };
  } catch (error) {
    console.error(
      `${LOG_PREFIX} USDC transfer failed (to=${to}, amount=${amount}):`,
      error,
    );
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Contract calls
// ---------------------------------------------------------------------------

/**
 * Call any contract function from the agent wallet.
 *
 * Uses viem's `encodeFunctionData` to ABI-encode the call,
 * then sends it via the CDP server account.
 *
 * @param address      - Contract address
 * @param abi          - Contract ABI (viem Abi type)
 * @param functionName - Name of the function to call
 * @param args         - Function arguments
 * @returns The transaction hash
 */
export async function callContract(
  address: string,
  abi: Abi,
  functionName: string,
  args: unknown[],
): Promise<{ transactionHash: string }> {
  if (!address || !address.startsWith("0x") || address.length !== 42) {
    throw new Error(`${LOG_PREFIX} Invalid contract address: ${address}`);
  }

  try {
    const rawData = encodeFunctionData({
      abi,
      functionName,
      args,
    });

    // Append ERC-8021 builder code suffix for Base attribution
    const data = appendBuilderCode(rawData) as `0x${string}`;

    const account = await getAgentAccount();
    const result = await account.sendTransaction({
      network: NETWORK,
      transaction: {
        to: address as `0x${string}`,
        value: 0n,
        data,
      },
    });

    console.log(
      `${LOG_PREFIX} Contract call ${functionName} on ${address} | tx: ${result.transactionHash}`,
    );
    return { transactionHash: result.transactionHash };
  } catch (error) {
    console.error(
      `${LOG_PREFIX} Contract call failed (${functionName} on ${address}):`,
      error,
    );
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Transaction confirmation
// ---------------------------------------------------------------------------

/**
 * Wait for a transaction to be confirmed on-chain.
 * Uses viem's public client to poll for the receipt.
 *
 * @param txHash - The 0x-prefixed transaction hash
 * @returns The full transaction receipt
 */
export async function waitForTransaction(
  txHash: string,
): Promise<TransactionReceipt> {
  if (!txHash || !txHash.startsWith("0x")) {
    throw new Error(`${LOG_PREFIX} Invalid transaction hash: ${txHash}`);
  }

  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    console.log(
      `${LOG_PREFIX} Transaction confirmed: ${txHash} | status: ${receipt.status} | block: ${receipt.blockNumber}`,
    );
    return receipt;
  } catch (error) {
    console.error(
      `${LOG_PREFIX} Failed waiting for transaction ${txHash}:`,
      error,
    );
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Balance queries
// ---------------------------------------------------------------------------

/**
 * Get the USDC balance of the agent wallet.
 *
 * @returns Object with raw bigint `amount`, `decimals`, and a human-readable `formatted` string
 */
export async function getAgentBalance(): Promise<{
  amount: bigint;
  decimals: number;
  formatted: string;
}> {
  try {
    const account = await getAgentAccount();
    const { balances } = await account.listTokenBalances({
      network: NETWORK,
    });

    const usdcBalance = balances.find(
      (b) =>
        b.token.symbol?.toUpperCase() === "USDC" ||
        b.token.name?.toUpperCase() === "USDC",
    );

    if (!usdcBalance) {
      return { amount: 0n, decimals: USDC_DECIMALS, formatted: "0.00" };
    }

    const formatted = formatUnits(usdcBalance.amount.amount, usdcBalance.amount.decimals);

    return {
      amount: usdcBalance.amount.amount,
      decimals: usdcBalance.amount.decimals,
      formatted,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to fetch agent balance:`, error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Testnet faucet
// ---------------------------------------------------------------------------

/**
 * Request USDC from the Base Sepolia faucet.
 * Only works on testnet. Guarded to prevent accidental calls in production.
 *
 * @returns The faucet transaction hash
 */
export async function requestTestnetFunds(): Promise<{ transactionHash: string }> {
  if (IS_PROD) {
    throw new Error(
      `${LOG_PREFIX} requestTestnetFunds() cannot be called in production.`,
    );
  }

  try {
    const account = await getAgentAccount();
    const result = await account.requestFaucet({
      network: NETWORK,
      token: "usdc",
    });

    console.log(
      `${LOG_PREFIX} Faucet USDC requested | tx: ${result.transactionHash}`,
    );
    return { transactionHash: result.transactionHash };
  } catch (error) {
    console.error(`${LOG_PREFIX} Faucet request failed:`, error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// On-chain reads (no signer needed)
// ---------------------------------------------------------------------------

/**
 * Read a contract value on-chain (no signer needed).
 *
 * @param address      - Contract address
 * @param abi          - Contract ABI (viem Abi type)
 * @param functionName - Name of the view/pure function to call
 * @param args         - Function arguments (optional)
 * @returns The decoded return value
 */
export async function readContract(
  address: string,
  abi: Abi,
  functionName: string,
  args?: unknown[],
): Promise<unknown> {
  return publicClient.readContract({
    address: address as `0x${string}`,
    abi,
    functionName,
    args: args ?? [],
  });
}
