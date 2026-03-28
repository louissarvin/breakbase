/**
 * CDP Webhook Manager
 *
 * Manages webhook subscriptions via the CDP API.
 * Used to register/update webhook subscriptions for on-chain events.
 */
import {
  CDP_API_KEY_ID,
  CDP_API_KEY_SECRET,
  CHALLENGE_FACTORY_ADDRESS,
  USDC_ADDRESS,
} from '../../config/main-config.ts';

const LOG_PREFIX = '[WebhookManager]';

// The CDP SDK typed webhook wrapper only supports wallet events.
// For onchain.activity.detected, we'd need to use the raw REST API.
// For the hackathon, we document this and use the webhook receiver for
// manually configured subscriptions.

export interface WebhookSubscription {
  id: string;
  description: string;
  eventTypes: string[];
  url: string;
  isEnabled: boolean;
}

/**
 * Check if webhook management is possible (CDP configured).
 */
export function isWebhookConfigurable(): boolean {
  return Boolean(CDP_API_KEY_ID && CDP_API_KEY_SECRET);
}

/**
 * Get info about what webhooks should be configured for BreakBase.
 * This is a helper for documentation/setup purposes.
 */
export function getRecommendedWebhooks(baseUrl: string): Array<{
  description: string;
  eventTypes: string[];
  url: string;
  labels: Record<string, string>;
}> {
  const webhookUrl = `${baseUrl}/webhooks/cdp`;

  return [
    {
      description: 'ChallengeFactory events (ChallengeCreated)',
      eventTypes: ['onchain.activity.detected'],
      url: webhookUrl,
      labels: {
        network: 'base-sepolia',
        contract_address: CHALLENGE_FACTORY_ADDRESS || '<set CHALLENGE_FACTORY_ADDRESS>',
        event_name: 'ChallengeCreated',
      },
    },
    {
      description: 'USDC Transfer events',
      eventTypes: ['onchain.activity.detected'],
      url: webhookUrl,
      labels: {
        network: 'base-sepolia',
        contract_address: USDC_ADDRESS,
        event_name: 'Transfer',
      },
    },
  ];
}
