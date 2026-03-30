/**
 * x402 Bazaar Discovery Metadata
 *
 * Provides structured metadata for each x402-gated endpoint so AI agents
 * can discover, understand, and pay for BreakBase APIs autonomously.
 *
 * The Bazaar is a discovery layer built on x402 extensions. Metadata is
 * embedded in each route's config via the `extensions` field, and the
 * facilitator auto-catalogs the service. No separate registration needed.
 */

interface BazaarEndpointMeta {
  /** Human-readable name of this API */
  name: string;
  /** What this endpoint returns */
  description: string;
  /** Input schema (JSON Schema subset) */
  inputSchema?: Record<string, unknown>;
  /** Example output */
  outputExample?: Record<string, unknown>;
  /** Tags for search/categorization */
  tags?: string[];
}

/**
 * Build a Bazaar discovery extension object for an x402-gated route.
 */
export function buildBazaarExtension(meta: BazaarEndpointMeta): Record<string, unknown> {
  return {
    bazaar: {
      name: meta.name,
      description: meta.description,
      ...(meta.inputSchema ? { inputSchema: meta.inputSchema } : {}),
      ...(meta.outputExample ? { output: { example: meta.outputExample } } : {}),
      ...(meta.tags ? { tags: meta.tags } : {}),
      provider: 'BreakBase',
      category: 'ai-security',
    },
  };
}

// ---------------------------------------------------------------------------
// Pre-built metadata for each BreakBase x402 endpoint
// ---------------------------------------------------------------------------

export const BAZAAR_CHALLENGE_INSIGHTS = buildBazaarExtension({
  name: 'BreakBase Challenge Insights',
  description:
    'AI evaluation analytics for a specific adversarial challenge: attack distribution, defense rate, evaluation history.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Challenge ID or clone contract address' },
    },
    required: ['id'],
  },
  outputExample: {
    success: true,
    data: {
      challenge: { title: 'SQL Injection Defense', difficulty: 'Hard', status: 'Active' },
      insights: { evaluationStats: { total: 42, broken: 5, defended: 37 }, defenseRate: 88.1 },
    },
  },
  tags: ['ai-security', 'challenge', 'evaluation', 'analytics'],
});

export const BAZAAR_PLATFORM_STATS = buildBazaarExtension({
  name: 'BreakBase Platform Statistics',
  description:
    'Aggregate platform statistics: total challenges, messages, USDC volume, defense rates by OWASP category.',
  outputExample: {
    success: true,
    data: { totalChallenges: 150, totalMessages: 5000, defenseRate: 78.5 },
  },
  tags: ['ai-security', 'statistics', 'aggregate', 'owasp'],
});

export const BAZAAR_ATTACK_DATA = buildBazaarExtension({
  name: 'BreakBase Attack Patterns',
  description:
    'Attack type distribution and success rates for a specific OWASP LLM Top 10 category.',
  inputSchema: {
    type: 'object',
    properties: {
      owaspCategory: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        description: 'OWASP LLM Top 10 category number',
      },
    },
    required: ['owaspCategory'],
  },
  outputExample: {
    success: true,
    data: { category: 'Prompt Injection', totalAttacks: 200, successRate: 12.5 },
  },
  tags: ['ai-security', 'attacks', 'owasp', 'patterns'],
});

export const BAZAAR_MODEL_DATA = buildBazaarExtension({
  name: 'BreakBase Model Comparison',
  description:
    'Per-model defense rates and security scores across all AI models tested on the platform.',
  outputExample: {
    success: true,
    data: { models: [{ model: 'claude-sonnet', defenseRate: 92.3, challenges: 45 }] },
  },
  tags: ['ai-security', 'models', 'comparison', 'benchmarks'],
});

export const BAZAAR_TREND_DATA = buildBazaarExtension({
  name: 'BreakBase Security Trends',
  description:
    'Daily time-series data for challenge creation, attack volume, and defense rates over the last 30 days.',
  outputExample: {
    success: true,
    data: { days: [{ date: '2026-04-01', challenges: 5, attacks: 120, defenseRate: 80.2 }] },
  },
  tags: ['ai-security', 'trends', 'time-series', 'analytics'],
});

export const BAZAAR_TEST_SUITE = buildBazaarExtension({
  name: 'BreakBase Attack Battery',
  description:
    'Run an automated 40-prompt attack battery against any AI system prompt. Returns security score, OWASP coverage, and vulnerability report.',
  inputSchema: {
    type: 'object',
    properties: {
      systemPrompt: { type: 'string', description: 'The AI system prompt to test (1-10000 chars)' },
      aiModel: { type: 'string', description: 'AI model to test against (optional)' },
      categories: {
        type: 'array',
        items: { type: 'integer' },
        description: 'OWASP categories to test (1-10)',
      },
      maxPrompts: { type: 'integer', description: 'Max prompts to run (1-100)' },
    },
    required: ['systemPrompt'],
  },
  outputExample: {
    success: true,
    data: { securityScore: 75, totalTests: 40, failures: 10, owaspCoverage: '7/10' },
  },
  tags: ['ai-security', 'testing', 'automated', 'owasp', 'vulnerability'],
});

export const BAZAAR_ONCHAIN_CHALLENGES = buildBazaarExtension({
  name: 'BreakBase On-chain Challenges',
  description: 'Recent ChallengeCreated events from the Base blockchain via CDP SQL analytics.',
  outputExample: {
    success: true,
    data: { challenges: [{ challengeId: '0x...', creator: '0x...', prizePool: '1000000' }] },
  },
  tags: ['onchain', 'challenges', 'base', 'events'],
});

export const BAZAAR_ONCHAIN_VOLUME = buildBazaarExtension({
  name: 'BreakBase USDC Volume',
  description: 'USDC transfer volume for a specific contract address on Base.',
  inputSchema: {
    type: 'object',
    properties: {
      address: { type: 'string', description: 'Contract address (0x...)' },
    },
    required: ['address'],
  },
  tags: ['onchain', 'usdc', 'volume', 'base'],
});

export const BAZAAR_ONCHAIN_ACTIVITY = buildBazaarExtension({
  name: 'BreakBase Contract Activity',
  description: 'Transaction count and gas usage for a contract address on Base.',
  inputSchema: {
    type: 'object',
    properties: {
      address: { type: 'string', description: 'Contract address (0x...)' },
    },
    required: ['address'],
  },
  tags: ['onchain', 'activity', 'transactions', 'gas'],
});
