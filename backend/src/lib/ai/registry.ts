/**
 * Multi-LLM Provider Registry
 *
 * Uses the Vercel AI SDK to provide a unified interface for multiple LLM
 * providers. Only providers with configured API keys are registered.
 *
 * Priority order: Groq > Google > OpenAI > Together > Anthropic (fallback)
 */

import { experimental_createProviderRegistry as createProviderRegistry } from 'ai';
import {
  ANTHROPIC_API_KEY,
  OPENAI_API_KEY,
  GOOGLE_AI_API_KEY,
  TOGETHER_API_KEY,
  GROQ_API_KEY,
} from '../../config/main-config.ts';

// ---------------------------------------------------------------------------
// Provider registry (lazy singleton)
// ---------------------------------------------------------------------------

let _registry: ReturnType<typeof createProviderRegistry> | null = null;

function buildRegistry(): ReturnType<typeof createProviderRegistry> {
  const providers: Record<string, any> = {};

  if (GROQ_API_KEY) {
    try {
      const { createGroq } = require('@ai-sdk/groq');
      providers.groq = createGroq({ apiKey: GROQ_API_KEY });
    } catch {
      console.warn('[AIRegistry] @ai-sdk/groq not installed, skipping Groq provider');
    }
  }

  if (GOOGLE_AI_API_KEY) {
    try {
      const { createGoogleGenerativeAI } = require('@ai-sdk/google');
      providers.google = createGoogleGenerativeAI({ apiKey: GOOGLE_AI_API_KEY });
    } catch {
      console.warn('[AIRegistry] @ai-sdk/google not installed, skipping Google provider');
    }
  }

  if (OPENAI_API_KEY) {
    try {
      const { createOpenAI } = require('@ai-sdk/openai');
      providers.openai = createOpenAI({ apiKey: OPENAI_API_KEY });
    } catch {
      console.warn('[AIRegistry] @ai-sdk/openai not installed, skipping OpenAI provider');
    }
  }

  if (TOGETHER_API_KEY) {
    try {
      const { createTogetherAI } = require('@ai-sdk/togetherai');
      providers.togetherai = createTogetherAI({ apiKey: TOGETHER_API_KEY });
    } catch {
      console.warn('[AIRegistry] @ai-sdk/togetherai not installed, skipping Together AI provider');
    }
  }

  if (ANTHROPIC_API_KEY) {
    try {
      const { createAnthropic } = require('@ai-sdk/anthropic');
      providers.anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });
    } catch {
      console.warn('[AIRegistry] @ai-sdk/anthropic not installed, skipping Anthropic provider');
    }
  }

  return createProviderRegistry(providers);
}

export function getRegistry(): ReturnType<typeof createProviderRegistry> {
  if (!_registry) {
    _registry = buildRegistry();
  }
  return _registry;
}

// ---------------------------------------------------------------------------
// Model catalog
// ---------------------------------------------------------------------------

export interface ModelInfo {
  id: string;           // provider:modelId format
  displayName: string;
  provider: string;
  contextWindow?: number;
}

export const SUPPORTED_MODELS: ModelInfo[] = [
  // Groq (fastest, free tier available)
  { id: 'groq:llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B (Groq)', provider: 'groq', contextWindow: 128000 },
  { id: 'groq:llama-3.1-8b-instant', displayName: 'Llama 3.1 8B (Groq)', provider: 'groq', contextWindow: 128000 },
  { id: 'groq:gemma2-9b-it', displayName: 'Gemma 2 9B (Groq)', provider: 'groq', contextWindow: 8192 },
  // Google
  { id: 'google:gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', provider: 'google', contextWindow: 1000000 },
  // OpenAI
  { id: 'openai:gpt-4o', displayName: 'GPT-4o', provider: 'openai', contextWindow: 128000 },
  { id: 'openai:gpt-4.1-mini', displayName: 'GPT-4.1 Mini', provider: 'openai', contextWindow: 1000000 },
  // Together
  { id: 'togetherai:meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', displayName: 'Llama 4 Maverick', provider: 'togetherai', contextWindow: 128000 },
  // Anthropic (fallback)
  { id: 'anthropic:claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4', provider: 'anthropic', contextWindow: 200000 },
  { id: 'anthropic:claude-haiku-4-5', displayName: 'Claude Haiku 4.5', provider: 'anthropic', contextWindow: 200000 },
];

/**
 * Returns only models whose provider has a configured API key.
 */
export function getAvailableModels(): ModelInfo[] {
  const available = new Set<string>();
  if (GROQ_API_KEY) available.add('groq');
  if (GOOGLE_AI_API_KEY) available.add('google');
  if (OPENAI_API_KEY) available.add('openai');
  if (TOGETHER_API_KEY) available.add('togetherai');
  if (ANTHROPIC_API_KEY) available.add('anthropic');

  return SUPPORTED_MODELS.filter((m) => available.has(m.provider));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize legacy model names (e.g., "claude-sonnet-4-20250514")
 * to registry format ("anthropic:claude-sonnet-4-20250514").
 */
export function normalizeModelId(aiModel: string): string {
  if (aiModel.includes(':')) return aiModel;
  if (aiModel.startsWith('claude')) return `anthropic:${aiModel}`;
  if (aiModel.startsWith('llama')) return `groq:${aiModel}`;
  if (aiModel.startsWith('gemini')) return `google:${aiModel}`;
  if (aiModel.startsWith('gpt')) return `openai:${aiModel}`;
  return `groq:${aiModel}`;
}

/**
 * Extract the provider name from a registry model ID.
 */
export function getProviderName(registryId: string): string {
  const colonIndex = registryId.indexOf(':');
  return colonIndex > 0 ? registryId.slice(0, colonIndex) : 'groq';
}

/**
 * Get a judge model that uses a DIFFERENT provider than the target model.
 * Priority: Groq > Google > OpenAI > Anthropic.
 */
export function getJudgeModel(targetModel: string): string {
  const targetProvider = getProviderName(targetModel);

  // Ordered by cost-effectiveness: Groq (free/cheap) > Google > OpenAI > Anthropic
  const candidates: Array<{ provider: string; model: string; key: string }> = [
    { provider: 'groq', model: 'groq:llama-3.3-70b-versatile', key: GROQ_API_KEY },
    { provider: 'google', model: 'google:gemini-2.5-flash', key: GOOGLE_AI_API_KEY },
    { provider: 'openai', model: 'openai:gpt-4o', key: OPENAI_API_KEY },
    { provider: 'anthropic', model: 'anthropic:claude-haiku-4-5', key: ANTHROPIC_API_KEY },
  ];

  // First pass: pick a different provider
  for (const c of candidates) {
    if (c.provider !== targetProvider && c.key) return c.model;
  }

  // Second pass: any provider with a key (same provider, different model)
  for (const c of candidates) {
    if (c.key) return c.model;
  }

  return 'groq:llama-3.3-70b-versatile';
}
