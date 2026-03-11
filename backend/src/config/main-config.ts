/**
 * Centralized configuration for the application
 * All commonly used environment variables should be defined here
 */

// Validate required environment variables on startup
const requiredEnvVars: string[] = [
  'DATABASE_URL',
  'JWT_SECRET',
  'RPC_URL',
  'ORACLE_PRIVATE_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`FATAL: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Warn about optional but important contract addresses
const recommendedEnvVars = ['CHALLENGE_FACTORY_ADDRESS', 'FEE_DISTRIBUTOR_ADDRESS'];
for (const envVar of recommendedEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`WARNING: ${envVar} is not set. On-chain features will be limited.`);
  }
}

// App Configuration
export const APP_PORT: number = Number(process.env.APP_PORT) || 3700;
export const NODE_ENV: string = process.env.NODE_ENV || 'development';
export const IS_DEV: boolean = NODE_ENV === 'development';
export const IS_PROD: boolean = NODE_ENV === 'production';

// Database
export const DATABASE_URL: string = process.env.DATABASE_URL as string;

// Authentication
export const JWT_SECRET: string = process.env.JWT_SECRET as string;
export const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

// ---- Chain / RPC ----
export const CHAIN_ID: number = Number(process.env.CHAIN_ID) || 84532;
export const RPC_URL: string = process.env.RPC_URL || 'https://sepolia.base.org';

// ---- Oracle ----
export const ORACLE_PRIVATE_KEY: string = process.env.ORACLE_PRIVATE_KEY as string;

// ---- Contract Addresses (Base Sepolia) ----
export const CHALLENGE_FACTORY_ADDRESS: string = process.env.CHALLENGE_FACTORY_ADDRESS as string;
export const FEE_DISTRIBUTOR_ADDRESS: string = process.env.FEE_DISTRIBUTOR_ADDRESS as string;
export const REPUTATION_ORACLE_ADDRESS: string = process.env.REPUTATION_ORACLE_ADDRESS || '';
export const USDC_ADDRESS: string = process.env.USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
export const EAS_ADDRESS: string = process.env.EAS_ADDRESS || '0x4200000000000000000000000000000000000021';

// ---- EAS Attestation Schemas ----
export const SCHEMA_REGISTRY_ADDRESS: string = process.env.SCHEMA_REGISTRY_ADDRESS || '0x4200000000000000000000000000000000000020';
export const ATTACKER_SCHEMA_UID: string = process.env.ATTACKER_SCHEMA_UID || '';
export const DEFENDER_SCHEMA_UID: string = process.env.DEFENDER_SCHEMA_UID || '';
export const AUDIT_SCHEMA_UID: string = process.env.AUDIT_SCHEMA_UID || '';

// ---- LLM / AI ----
export const ANTHROPIC_API_KEY: string = process.env.ANTHROPIC_API_KEY || '';
export const OPENAI_API_KEY: string = process.env.OPENAI_API_KEY || '';
export const GOOGLE_AI_API_KEY: string = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
export const TOGETHER_API_KEY: string = process.env.TOGETHER_API_KEY || '';
export const GROQ_API_KEY: string = process.env.GROQ_API_KEY || '';
export const DEFAULT_AI_MODEL: string = process.env.DEFAULT_AI_MODEL || 'anthropic:claude-sonnet-4-20250514';
export const JUDGE_AI_MODEL: string = process.env.JUDGE_AI_MODEL || '';

// ---- App URLs ----
export const APP_URL: string = process.env.APP_URL || 'http://localhost:3000';
export const API_URL: string = process.env.API_URL || 'http://localhost:3700';

// ---- Coinbase CDP ----
export const CDP_API_KEY_ID: string = process.env.CDP_API_KEY_ID || '';
export const CDP_API_KEY_SECRET: string = process.env.CDP_API_KEY_SECRET || '';
export const CDP_WALLET_SECRET: string = process.env.CDP_WALLET_SECRET || '';
export const CDP_AGENT_ADDRESS: string = process.env.CDP_AGENT_ADDRESS || '';
export const CDP_PAYMASTER_URL: string = process.env.CDP_PAYMASTER_URL ||
  (CDP_API_KEY_ID ? `https://api.developer.coinbase.com/rpc/v1/base-sepolia/${CDP_API_KEY_ID}` : '');

// ---- CDP Webhooks ----
export const CDP_WEBHOOK_SECRET: string = process.env.CDP_WEBHOOK_SECRET || '';

// ---- Workers ----
export const EVENT_INDEXER_INTERVAL_MS: number = Number(process.env.EVENT_INDEXER_INTERVAL_MS) || 15000;
export const PROTOCOL_AGENT_INTERVAL: string = process.env.PROTOCOL_AGENT_INTERVAL || '*/10 * * * *';
export const CHALLENGE_EXPIRY_CHECK_INTERVAL: string = process.env.CHALLENGE_EXPIRY_CHECK_INTERVAL || '*/5 * * * *';

// ---- Oracle Signing ----
export const ORACLE_SIGNATURE_DEADLINE_SECONDS: number = Number(process.env.ORACLE_SIGNATURE_DEADLINE_SECONDS) || 3600;

// ---- Coinbase Verification ----
export const CB_VERIFIED_SCHEMA_UID: string = process.env.CB_VERIFIED_SCHEMA_UID || '0x2f34a2ffe5f87b2f45fbc7c784896b768d77261e2f24f77341ae43751c765a69';
export const CB_ATTESTER_ADDRESS: string = process.env.CB_ATTESTER_ADDRESS || '0xB5644397a9733f86Cacd928478B29b4cD6041C45';
export const EAS_GRAPHQL_URL: string = process.env.EAS_GRAPHQL_URL || 'https://base-sepolia.easscan.org/graphql';

// ---- x402 Payment Protocol ----
export const X402_FACILITATOR_URL: string = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';
export const X402_PAY_TO_ADDRESS: string = process.env.X402_PAY_TO_ADDRESS || process.env.CDP_AGENT_ADDRESS || '';

// ---- Farcaster ----
export const NEYNAR_API_KEY: string = process.env.NEYNAR_API_KEY || '';
export const NEYNAR_MANAGER_SIGNER: string = process.env.NEYNAR_MANAGER_SIGNER || '';
export const AGENT_FID: string = process.env.AGENT_FID || '';
export const FARCASTER_HEADER: string = process.env.FARCASTER_HEADER || '';
export const FARCASTER_PAYLOAD: string = process.env.FARCASTER_PAYLOAD || '';
export const FARCASTER_SIGNATURE: string = process.env.FARCASTER_SIGNATURE || '';

// ---- Builder Code (ERC-8021) ----
export const BUILDER_CODE: string = process.env.BUILDER_CODE || 'breakbase';

// ---- Agent Chat ----
export const AGENT_CHAT_FEE_USDC: string = process.env.AGENT_CHAT_FEE_USDC || '0.10'; // $0.10 per message

// Error Log Configuration
export const ERROR_LOG_MAX_RECORDS: number = 10000;
export const ERROR_LOG_CLEANUP_INTERVAL: string = '0 * * * *'; // Every hour

// Export all as default object for convenience
export default {
  APP_PORT,
  NODE_ENV,
  IS_DEV,
  IS_PROD,
  DATABASE_URL,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  CHAIN_ID,
  RPC_URL,
  ORACLE_PRIVATE_KEY,
  CHALLENGE_FACTORY_ADDRESS,
  FEE_DISTRIBUTOR_ADDRESS,
  REPUTATION_ORACLE_ADDRESS,
  USDC_ADDRESS,
  EAS_ADDRESS,
  SCHEMA_REGISTRY_ADDRESS,
  ATTACKER_SCHEMA_UID,
  DEFENDER_SCHEMA_UID,
  AUDIT_SCHEMA_UID,
  ANTHROPIC_API_KEY,
  OPENAI_API_KEY,
  GOOGLE_AI_API_KEY,
  TOGETHER_API_KEY,
  GROQ_API_KEY,
  DEFAULT_AI_MODEL,
  JUDGE_AI_MODEL,
  APP_URL,
  API_URL,
  CDP_API_KEY_ID,
  CDP_API_KEY_SECRET,
  CDP_WALLET_SECRET,
  CDP_PAYMASTER_URL,
  CDP_WEBHOOK_SECRET,
  CB_VERIFIED_SCHEMA_UID,
  CB_ATTESTER_ADDRESS,
  EAS_GRAPHQL_URL,
  X402_FACILITATOR_URL,
  X402_PAY_TO_ADDRESS,
  NEYNAR_API_KEY,
  NEYNAR_MANAGER_SIGNER,
  AGENT_FID,
  FARCASTER_HEADER,
  FARCASTER_PAYLOAD,
  FARCASTER_SIGNATURE,
  BUILDER_CODE,
  AGENT_CHAT_FEE_USDC,
  EVENT_INDEXER_INTERVAL_MS,
  PROTOCOL_AGENT_INTERVAL,
  CHALLENGE_EXPIRY_CHECK_INTERVAL,
  ORACLE_SIGNATURE_DEADLINE_SECONDS,
  ERROR_LOG_MAX_RECORDS,
  ERROR_LOG_CLEANUP_INTERVAL,
};
