import { config } from '@/config'

export const CONTRACT_ADDRESSES = {
  challengeFactory: config.contracts.challengeFactory,
  feeDistributor: config.contracts.feeDistributor,
  reputationOracle: config.contracts.reputationOracle,
  usdc: config.contracts.usdc,
} as const

export type ContractName = keyof typeof CONTRACT_ADDRESSES
