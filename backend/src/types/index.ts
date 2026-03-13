// Challenge status matching on-chain enum
export enum ChallengeStatus {
  Active = 'Active',
  Resolved = 'Resolved',
  Expired = 'Expired',
  Cancelled = 'Cancelled',
}

export enum PricingModel {
  Fixed = 'Fixed',
  Escalating = 'Escalating',
}

export enum EvaluationResult {
  Defended = 'Defended',
  Broken = 'Broken',
  Error = 'Error',
}

export enum Difficulty {
  Easy = 'Easy',
  Medium = 'Medium',
  Hard = 'Hard',
  Expert = 'Expert',
}

export enum ChallengeType {
  SecretExtraction = 'SecretExtraction',
  PersonaBreak = 'PersonaBreak',
  SystemPromptLeak = 'SystemPromptLeak',
  FunctionAbuse = 'FunctionAbuse',
  LogicManipulation = 'LogicManipulation',
  ContextPoisoning = 'ContextPoisoning',
  MultiTurnErosion = 'MultiTurnErosion',
  AgentEscape = 'AgentEscape',
  Custom = 'Custom',
}

// API response wrapper (matches existing pattern from errorHandler)
export interface ApiResponse<T = null> {
  success: boolean;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
  data: T;
}

// Challenge creation request
export interface CreateChallengeRequest {
  title: string;
  description: string;
  systemPrompt: string;
  aiModel?: string;
  basePrice: string; // USDC 6-decimal as string
  maxFee?: string;
  duration: number; // seconds
  growthRateBps?: number;
  pricingModel: PricingModel;
  seedAmount?: string;
  tags?: string[];
  difficulty?: Difficulty;
  challengeType?: ChallengeType;
  agentEndpoint?: string;
  agentName?: string;
  agentPersona?: string;
  agentStyle?: string;
  agentGreeting?: string;
  txHash: string; // on-chain creation tx
}

// Message submission request
export interface SubmitMessageRequest {
  content: string;
  txHash: string; // on-chain sendMessage tx
}

// Oracle signature response
export interface OracleSignatureData {
  signature: string;
  winner: string;
  attemptNumber: number;
  deadline: number;
  challengeId: string; // bytes32
  cloneAddress: string;
}

// AI evaluation types
export interface EvaluationRequest {
  systemPrompt: string;
  playerMessage: string;
  messageHistory: Array<{
    role: 'player' | 'ai';
    content: string;
  }>;
  aiModel: string;
  agentEndpoint?: string;
  agentName?: string;
  agentPersona?: string;
  agentStyle?: string;
}

export interface EvaluationResponse {
  broken: boolean;
  aiResponse: string;
  reason: string;
  attackType: string | null;
  owaspCategory: number | null;  // 1-10 mapping to OWASP LLM Top 10 2025
  severity: number | null;       // 1=Low, 2=Medium, 3=High, 4=Critical
  confidence: number;
}

// On-chain event types
export interface ChallengeCreatedEvent {
  challengeId: string;
  clone: string;
  defender: string;
  basePrice: bigint;
  duration: number;
  pricingModel: number;
  blockNumber: number;
  txHash: string;
}

export interface MessageSentEvent {
  challenge: string;
  player: string;
  fee: bigint;
  prizeShare: bigint;
  defenderShare: bigint;
  protocolShare: bigint;
  messageCount: number;
  blockNumber: number;
  txHash: string;
}
