interface ContractAddresses {
  challengeFactory: `0x${string}`
  feeDistributor: `0x${string}`
  reputationOracle: `0x${string}`
  usdc: `0x${string}`
}

interface AppConfig {
  appName: string
  appDescription: string
  chainId: number
  apiUrl: string
  contracts: ContractAddresses
  links: {
    twitter: string
    github: string
    telegram: string
    discord: string
    docs: string
  }
  features: {
    smoothScroll: boolean
    dataMarketplace: boolean
    testSuite: boolean
    attestations: boolean
    emergencyWithdrawal: boolean
    prizePoolSeeding: boolean
    agentAnalysis: boolean
    x402Payments: boolean
    onchainAnalytics: boolean
  }
}

export const config: AppConfig = {
  appName: 'BreakBase',
  appDescription: 'AI adversarial testing platform on Base L2',
  chainId: 84532, // Base Sepolia

  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3700',

  contracts: {
    challengeFactory: '0x3C0A3Eb807Df9409979A5eCBD97DCb3B157bcC3B',
    feeDistributor: '0xCAcb144151DB5442caA05258673Faf6f1BB6Ba02',
    reputationOracle: '0xc671E09ED9cC6c4FeAA837A01370D65d8EC452B7',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },

  links: {
    twitter: 'https://x.com/breakbase',
    github: 'https://github.com/breakbase',
    telegram: 'https://t.me/breakbase',
    discord: 'https://discord.gg/breakbase',
    docs: 'https://docs.breakbase.xyz',
  },

  features: {
    smoothScroll: true,
    dataMarketplace: true,
    testSuite: true,
    attestations: true,
    emergencyWithdrawal: true,
    prizePoolSeeding: true,
    agentAnalysis: true,
    x402Payments: true,
    onchainAnalytics: true,
  },
}

export type Config = AppConfig
