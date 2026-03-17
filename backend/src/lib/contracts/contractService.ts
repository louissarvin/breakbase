import { ethers, JsonRpcProvider, Contract } from 'ethers';
import type { Address } from 'viem';
import {
  RPC_URL,
  CHALLENGE_FACTORY_ADDRESS,
  FEE_DISTRIBUTOR_ADDRESS,
  USDC_ADDRESS,
} from '../../config/main-config.ts';
import { ChallengeABI, ChallengeFactoryABI, FeeDistributorABI } from './abis/index.ts';
import { viemPublicClient } from './viemClient.ts';

// Singleton provider
let provider: JsonRpcProvider | null = null;

export function getProvider(): JsonRpcProvider {
  if (!provider) {
    const fetchReq = new ethers.FetchRequest(RPC_URL);
    fetchReq.timeout = 8_000; // 8s timeout – keeps worst-case retry loop under 60s
    provider = new JsonRpcProvider(fetchReq);
  }
  return provider;
}

// Contract instances (lazy initialized)
let factoryContract: Contract | null = null;
let feeDistributorContract: Contract | null = null;

export function getFactoryContract(): Contract {
  if (!factoryContract) {
    factoryContract = new Contract(CHALLENGE_FACTORY_ADDRESS, ChallengeFactoryABI, getProvider());
  }
  return factoryContract;
}

export function getFeeDistributorContract(): Contract {
  if (!feeDistributorContract) {
    feeDistributorContract = new Contract(FEE_DISTRIBUTOR_ADDRESS, FeeDistributorABI, getProvider());
  }
  return feeDistributorContract;
}

export function getChallengeContract(cloneAddress: string): Contract {
  return new Contract(cloneAddress, ChallengeABI, getProvider());
}

export function getUsdcContract(): Contract {
  const erc20Abi = [
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address,address) view returns (uint256)',
    'function decimals() view returns (uint8)',
  ];
  return new Contract(USDC_ADDRESS, erc20Abi, getProvider());
}

// ---- Challenge reads ----

export async function getChallengeStatus(cloneAddress: string): Promise<number> {
  const challenge = getChallengeContract(cloneAddress);
  return Number(await challenge.status());
}

export async function getCurrentFee(cloneAddress: string): Promise<bigint> {
  const challenge = getChallengeContract(cloneAddress);
  return challenge.getCurrentFee();
}

export async function getPrizePool(cloneAddress: string): Promise<bigint> {
  const challenge = getChallengeContract(cloneAddress);
  return challenge.prizePool();
}

export async function getMessageCount(cloneAddress: string): Promise<number> {
  const challenge = getChallengeContract(cloneAddress);
  return Number(await challenge.messageCount());
}

export async function getEndTime(cloneAddress: string): Promise<number> {
  const challenge = getChallengeContract(cloneAddress);
  return Number(await challenge.endTime());
}

// ---- Factory reads ----

export async function getChallengeCount(): Promise<number> {
  const factory = getFactoryContract();
  return Number(await factory.getChallengeCount());
}

export async function getFactoryOracle(): Promise<string> {
  const factory = getFactoryContract();
  return factory.oracle();
}

// ---- FeeDistributor reads ----

export async function getFeeDistributorBalance(): Promise<bigint> {
  const usdc = getUsdcContract();
  return usdc.balanceOf(FEE_DISTRIBUTOR_ADDRESS);
}

// ---- Batch reads (viem Multicall3) ----

/**
 * Batch read status, prizePool, and messageCount for multiple challenges
 * using Multicall3. Collapses N*3 sequential RPC calls into a single
 * batched eth_call, which is both faster and cheaper on rate limits.
 */
export async function batchReadChallenges(cloneAddresses: string[]): Promise<
  Array<{
    address: string;
    status: number | null;
    prizePool: bigint | null;
    messageCount: number | null;
  }>
> {
  if (cloneAddresses.length === 0) return [];

  const contracts = cloneAddresses.flatMap((addr) => [
    {
      address: addr as Address,
      abi: ChallengeABI,
      functionName: 'status' as const,
    },
    {
      address: addr as Address,
      abi: ChallengeABI,
      functionName: 'prizePool' as const,
    },
    {
      address: addr as Address,
      abi: ChallengeABI,
      functionName: 'messageCount' as const,
    },
  ]);

  const results = await viemPublicClient.multicall({
    contracts,
    allowFailure: true,
  });

  return cloneAddresses.map((addr, i) => {
    const statusResult = results[i * 3];
    const prizePoolResult = results[i * 3 + 1];
    const messageCountResult = results[i * 3 + 2];

    return {
      address: addr,
      status:
        statusResult.status === 'success'
          ? Number(statusResult.result)
          : null,
      prizePool:
        prizePoolResult.status === 'success'
          ? BigInt(prizePoolResult.result as bigint)
          : null,
      messageCount:
        messageCountResult.status === 'success'
          ? Number(messageCountResult.result)
          : null,
    };
  });
}

// ---- Event queries ----

export async function queryChallengeCreatedEvents(fromBlock: number, toBlock: number | 'latest') {
  const factory = getFactoryContract();
  const filter = factory.filters.ChallengeCreated();
  return factory.queryFilter(filter, fromBlock, toBlock);
}

export async function queryMessageSentEvents(cloneAddress: string, fromBlock: number, toBlock: number | 'latest') {
  const challenge = getChallengeContract(cloneAddress);
  const filter = challenge.filters.MessageSent();
  return challenge.queryFilter(filter, fromBlock, toBlock);
}

export async function queryChallengeResolvedEvents(_fromBlock: number, _toBlock: number | 'latest') {
  // ChallengeResolved events are emitted by clones, not the factory.
  // The indexer should track known clone addresses and query each.
  // This is a placeholder; the indexer will iterate over known clones.
  return [];
}

// ---- Transaction verification ----

export async function getTransactionReceipt(txHash: string) {
  const prov = getProvider();
  return prov.getTransactionReceipt(txHash);
}

export async function verifyMessageSentTx(
  txHash: string,
  expectedPlayer: string,
  expectedChallenge: string,
): Promise<{ valid: boolean; fee?: bigint; messageCount?: number }> {
  const receipt = await getTransactionReceipt(txHash);
  if (!receipt) return { valid: false };

  // NOTE: We do NOT check receipt.to because Smart Wallet (EIP-5792) batch calls
  // route through the wallet contract. We rely on MessageSent event log verification below.

  // Parse logs for MessageSent event
  const challenge = getChallengeContract(expectedChallenge);
  for (const log of receipt.logs) {
    try {
      const parsed = challenge.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed && parsed.name === 'MessageSent') {
        const player = parsed.args[1]; // player is indexed at position 1
        if (player.toLowerCase() === expectedPlayer.toLowerCase()) {
          return {
            valid: true,
            fee: parsed.args[2], // fee
            messageCount: Number(parsed.args[6]), // messageCount
          };
        }
      }
    } catch {
      // Not a MessageSent event from this contract
    }
  }

  return { valid: false };
}

// ---- Block queries ----

export async function getLatestBlockNumber(): Promise<number> {
  const prov = getProvider();
  return prov.getBlockNumber();
}
