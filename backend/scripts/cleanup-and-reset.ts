/**
 * One-time cleanup script: Remove challenges from the old factory and reset
 * the indexer block cursor so the new factory's events get picked up.
 *
 * What it does:
 *   1. Deletes Messages, AgentActions, and Challenges tied to the old factory
 *   2. Deletes orphan challenges (null/empty factoryAddress)
 *   3. Resets IndexerState.lastBlockNumber to 500 blocks before the new
 *      challenge creation tx (block 40684389) so the indexer rescans it
 *
 * Usage:
 *   bun run scripts/cleanup-and-reset.ts
 */

import '../dotenv.ts';
import { PrismaClient } from '../prisma/generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const OLD_FACTORY = '0xDd154369F5066B8De28A8a649F38ba35A89e337a'.toLowerCase();
const NEW_CHALLENGE_BLOCK = 40684389;
const RESET_BLOCK = NEW_CHALLENGE_BLOCK - 500;

async function main() {
  console.log('--- BreakBase Cleanup & Reset ---\n');

  // 1. Find challenges from the old factory
  const oldChallenges = await prisma.challenge.findMany({
    where: { factoryAddress: OLD_FACTORY },
    select: { id: true, challengeId: true, title: true },
  });
  console.log(`Found ${oldChallenges.length} challenges from old factory`);

  // Also find orphan challenges (null or empty factoryAddress)
  const orphanChallenges = await prisma.challenge.findMany({
    where: {
      OR: [{ factoryAddress: '' }],
    },
    select: { id: true, challengeId: true, title: true },
  });
  console.log(`Found ${orphanChallenges.length} orphan challenges`);

  const allIds = [
    ...oldChallenges.map((c) => c.id),
    ...orphanChallenges.map((c) => c.id),
  ];

  if (allIds.length > 0) {
    // Delete dependent records first (no cascade in schema)
    const deletedMessages = await prisma.message.deleteMany({
      where: { challengeId: { in: allIds } },
    });
    console.log(`Deleted ${deletedMessages.count} messages from old/orphan challenges`);

    const deletedActions = await prisma.agentAction.deleteMany({
      where: { challengeId: { in: allIds } },
    });
    console.log(`Deleted ${deletedActions.count} agent actions from old/orphan challenges`);

    // Now delete the challenges themselves
    const deletedChallenges = await prisma.challenge.deleteMany({
      where: { id: { in: allIds } },
    });
    console.log(`Deleted ${deletedChallenges.count} challenges`);
  } else {
    console.log('No challenges to delete');
  }

  // 2. Reset IndexerState to rescan from before the new challenge tx
  const existing = await prisma.indexerState.findUnique({
    where: { id: 'singleton' },
  });

  if (existing) {
    console.log(`\nCurrent IndexerState.lastBlockNumber: ${existing.lastBlockNumber}`);
    await prisma.indexerState.update({
      where: { id: 'singleton' },
      data: { lastBlockNumber: RESET_BLOCK },
    });
  } else {
    await prisma.indexerState.create({
      data: { id: 'singleton', lastBlockNumber: RESET_BLOCK },
    });
  }
  console.log(`Reset IndexerState.lastBlockNumber to ${RESET_BLOCK} (500 blocks before tx at ${NEW_CHALLENGE_BLOCK})`);

  console.log('\n--- Done. Restart the backend to trigger the indexer. ---');
}

main()
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
