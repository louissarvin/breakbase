import cron from 'node-cron';
import { Wallet, Contract } from 'ethers';
import { prismaQuery } from '../lib/prisma.ts';
import { getProvider, getUsdcContract } from '../lib/contracts/contractService.ts';
import { FeeDistributorABI } from '../lib/contracts/abis/index.ts';
import { callContract, waitForTransaction, isConfigured as isCdpConfigured } from '../lib/cdp/walletService.ts';
import { PROTOCOL_AGENT_INTERVAL, ORACLE_PRIVATE_KEY, FEE_DISTRIBUTOR_ADDRESS, NEYNAR_API_KEY, NEYNAR_MANAGER_SIGNER, AGENT_FID } from '../config/main-config.ts';
import { appendBuilderCode } from '../lib/builderCode.ts';
import { seedChallenges } from '../services/challengeSeedingService.ts';
import { initAgentKit, isAgentKitReady, runAnalysis } from '../lib/cdp/agentKitService.ts';
import { ensureAgentPolicy } from '../lib/cdp/policyService.ts';

// USDC uses 6 decimals
const USDC_DECIMALS = 6n;
const USDC_UNIT = 10n ** USDC_DECIMALS;

let isRunning = false;
let hasSeeded = false;

let analysisCycleCount = 0;
const AI_ANALYSIS_INTERVAL = 3; // Run AI analysis every 3rd cycle

/**
 * Format a USDC BigInt amount to a human-readable string (e.g. "12.50").
 */
function formatUsdc(amount: bigint): string {
  const whole = amount / USDC_UNIT;
  const fractional = amount % USDC_UNIT;
  const fractionalStr = fractional.toString().padStart(Number(USDC_DECIMALS), '0');
  return `${whole.toString()}.${fractionalStr}`;
}

/**
 * Send the distribute() transaction via CDP wallet or legacy ethers.Wallet.
 * Returns the confirmed transaction hash.
 */
async function sendDistributeTx(): Promise<{ hash: string }> {
  if (isCdpConfigured()) {
    console.log('[ProtocolAgent] Using CDP wallet for fee distribution');
    const { transactionHash } = await callContract(
      FEE_DISTRIBUTOR_ADDRESS,
      FeeDistributorABI as any,
      'distribute',
      [],
    );
    const receipt = await waitForTransaction(transactionHash);
    return { hash: receipt.transactionHash };
  } else {
    console.log('[ProtocolAgent] Using legacy wallet for fee distribution');
    const wallet = new Wallet(ORACLE_PRIVATE_KEY, getProvider());
    const feeDistributor = new Contract(FEE_DISTRIBUTOR_ADDRESS, FeeDistributorABI, wallet);
    // Use populateTransaction + builder code suffix for Base attribution
    const populated = await feeDistributor.distribute.populateTransaction();
    populated.data = appendBuilderCode(populated.data);
    const tx = await wallet.sendTransaction(populated);
    const receipt = await tx.wait();
    if (!receipt) throw new Error('Transaction receipt not available');
    return { hash: receipt.hash };
  }
}

/**
 * Check the FeeDistributor USDC balance and call distribute() if there are
 * accumulated fees. Records the result in the AgentAction table regardless
 * of success or failure.
 */
async function handleFeeDistribution(): Promise<void> {
  const usdc = getUsdcContract();

  // 1. Read the current balance held by the FeeDistributor
  let balance: bigint;
  try {
    balance = await usdc.balanceOf(FEE_DISTRIBUTOR_ADDRESS);
  } catch (err) {
    console.error('[ProtocolAgent] Failed to read FeeDistributor balance:', err);
    return;
  }

  if (balance === 0n) {
    console.log('[ProtocolAgent] FeeDistributor balance is 0 USDC, nothing to distribute');
    return;
  }

  const formattedBalance = formatUsdc(balance);
  console.log(`[ProtocolAgent] Distributing ${formattedBalance} USDC fees`);

  // 2. Send distribute() transaction
  try {
    const { hash } = await sendDistributeTx();

    console.log(`[ProtocolAgent] Fee distribution tx confirmed: ${hash}`);

    // 3. Record successful action
    await prismaQuery.agentAction.create({
      data: {
        actionType: 'FeeDistribution',
        description: `Distributed ${formattedBalance} USDC to agent wallet`,
        txHash: hash,
        status: 'Success',
        amountUsdc: balance,
        completedAt: new Date(),
      },
    });
  } catch (err: unknown) {
    // NothingToDistribute is an expected revert when the contract balance
    // was drained between our read and the tx landing. Treat as a no-op.
    const errorStr = String(err);
    if (errorStr.includes('NothingToDistribute')) {
      console.log('[ProtocolAgent] distribute() reverted with NothingToDistribute, skipping');
      return;
    }

    console.error('[ProtocolAgent] Fee distribution failed:', err);

    // Record failure so the team can investigate
    await prismaQuery.agentAction.create({
      data: {
        actionType: 'FeeDistribution',
        description: `Failed to distribute ${formattedBalance} USDC`,
        status: 'Failed',
        error: errorStr.slice(0, 2000), // Cap error length to avoid blowing up the text column
        amountUsdc: balance,
        completedAt: new Date(),
      },
    });
  }
}

/**
 * Build the list of analysis types to cycle through.
 * Farcaster social_update is only included when credentials are configured.
 */
function getAnalysisTypes(): Array<"platform_overview" | "fee_distribution" | "challenge_health" | "treasury_yield" | "social_update"> {
  const types: Array<"platform_overview" | "fee_distribution" | "challenge_health" | "treasury_yield" | "social_update"> = [
    'platform_overview',
    'treasury_yield',
  ];

  if (NEYNAR_API_KEY && NEYNAR_MANAGER_SIGNER && AGENT_FID) {
    types.push('social_update');
  }

  return types;
}

/**
 * Run AI-driven platform analysis every Nth cycle.
 * Purely additive: if AgentKit is not ready or the analysis fails,
 * the worker continues normally.
 *
 * Cycles through available analysis types (platform_overview, treasury_yield,
 * and optionally social_update) on each qualifying interval.
 */
async function handleAiAnalysis(): Promise<void> {
  if (!isAgentKitReady()) return;

  analysisCycleCount++;
  if (analysisCycleCount % AI_ANALYSIS_INTERVAL !== 0) return;

  const analysisTypes = getAnalysisTypes();
  const typeIndex = Math.floor(analysisCycleCount / AI_ANALYSIS_INTERVAL) % analysisTypes.length;
  const analysisType = analysisTypes[typeIndex];

  try {
    console.log(`[ProtocolAgent] Running AI-driven analysis: ${analysisType}...`);
    const analysis = await runAnalysis(analysisType);
    console.log(`[ProtocolAgent] AI Analysis (${analysisType}):`, analysis.slice(0, 500));

    // Record the analysis as an agent action
    await prismaQuery.agentAction.create({
      data: {
        actionType: 'Other',
        description: `AI ${analysisType} analysis: ${analysis.slice(0, 500)}`,
        status: 'Success',
        completedAt: new Date(),
      },
    });
  } catch (err) {
    console.error(`[ProtocolAgent] AI analysis (${analysisType}) failed:`, err);
    // Non-fatal: don't record failures for analysis
  }
}

/**
 * Main loop. Protected by the isRunning flag so overlapping cron ticks
 * are silently skipped rather than double-executing.
 */
const runProtocolAgent = async (): Promise<void> => {
  if (isRunning) {
    console.log('[ProtocolAgent] Previous run still active, skipping...');
    return;
  }

  isRunning = true;
  try {
    await handleFeeDistribution();

    // Seed protocol challenges once on first successful run.
    // Subsequent runs skip seeding unless the flag is reset (e.g. on restart).
    if (!hasSeeded) {
      try {
        await seedChallenges();
        hasSeeded = true;
      } catch (seedError) {
        // Non-fatal: log and retry on the next cycle
        console.error('[ProtocolAgent] Challenge seeding failed (will retry next cycle):', seedError);
      }
    }

    // AI-driven analysis (non-blocking, isolated error handling)
    try {
      await handleAiAnalysis();
    } catch (aiError) {
      console.error('[ProtocolAgent] AI analysis error (non-fatal):', aiError);
    }
  } catch (error) {
    console.error('[ProtocolAgent] Unhandled error:', error);
  } finally {
    isRunning = false;
  }
};

/**
 * Register the cron job. Does NOT run immediately on startup so the
 * event indexer has time to sync first.
 */
export const startProtocolAgentWorker = (): void => {
  console.log(`[ProtocolAgent] Scheduled at interval: ${PROTOCOL_AGENT_INTERVAL}`);

  // Initialize AgentKit in background (non-blocking)
  initAgentKit()
    .then(() => console.log('[ProtocolAgent] AgentKit initialized'))
    .catch((err) => console.warn('[ProtocolAgent] AgentKit init failed (will retry):', err));

  // Ensure wallet governance policy exists (non-blocking)
  ensureAgentPolicy()
    .then((id) => id && console.log(`[ProtocolAgent] Agent policy ready: ${id}`))
    .catch((err) => console.warn('[ProtocolAgent] Policy init failed (non-fatal):', err));

  cron.schedule(PROTOCOL_AGENT_INTERVAL, runProtocolAgent);
};
