import { prismaQuery } from '../lib/prisma.ts';
import {
  getProvider,
  getFactoryContract,
  getChallengeContract,
  getLatestBlockNumber,
  queryChallengeCreatedEvents,
  batchReadChallenges,
} from '../lib/contracts/contractService.ts';
import {
  EVENT_INDEXER_INTERVAL_MS,
  CHALLENGE_FACTORY_ADDRESS,
} from '../config/main-config.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BLOCK_RANGE = 2000;
const INITIAL_LOOKBACK = 1000;

// On-chain status enum: 0=Active, 1=Resolved, 2=Expired, 3=Cancelled
const CHAIN_STATUS_MAP: Record<number, 'Active' | 'Resolved' | 'Expired' | 'Cancelled'> = {
  0: 'Active',
  1: 'Resolved',
  2: 'Expired',
  3: 'Cancelled',
};

// ---------------------------------------------------------------------------
// Re-entrance guard
// ---------------------------------------------------------------------------

let isRunning = false;

// ---------------------------------------------------------------------------
// IndexerState helpers
// ---------------------------------------------------------------------------

async function getLastProcessedBlock(): Promise<number> {
  const state = await prismaQuery.indexerState.findUnique({
    where: { id: 'singleton' },
  });
  if (state) return state.lastBlockNumber;

  // First run: seed from current block minus lookback
  let startBlock: number;
  try {
    const latest = await getLatestBlockNumber();
    startBlock = Math.max(0, latest - INITIAL_LOOKBACK);
  } catch {
    startBlock = 0;
  }

  await prismaQuery.indexerState.create({
    data: { id: 'singleton', lastBlockNumber: startBlock },
  });
  console.log(`[EventIndexer] Initialized IndexerState at block ${startBlock}`);
  return startBlock;
}

async function saveLastProcessedBlock(blockNumber: number): Promise<void> {
  await prismaQuery.indexerState.update({
    where: { id: 'singleton' },
    data: { lastBlockNumber: blockNumber },
  });
}

// ---------------------------------------------------------------------------
// 1. Index ChallengeCreated events from the Factory
// ---------------------------------------------------------------------------

async function indexChallengeCreatedEvents(fromBlock: number, toBlock: number): Promise<void> {
  let events;
  try {
    events = await queryChallengeCreatedEvents(fromBlock, toBlock);
  } catch (error) {
    console.error(`[EventIndexer] Failed to query ChallengeCreated events (${fromBlock}-${toBlock}):`, error);
    return;
  }

  if (events.length === 0) return;
  console.log(`[EventIndexer] Found ${events.length} ChallengeCreated events`);

  for (const event of events) {
    try {
      const args = (event as any).args;
      if (!args) continue;

      // ChallengeCreated(challengeId, clone, defender, basePrice, duration, pricingModel)
      const challengeId: string = args[0]; // bytes32
      const cloneAddress: string = args[1]; // address
      const defender: string = args[2]; // address
      const basePrice: bigint = BigInt(args[3]);
      const duration: number = Number(args[4]); // uint48
      const pricingModel: number = Number(args[5]); // uint8 (0=Fixed, 1=Escalating)

      // Check if already exists
      const existing = await prismaQuery.challenge.findUnique({
        where: { challengeId },
      });
      if (existing) continue;

      // Read additional on-chain fields not present in the event
      const clone = getChallengeContract(cloneAddress);
      let maxFee: bigint = BigInt(0);
      let growthRateBps: number = 0;
      let endTimeUnix: number = 0;
      let prizePoolValue: bigint = BigInt(0);

      try {
        [maxFee, growthRateBps, endTimeUnix, prizePoolValue] = await Promise.all([
          clone.maxFee().then((v: any) => BigInt(v)),
          clone.growthRateBps().then((v: any) => Number(v)),
          clone.endTime().then((v: any) => Number(v)),
          clone.prizePool().then((v: any) => BigInt(v)),
        ]);
      } catch (readError) {
        console.error(`[EventIndexer] Failed to read clone state for ${cloneAddress}:`, readError);
        // Fall back: calculate endTime from block timestamp + duration
        try {
          const block = await getProvider().getBlock(event.blockNumber);
          if (block) {
            endTimeUnix = block.timestamp + duration;
          }
        } catch {
          // Use a reasonable fallback: current timestamp + duration
          endTimeUnix = Math.floor(Date.now() / 1000) + duration;
        }
      }

      const endTime = new Date(endTimeUnix * 1000);

      await prismaQuery.challenge.create({
        data: {
          challengeId,
          cloneAddress: cloneAddress.toLowerCase(),
          factoryAddress: CHALLENGE_FACTORY_ADDRESS.toLowerCase(),
          defender: defender.toLowerCase(),
          basePrice,
          maxFee,
          duration,
          growthRateBps,
          pricingModel: pricingModel === 1 ? 'Escalating' : 'Fixed',
          endTime,
          title: 'Untitled Challenge',
          description: '',
          systemPrompt: '',
          status: 'Active',
          prizePool: prizePoolValue,
          messageCount: 0,
        },
      });

      console.log(`[EventIndexer] Created challenge ${challengeId} (clone: ${cloneAddress})`);
    } catch (error) {
      console.error(`[EventIndexer] Failed to process ChallengeCreated event:`, error);
      // Continue with other events
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Index lifecycle events (Resolved, Expired, Cancelled) from known clones
// ---------------------------------------------------------------------------

async function indexCloneEvents(
  activeChallenges: { id: string; challengeId: string; cloneAddress: string }[],
  fromBlock: number,
  toBlock: number,
): Promise<void> {
  for (const challenge of activeChallenges) {
    try {
      const clone = getChallengeContract(challenge.cloneAddress);

      // Query ChallengeResolved events
      try {
        const resolvedFilter = clone.filters.ChallengeResolved();
        const resolvedEvents = await clone.queryFilter(resolvedFilter, fromBlock, toBlock);

        for (const event of resolvedEvents) {
          const args = (event as any).args;
          if (!args) continue;

          // ChallengeResolved(challenge, winner, prizeAmount, attemptNumber)
          const winnerAddress: string = args[1];
          const winnerAttempt: number = Number(args[3]);

          await prismaQuery.challenge.update({
            where: { id: challenge.id },
            data: {
              status: 'Resolved',
              winnerAddress: winnerAddress.toLowerCase(),
              winnerAttempt,
              resolvedAt: new Date(),
            },
          });
          console.log(`[EventIndexer] Challenge ${challenge.challengeId} resolved, winner: ${winnerAddress}`);
        }
      } catch (error) {
        console.error(`[EventIndexer] Failed to query ChallengeResolved for ${challenge.cloneAddress}:`, error);
      }

      // Query ChallengeExpired events
      try {
        const expiredFilter = clone.filters.ChallengeExpired();
        const expiredEvents = await clone.queryFilter(expiredFilter, fromBlock, toBlock);

        for (const _event of expiredEvents) {
          await prismaQuery.challenge.update({
            where: { id: challenge.id },
            data: { status: 'Expired' },
          });
          console.log(`[EventIndexer] Challenge ${challenge.challengeId} expired`);
        }
      } catch (error) {
        console.error(`[EventIndexer] Failed to query ChallengeExpired for ${challenge.cloneAddress}:`, error);
      }

      // Query ChallengeCancelled events
      try {
        const cancelledFilter = clone.filters.ChallengeCancelled();
        const cancelledEvents = await clone.queryFilter(cancelledFilter, fromBlock, toBlock);

        for (const _event of cancelledEvents) {
          await prismaQuery.challenge.update({
            where: { id: challenge.id },
            data: { status: 'Cancelled' },
          });
          console.log(`[EventIndexer] Challenge ${challenge.challengeId} cancelled`);
        }
      } catch (error) {
        console.error(`[EventIndexer] Failed to query ChallengeCancelled for ${challenge.cloneAddress}:`, error);
      }
    } catch (error) {
      console.error(`[EventIndexer] Failed to process clone events for ${challenge.cloneAddress}:`, error);
      // Continue with other challenges
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Sync on-chain state of Active challenges (status, prizePool, messageCount)
// ---------------------------------------------------------------------------

async function syncActiveChallenges(
  activeChallenges: { id: string; challengeId: string; cloneAddress: string; prizePool: bigint; messageCount: number; status: string }[],
): Promise<void> {
  // Batch all on-chain reads into a single Multicall3 request
  const addresses = activeChallenges.map((c) => c.cloneAddress);
  let batchResults: Awaited<ReturnType<typeof batchReadChallenges>>;

  try {
    batchResults = await batchReadChallenges(addresses);
  } catch (error) {
    console.error('[EventIndexer] Multicall batch read failed:', error);
    return;
  }

  for (let i = 0; i < activeChallenges.length; i++) {
    const challenge = activeChallenges[i];
    const chainData = batchResults[i];

    if (chainData.status === null) {
      console.error(`[EventIndexer] Multicall failed for ${challenge.cloneAddress}, skipping sync`);
      continue;
    }

    try {
      const dbStatus = CHAIN_STATUS_MAP[chainData.status] || 'Active';
      const updates: Record<string, any> = {};

      if (dbStatus !== challenge.status) {
        updates.status = dbStatus;
        if (dbStatus === 'Resolved') {
          updates.resolvedAt = new Date();
        }
      }

      if (chainData.prizePool !== null && chainData.prizePool !== challenge.prizePool) {
        updates.prizePool = chainData.prizePool;
      }

      if (chainData.messageCount !== null && chainData.messageCount !== challenge.messageCount) {
        updates.messageCount = chainData.messageCount;
      }

      if (Object.keys(updates).length > 0) {
        await prismaQuery.challenge.update({
          where: { id: challenge.id },
          data: updates,
        });
        console.log(`[EventIndexer] Synced challenge ${challenge.challengeId}: ${JSON.stringify(updates, (_k, v) => typeof v === 'bigint' ? v.toString() : v)}`);
      }
    } catch (error) {
      console.error(`[EventIndexer] Failed to sync challenge ${challenge.challengeId}:`, error);
      // Continue with other challenges
    }
  }
}

// ---------------------------------------------------------------------------
// Main indexer task
// ---------------------------------------------------------------------------

const indexEvents = async (): Promise<void> => {
  if (isRunning) {
    console.log('[EventIndexer] Previous run still active, skipping...');
    return;
  }

  isRunning = true;
  try {
    // Determine block range to process
    const lastProcessed = await getLastProcessedBlock();
    let latestBlock: number;

    try {
      latestBlock = await getLatestBlockNumber();
    } catch (error) {
      console.error('[EventIndexer] Failed to get latest block number:', error);
      return;
    }

    if (latestBlock <= lastProcessed) {
      // No new blocks to process
      return;
    }

    // Cap at MAX_BLOCK_RANGE per run
    const fromBlock = lastProcessed + 1;
    const toBlock = Math.min(latestBlock, lastProcessed + MAX_BLOCK_RANGE);

    console.log(`[EventIndexer] Processing blocks ${fromBlock} to ${toBlock}`);

    // Step 1: Index ChallengeCreated events from Factory
    await indexChallengeCreatedEvents(fromBlock, toBlock);

    // Step 2: Get all Active challenges from DB for clone-level event queries and state sync
    const activeChallenges = await prismaQuery.challenge.findMany({
      where: { status: 'Active' },
      select: {
        id: true,
        challengeId: true,
        cloneAddress: true,
        prizePool: true,
        messageCount: true,
        status: true,
      },
    });

    // Step 3: Index lifecycle events (Resolved/Expired/Cancelled) from clone contracts
    if (activeChallenges.length > 0) {
      await indexCloneEvents(activeChallenges, fromBlock, toBlock);
    }

    // Step 4: Sync on-chain state for Active challenges
    // Re-fetch after event indexing since some may have changed status
    const stillActiveChallenges = await prismaQuery.challenge.findMany({
      where: { status: 'Active' },
      select: {
        id: true,
        challengeId: true,
        cloneAddress: true,
        prizePool: true,
        messageCount: true,
        status: true,
      },
    });

    if (stillActiveChallenges.length > 0) {
      await syncActiveChallenges(stillActiveChallenges);
    }

    // Step 5: Update IndexerState
    await saveLastProcessedBlock(toBlock);
  } catch (error) {
    console.error('[EventIndexer] Error:', error);
  } finally {
    isRunning = false;
  }
};

// ---------------------------------------------------------------------------
// Export: start the worker
// ---------------------------------------------------------------------------

export const startEventIndexerWorker = (): void => {
  console.log(`[EventIndexer] Scheduled (interval: ${EVENT_INDEXER_INTERVAL_MS}ms)`);
  setInterval(indexEvents, EVENT_INDEXER_INTERVAL_MS);
  indexEvents(); // Run immediately on startup
};
