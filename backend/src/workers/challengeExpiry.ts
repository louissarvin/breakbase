import cron from 'node-cron';
import { ethers, Wallet } from 'ethers';
import { prismaQuery } from '../lib/prisma.ts';
import { getProvider, getChallengeContract } from '../lib/contracts/contractService.ts';
import { CHALLENGE_EXPIRY_CHECK_INTERVAL, ORACLE_PRIVATE_KEY } from '../config/main-config.ts';
import { appendBuilderCode } from '../lib/builderCode.ts';
import { ChallengeABI } from '../lib/contracts/abis/index.ts';
import { callContract, waitForTransaction, isConfigured as isCdpConfigured } from '../lib/cdp/walletService.ts';
import { attestDefender } from '../lib/eas/attestationService.ts';
import { sendNotification, getAllTokensGroupedByUrl } from '../lib/farcaster/notificationService.ts';
import { APP_URL } from '../config/main-config.ts';

/** 1 hour in milliseconds, matching RESOLUTION_GRACE_PERIOD in Challenge.sol */
const RESOLUTION_GRACE_PERIOD_MS = 60 * 60 * 1000;

/** On-chain status enum: 0 = Active */
const ON_CHAIN_STATUS_ACTIVE = 0;

let isRunning = false;

/**
 * Send the expireChallenge() transaction via CDP wallet or legacy ethers.Wallet.
 * Returns the confirmed transaction hash and block number.
 */
async function sendExpireChallengeTx(cloneAddress: string): Promise<{ hash: string; blockNumber: bigint }> {
  if (isCdpConfigured()) {
    console.log(`[ChallengeExpiry] Using CDP wallet to expire ${cloneAddress}`);
    const { transactionHash } = await callContract(
      cloneAddress,
      ChallengeABI as any,
      'expireChallenge',
      [],
    );
    const receipt = await waitForTransaction(transactionHash);
    return { hash: receipt.transactionHash, blockNumber: receipt.blockNumber };
  } else {
    console.log(`[ChallengeExpiry] Using legacy wallet to expire ${cloneAddress}`);
    const wallet = new Wallet(ORACLE_PRIVATE_KEY, getProvider());
    const contract = new ethers.Contract(cloneAddress, ChallengeABI, wallet);
    // Use populateTransaction + builder code suffix for Base attribution
    const populated = await contract.expireChallenge.populateTransaction();
    populated.data = appendBuilderCode(populated.data);
    const tx = await wallet.sendTransaction(populated);
    const receipt = await tx.wait();
    if (!receipt) throw new Error('Transaction receipt not available');
    return { hash: receipt.hash, blockNumber: BigInt(receipt.blockNumber) };
  }
}

const checkExpiredChallenges = async (): Promise<void> => {
  if (isRunning) {
    console.log('[ChallengeExpiry] Previous run still active, skipping...');
    return;
  }

  isRunning = true;

  try {
    const gracePeriodCutoff = new Date(Date.now() - RESOLUTION_GRACE_PERIOD_MS);

    const expiredChallenges = await prismaQuery.challenge.findMany({
      where: {
        status: 'Active',
        endTime: { lt: gracePeriodCutoff },
      },
      select: {
        id: true,
        cloneAddress: true,
        challengeId: true,
        defender: true,
        messageCount: true,
        createdAt: true,
        prizePool: true,
        aiModel: true,
      },
    });

    if (expiredChallenges.length === 0) {
      console.log('[ChallengeExpiry] No expired challenges found');
      return;
    }

    console.log(`[ChallengeExpiry] Found ${expiredChallenges.length} expired challenge(s) to process`);

    // Process sequentially to avoid nonce collisions
    for (const challenge of expiredChallenges) {
      try {
        // Read on-chain status to confirm still Active
        const onChainContract = getChallengeContract(challenge.cloneAddress);
        const onChainStatus = Number(await onChainContract.status());

        if (onChainStatus !== ON_CHAIN_STATUS_ACTIVE) {
          // Already resolved/expired on-chain by someone else; sync DB
          console.log(
            `[ChallengeExpiry] Challenge ${challenge.cloneAddress} already non-Active on-chain (status=${onChainStatus}), syncing DB`
          );
          await prismaQuery.challenge.update({
            where: { id: challenge.id },
            data: { status: 'Expired' },
          });
          continue;
        }

        // Send expireChallenge transaction
        const { hash, blockNumber } = await sendExpireChallengeTx(challenge.cloneAddress);
        console.log(
          `[ChallengeExpiry] Challenge ${challenge.cloneAddress} expired in block ${blockNumber}, tx: ${hash}`
        );

        // Update DB status
        await prismaQuery.challenge.update({
          where: { id: challenge.id },
          data: { status: 'Expired' },
        });

        // Fire-and-forget EAS attestation: Defender
        attestDefender({
          defenderAddress: challenge.defender,
          challengeId: challenge.challengeId,
          totalAttempts: challenge.messageCount,
          survivalDuration: Math.floor((Date.now() - challenge.createdAt.getTime()) / 1000),
          prizePoolSize: challenge.prizePool,
          wasBreached: false,
          modelUsed: challenge.aiModel,
        }).catch((err) => {
          console.error(`[ChallengeExpiry] EAS attestDefender failed (non-fatal):`, err);
        });

        // Fire-and-forget Farcaster notification on expiry
        getAllTokensGroupedByUrl().then(async (grouped) => {
          if (grouped.size === 0) return;
          const tokens: Array<{ token: string; url: string }> = [];
          for (const [url, urlTokens] of grouped) {
            for (const t of urlTokens) tokens.push({ token: t, url });
          }
          await sendNotification({
            notificationId: `expire-${challenge.id}`,
            title: 'Challenge Survived!',
            body: `${challenge.challengeId} survived all attacks!`,
            targetUrl: `${APP_URL}/challenge/${challenge.challengeId}`,
            tokens,
          });
        }).catch((err) => {
          console.error('[ChallengeExpiry] Farcaster notification failed (non-fatal):', err);
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[ChallengeExpiry] Failed to expire ${challenge.cloneAddress}: ${message}`);
      }
    }
  } catch (error) {
    console.error('[ChallengeExpiry] Error:', error);
  } finally {
    isRunning = false;
  }
};

export const startChallengeExpiryWorker = (): void => {
  console.log(`[ChallengeExpiry] Scheduled: ${CHALLENGE_EXPIRY_CHECK_INTERVAL}`);
  cron.schedule(CHALLENGE_EXPIRY_CHECK_INTERVAL, checkExpiredChallenges);
  checkExpiredChallenges(); // Run immediately on startup
};
