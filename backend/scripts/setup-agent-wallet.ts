/**
 * One-time setup script: Create or retrieve the CDP agent wallet.
 *
 * This uses the CDP SDK's `getOrCreateAccount({ name })` which is
 * idempotent. The same name always returns the same wallet address,
 * persisted server-side by Coinbase.
 *
 * Prerequisites:
 *   Set these env vars (or add them to your .env):
 *     CDP_API_KEY_ID=your_key_id
 *     CDP_API_KEY_SECRET=your_key_secret
 *     CDP_WALLET_SECRET=your_wallet_secret
 *
 * Usage:
 *   bun run scripts/setup-agent-wallet.ts
 *
 * Output:
 *   Prints the agent wallet address. Add it to your .env as CDP_AGENT_ADDRESS
 *   and to your contract .env as AGENT_WALLET.
 */

import '../dotenv.ts';

async function main() {
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;
  const walletSecret = process.env.CDP_WALLET_SECRET;

  if (!apiKeyId || !apiKeySecret || !walletSecret) {
    console.error('Missing required env vars: CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET');
    console.error('Get these from https://portal.cdp.coinbase.com');
    process.exit(1);
  }

  console.log('Connecting to CDP...');

  // Dynamic import to avoid top-level errors if SDK not configured
  const { CdpClient } = await import('@coinbase/cdp-sdk');

  const cdp = new CdpClient({
    apiKeyId,
    apiKeySecret,
    walletSecret,
  });

  // getOrCreateAccount with a name is idempotent:
  // same name = same wallet address, every time, forever.
  const account = await cdp.evm.getOrCreateAccount({
    name: 'breakbase-agent',
  });

  console.log('');
  console.log('=== Agent Wallet Setup Complete ===');
  console.log('');
  console.log(`  Address: ${account.address}`);
  console.log('');
  console.log('Add to your backend .env:');
  console.log(`  CDP_AGENT_ADDRESS=${account.address}`);
  console.log('');
  console.log('Add to your contract .env:');
  console.log(`  AGENT_WALLET=${account.address}`);
  console.log('');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
