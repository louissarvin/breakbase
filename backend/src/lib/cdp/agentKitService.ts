/**
 * AgentKit Service
 *
 * Integrates Coinbase AgentKit with the BreakBase platform to provide
 * an AI agent with on-chain capabilities (wallet, ERC20, faucet) and
 * platform analytics tools. Uses Vercel AI SDK for LLM orchestration.
 *
 * Singleton pattern: call initAgentKit() once on startup.
 */

import {
  AgentKit,
  CdpEvmWalletProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  morphoActionProvider,
  compoundActionProvider,
  farcasterActionProvider,
  pythActionProvider,
  alloraActionProvider,
  wethActionProvider,
  basenameActionProvider,
} from "@coinbase/agentkit";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { prismaQuery } from "../prisma.ts";
import {
  USDC_ADDRESS,
  FEE_DISTRIBUTOR_ADDRESS,
  CHALLENGE_FACTORY_ADDRESS,
  GROQ_API_KEY,
  GOOGLE_AI_API_KEY,
  ANTHROPIC_API_KEY,
} from "../../config/main-config.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_PREFIX = "[AgentKit]";
const NETWORK_ID = "base-sepolia";
/**
 * Select the best available LLM for AgentKit reasoning.
 * AgentKit requires reliable multi-tool calling (20+ tools), so we
 * prioritize models with strong tool-use support:
 * Google Gemini (best tool calling) > Groq > Anthropic (fallback).
 */
function getAgentModel() {
  if (GOOGLE_AI_API_KEY) {
    const { createGoogleGenerativeAI } = require("@ai-sdk/google");
    return createGoogleGenerativeAI({ apiKey: GOOGLE_AI_API_KEY })("gemini-2.5-flash");
  }
  if (GROQ_API_KEY) {
    const { createGroq } = require("@ai-sdk/groq");
    return createGroq({ apiKey: GROQ_API_KEY })("llama-3.3-70b-versatile");
  }
  if (ANTHROPIC_API_KEY) {
    const { createAnthropic } = require("@ai-sdk/anthropic");
    return createAnthropic({ apiKey: ANTHROPIC_API_KEY })("claude-sonnet-4-20250514");
  }
  throw new Error("No AI provider configured. Set GOOGLE_GENERATIVE_AI_API_KEY, GROQ_API_KEY, or ANTHROPIC_API_KEY.");
}
const MAX_TOOL_STEPS = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentTaskResult {
  text: string;
  toolCalls: Array<{ toolName: string; args: unknown; result: string }>;
  steps: number;
  success: boolean;
}

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

let agentKit: AgentKit | null = null;
let walletAddress: string | null = null;
let initPromise: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// BigInt serialization helper
// ---------------------------------------------------------------------------

/**
 * Recursively converts BigInt values to strings so the result can be
 * safely JSON.stringify'd and returned to the LLM.
 */
function serializeBigInts(obj: unknown): unknown {
  if (typeof obj === "bigint") return obj.toString();
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(serializeBigInts);
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      out[key] = serializeBigInts(value);
    }
    return out;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Custom BreakBase tools (Vercel AI SDK tool() with zod v4 schemas)
// ---------------------------------------------------------------------------

const getProtocolAnalytics = tool({
  description:
    "Reads platform-wide analytics from the BreakBase database: total active challenges, total users, total messages, total prize pool, total fee distributions, and the agent wallet balance.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const [
        activeChallenges,
        totalUsers,
        totalMessages,
        prizePoolAgg,
        distributions,
      ] = await Promise.all([
        prismaQuery.challenge.count({ where: { status: "Active" } }),
        prismaQuery.user.count(),
        prismaQuery.message.count(),
        prismaQuery.challenge.aggregate({
          where: { status: "Active" },
          _sum: { prizePool: true },
        }),
        prismaQuery.agentAction.count({
          where: { actionType: "FeeDistribution", status: "Success" },
        }),
      ]);

      const result = {
        activeChallenges,
        totalUsers,
        totalMessages,
        totalPrizePoolWei: (prizePoolAgg._sum.prizePool ?? 0n).toString(),
        totalSuccessfulDistributions: distributions,
        network: NETWORK_ID,
        usdcAddress: USDC_ADDRESS,
        feeDistributorAddress: FEE_DISTRIBUTOR_ADDRESS,
        challengeFactoryAddress: CHALLENGE_FACTORY_ADDRESS,
      };

      return JSON.stringify(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${LOG_PREFIX} get_protocol_analytics failed:`, msg);
      return JSON.stringify({ error: `Failed to fetch protocol analytics: ${msg}` });
    }
  },
});

const analyzeChallengePerfomance = tool({
  description:
    "Reads detailed performance metrics for a specific challenge: message count, break rate, defend rate, attack type distribution, prize pool, and configuration.",
  inputSchema: z.object({
    challengeId: z.string().describe("The database ID of the challenge to analyze"),
  }),
  execute: async ({ challengeId }) => {
    try {
      const challenge = await prismaQuery.challenge.findUnique({
        where: { id: challengeId },
        include: {
          messages: {
            select: {
              evaluation: true,
              attackType: true,
              feePaid: true,
            },
          },
        },
      });

      if (!challenge) {
        return JSON.stringify({ error: `Challenge not found: ${challengeId}` });
      }

      const totalMessages = challenge.messages.length;
      const broken = challenge.messages.filter(
        (m: { evaluation: string }) => m.evaluation === "Broken",
      ).length;
      const defended = challenge.messages.filter(
        (m: { evaluation: string }) => m.evaluation === "Defended",
      ).length;
      const errors = challenge.messages.filter(
        (m: { evaluation: string }) => m.evaluation === "Error",
      ).length;

      // Attack type distribution
      const attackTypes: Record<string, number> = {};
      for (const msg of challenge.messages) {
        const t = msg.attackType ?? "unknown";
        attackTypes[t] = (attackTypes[t] ?? 0) + 1;
      }

      // Total fees collected
      const totalFees = challenge.messages.reduce(
        (sum: bigint, m: { feePaid: bigint }) => sum + m.feePaid,
        0n,
      );

      const result = serializeBigInts({
        challengeId: challenge.id,
        onChainId: challenge.challengeId,
        title: challenge.title,
        status: challenge.status,
        difficulty: challenge.difficulty,
        aiModel: challenge.aiModel,
        totalMessages,
        broken,
        defended,
        errors,
        breakRate: totalMessages > 0 ? ((broken / totalMessages) * 100).toFixed(1) + "%" : "0%",
        defenseRate: totalMessages > 0 ? ((defended / totalMessages) * 100).toFixed(1) + "%" : "0%",
        attackTypeDistribution: attackTypes,
        prizePool: challenge.prizePool,
        totalFeesCollected: totalFees,
        basePrice: challenge.basePrice,
        endTime: challenge.endTime.toISOString(),
        isExpired: challenge.endTime < new Date(),
        winnerAddress: challenge.winnerAddress,
      });

      return JSON.stringify(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${LOG_PREFIX} analyze_challenge_performance failed:`, msg);
      return JSON.stringify({ error: `Failed to analyze challenge: ${msg}` });
    }
  },
});

const getActiveChallengesSummary = tool({
  description:
    "Lists all currently active challenges with key metrics: title, difficulty, message count, prize pool, defense rate, and time remaining.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const challenges = await prismaQuery.challenge.findMany({
        where: { status: "Active" },
        include: {
          _count: { select: { messages: true } },
          messages: {
            select: { evaluation: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50, // Hard cap to prevent unbounded results
      });

      const now = new Date();

      const summaries = challenges.map((c: typeof challenges[number]) => {
        const total = c.messages.length;
        const defended = c.messages.filter((m: { evaluation: string }) => m.evaluation === "Defended").length;
        const defenseRate = total > 0 ? ((defended / total) * 100).toFixed(1) + "%" : "N/A";
        const timeRemainingMs = c.endTime.getTime() - now.getTime();
        const hoursRemaining = Math.max(0, Math.floor(timeRemainingMs / (1000 * 60 * 60)));
        const minutesRemaining = Math.max(0, Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60)));

        return serializeBigInts({
          id: c.id,
          onChainId: c.challengeId,
          title: c.title,
          difficulty: c.difficulty,
          messageCount: total,
          prizePool: c.prizePool,
          defenseRate,
          timeRemaining: `${hoursRemaining}h ${minutesRemaining}m`,
          isExpiringSoon: timeRemainingMs < 24 * 60 * 60 * 1000,
        });
      });

      return JSON.stringify({ activeChallenges: summaries, total: summaries.length });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${LOG_PREFIX} get_active_challenges_summary failed:`, msg);
      return JSON.stringify({ error: `Failed to fetch active challenges: ${msg}` });
    }
  },
});

const recommendAction = tool({
  description:
    "Provides contextual information and the current timestamp to help the agent reason about what action to recommend. Use this when you need to formulate a recommendation.",
  inputSchema: z.object({
    context: z.string().describe("The type of action or scenario to provide recommendations for"),
  }),
  execute: async ({ context }) => {
    const result = {
      timestamp: new Date().toISOString(),
      context,
      network: NETWORK_ID,
      availableActionTypes: [
        "FeeDistribution",
        "ChallengeSeeded",
        "PrizePoolSeeded",
        "AttestationCreated",
      ],
      contracts: {
        feeDistributor: FEE_DISTRIBUTOR_ADDRESS,
        challengeFactory: CHALLENGE_FACTORY_ADDRESS,
        usdc: USDC_ADDRESS,
      },
      note: "Analyze the data from other tools before making a recommendation. Consider participation rates, prize pools, time remaining, and overall platform health.",
    };

    return JSON.stringify(result);
  },
});

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  const lines = [
    "You are the BreakBase Protocol Agent, an AI-powered on-chain agent running on Base L2.",
    "You manage the BreakBase adversarial AI testing platform.",
    "You have access to on-chain tools (wallet, ERC20 transfers) and platform analytics tools.",
    "Analyze data before taking action. Be concise in your responses. Always explain your reasoning.",
    "",
    `Network: Base Sepolia`,
    `USDC address: ${USDC_ADDRESS}`,
    `FeeDistributor: ${FEE_DISTRIBUTOR_ADDRESS}`,
    `ChallengeFactory: ${CHALLENGE_FACTORY_ADDRESS}`,
    "",
    "## DeFi Treasury Management",
    "You can manage the protocol's idle USDC through DeFi yield strategies:",
    "- Compound V3 on Base Sepolia: Supply USDC to earn yield. Available assets: weth, usdc, wsteth.",
    "  Comet address: 0x571621Ce60Cebb0c1D442B5afb38B1663C6Bf017",
    "  Use `supply`, `withdraw`, `borrow`, `repay`, `get_portfolio` actions.",
    "- Morpho Vaults: Deposit into Morpho vaults for optimized yield.",
    "  Use `deposit` and `withdraw` actions.",
    "- Always check `get_portfolio` before making DeFi decisions.",
    "- Never deposit more than 50% of available USDC into any single protocol.",
    "- Prioritize capital preservation over yield.",
    "",
    "## Market Intelligence",
    "You have access to real-time market data:",
    "- Pyth: Fetch real-time price feeds for any token (ETH, BTC, USDC, etc.)",
    "  Use `fetch_price_feed` with a token symbol to get the latest price.",
    "- Allora: AI-powered market predictions and inference.",
    "  Use `get_all_topics` to see available prediction topics,",
    "  then `get_price_inference` for AI price predictions.",
    "- Always check current prices before making DeFi decisions.",
    "",
    "## Utility Actions",
    "- WETH: Wrap/unwrap ETH as needed for DeFi interactions.",
    "- Basenames: Register .basetest.eth names on Base Sepolia.",
  ];

  // Conditionally include Farcaster instructions
  if (process.env.NEYNAR_API_KEY && process.env.NEYNAR_MANAGER_SIGNER && process.env.AGENT_FID) {
    lines.push(
      "",
      "## Social Presence (Farcaster)",
      "You can post updates to Farcaster to engage the community:",
      "- Announce new high-value challenges created",
      "- Celebrate challenge breakers",
      "- Share weekly platform statistics",
      "- Keep posts concise and engaging (max 280 chars)",
      "- Use `post_cast` action. Include relevant links as embeds.",
    );
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the AgentKit singleton. Safe to call multiple times; only
 * the first invocation performs actual setup. Subsequent calls await
 * the same initialization promise.
 */
export async function initAgentKit(): Promise<void> {
  if (agentKit) return;
  if (initPromise) return initPromise;

  initPromise = _doInit();
  return initPromise;
}

async function _doInit(): Promise<void> {
  try {
    console.log(`${LOG_PREFIX} Initializing AgentKit on ${NETWORK_ID}...`);

    // CdpEvmWalletProvider reads CDP_API_KEY_ID, CDP_API_KEY_SECRET,
    // CDP_WALLET_SECRET from process.env automatically.
    // When CDP_AGENT_ADDRESS is set, it retrieves the existing wallet
    // instead of creating a new one on every cold start.
    const walletConfig: Record<string, string> = { networkId: NETWORK_ID };
    if (process.env.CDP_AGENT_ADDRESS) {
      walletConfig.address = process.env.CDP_AGENT_ADDRESS;
    }
    const walletProvider = await CdpEvmWalletProvider.configureWithWallet(walletConfig);

    const actionProviders: any[] = [
      walletActionProvider(),
      erc20ActionProvider(),
      cdpApiActionProvider(),
      morphoActionProvider(),
      compoundActionProvider(),
      pythActionProvider(),
      alloraActionProvider(),
      wethActionProvider(),
      basenameActionProvider(),
    ];

    // Conditionally add Farcaster if credentials are available
    if (process.env.NEYNAR_API_KEY && process.env.NEYNAR_MANAGER_SIGNER && process.env.AGENT_FID) {
      actionProviders.push(farcasterActionProvider());
    }

    agentKit = await AgentKit.from({
      walletProvider,
      actionProviders,
    });

    walletAddress = walletProvider.getAddress();
    console.log(`${LOG_PREFIX} Initialized. Wallet: ${walletAddress}`);
  } catch (error) {
    // Reset state so a future call can retry
    agentKit = null;
    walletAddress = null;
    initPromise = null;

    const msg = error instanceof Error ? error.message : String(error);
    console.error(`${LOG_PREFIX} Initialization failed: ${msg}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if AgentKit has been initialized and is ready to use.
 */
export function isAgentKitReady(): boolean {
  return agentKit !== null;
}

/**
 * Returns the smart wallet address managed by AgentKit.
 * Throws if AgentKit is not initialized.
 */
export async function getAgentKitWalletAddress(): Promise<string> {
  if (!agentKit || !walletAddress) {
    throw new Error(`${LOG_PREFIX} AgentKit is not initialized. Call initAgentKit() first.`);
  }
  return walletAddress;
}

// ---------------------------------------------------------------------------
// Merged toolset
// ---------------------------------------------------------------------------

function getMergedTools() {
  if (!agentKit) {
    throw new Error(`${LOG_PREFIX} AgentKit is not initialized.`);
  }

  // AgentKit built-in tools (wallet, erc20, cdp API)
  const agentKitTools = getVercelAITools(agentKit);

  // Custom BreakBase tools (defined with zod v4 via Vercel AI SDK tool())
  const breakbaseTools = {
    get_protocol_analytics: getProtocolAnalytics,
    analyze_challenge_performance: analyzeChallengePerfomance,
    get_active_challenges_summary: getActiveChallengesSummary,
    recommend_action: recommendAction,
  };

  return { ...agentKitTools, ...breakbaseTools };
}

// ---------------------------------------------------------------------------
// Core agent task runner
// ---------------------------------------------------------------------------

/**
 * Run an AI agent task with the full merged toolset.
 *
 * @param task - The user/system prompt describing the task
 * @param context - Optional additional context appended to the task
 * @returns AgentTaskResult with the text response, tool calls, and step count
 */
export async function runAgentTask(
  task: string,
  context?: string,
): Promise<AgentTaskResult> {
  if (!agentKit) {
    console.error(`${LOG_PREFIX} runAgentTask called before initialization.`);
    return {
      text: "AgentKit is not initialized. Please try again later.",
      toolCalls: [],
      steps: 0,
      success: false,
    };
  }

  const prompt = context ? `${task}\n\nAdditional context:\n${context}` : task;

  try {
    console.log(`${LOG_PREFIX} Running task: ${task.slice(0, 120)}...`);

    const allTools = getMergedTools();

    const result = await generateText({
      model: getAgentModel(),
      system: buildSystemPrompt(),
      tools: allTools,
      stopWhen: stepCountIs(MAX_TOOL_STEPS),
      prompt,
    });

    // Collect tool calls from all steps
    const allToolCalls: AgentTaskResult["toolCalls"] = [];
    for (const step of result.steps) {
      for (const tc of step.toolCalls) {
        allToolCalls.push({
          toolName: tc.toolName,
          args: tc.input,
          result: "",
        });
      }

      // Map tool results back to their calls within the same step
      for (const tr of step.toolResults) {
        const match = allToolCalls.find(
          (tc) => tc.toolName === tr.toolName && tc.result === "",
        );
        if (match) {
          match.result = typeof tr.output === "string"
            ? tr.output
            : JSON.stringify(serializeBigInts(tr.output));
        }
      }
    }

    console.log(
      `${LOG_PREFIX} Task complete. Steps: ${result.steps.length}, Tools called: ${allToolCalls.length}`,
    );

    return {
      text: result.text,
      toolCalls: allToolCalls,
      steps: result.steps.length,
      success: true,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`${LOG_PREFIX} runAgentTask failed: ${msg}`);
    return {
      text: `Agent task failed: ${msg}`,
      toolCalls: [],
      steps: 0,
      success: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Convenience analysis wrapper
// ---------------------------------------------------------------------------

const ANALYSIS_PROMPTS: Record<string, string> = {
  fee_distribution: [
    "Analyze the current protocol analytics and active challenges.",
    "Based on participation rates, prize pools, and challenge performance,",
    "recommend how fees should be distributed.",
    "Check the FeeDistributor USDC balance first.",
  ].join(" "),

  challenge_health: [
    "Analyze all active challenges.",
    "Identify which ones have low participation, which are about to expire,",
    "and recommend actions (extend, boost prize pool, create new ones).",
  ].join(" "),

  platform_overview: [
    "Generate a comprehensive platform health report:",
    "treasury balance, active challenges, user engagement,",
    "success rates, and recommendations.",
  ].join(" "),

  treasury_yield: [
    "Analyze the agent wallet's DeFi positions.",
    "Check Compound portfolio using get_portfolio.",
    "Recommend whether to supply more USDC for yield or withdraw for prize pool seeding.",
    "Report current positions and APY estimates.",
  ].join(" "),

  social_update: [
    "Compose and post a Farcaster update about recent platform activity.",
    "Include total challenges, recent winners, and platform highlights.",
    "Keep it engaging and under 280 characters.",
  ].join(" "),
};

/**
 * Run a predefined analysis task by type.
 *
 * @param analysisType - One of 'fee_distribution', 'challenge_health', 'platform_overview'
 * @returns The agent's text response
 */
export async function runAnalysis(
  analysisType: "fee_distribution" | "challenge_health" | "platform_overview" | "treasury_yield" | "social_update",
): Promise<string> {
  const prompt = ANALYSIS_PROMPTS[analysisType];
  if (!prompt) {
    return `Unknown analysis type: ${analysisType}`;
  }

  const result = await runAgentTask(prompt);
  return result.text;
}
