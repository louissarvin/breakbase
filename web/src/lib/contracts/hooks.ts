import {
  useCallsStatus,
  useReadContract,
  useSendCalls,
  useWriteContract,
} from 'wagmi'
import { encodeFunctionData } from 'viem'
import type { Address } from 'viem'
import {
  challengeAbi,
  challengeFactoryAbi,
  erc20Abi,
  feeDistributorAbi,
  reputationOracleAbi,
} from '@/lib/contracts/abis'
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses'
import { config } from '@/config'

export function useChallengePrizePool(cloneAddress: Address | undefined) {
  return useReadContract({
    address: cloneAddress,
    abi: challengeAbi,
    functionName: 'prizePool',
    query: { enabled: !!cloneAddress, refetchInterval: 10_000 },
  })
}

export function useChallengeCurrentFee(cloneAddress: Address | undefined) {
  return useReadContract({
    address: cloneAddress,
    abi: challengeAbi,
    functionName: 'getCurrentFee',
    query: { enabled: !!cloneAddress, refetchInterval: 10_000 },
  })
}

export function useUSDCBalance(address: Address | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
}

export function useUSDCAllowance(
  owner: Address | undefined,
  spender: Address | undefined,
) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: erc20Abi,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !!owner && !!spender },
  })
}

export function useApproveUSDC() {
  const { mutate, mutateAsync, ...rest } = useWriteContract()
  return {
    approve: (spender: Address, amount: bigint) =>
      mutate({
        address: CONTRACT_ADDRESSES.usdc,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
      }),
    approveAsync: (spender: Address, amount: bigint) =>
      mutateAsync({
        address: CONTRACT_ADDRESSES.usdc,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
      }),
    ...rest,
  }
}

export function useCreateChallengeOnChain() {
  const { mutate, mutateAsync, ...rest } = useWriteContract()

  type ChallengeConfig = {
    defender: `0x${string}`
    usdc: `0x${string}`
    basePrice: bigint
    maxFee: bigint
    duration: number
    growthRateBps: number
    pricingModel: number
  }

  return {
    createChallenge: (
      challengeConfig: ChallengeConfig,
      seedAmount: bigint = 0n,
    ) =>
      mutate({
        address: CONTRACT_ADDRESSES.challengeFactory,
        abi: challengeFactoryAbi,
        functionName: 'createChallenge',
        args: [challengeConfig, seedAmount],
      }),
    createChallengeAsync: (
      challengeConfig: ChallengeConfig,
      seedAmount: bigint = 0n,
    ) =>
      mutateAsync({
        address: CONTRACT_ADDRESSES.challengeFactory,
        abi: challengeFactoryAbi,
        functionName: 'createChallenge',
        args: [challengeConfig, seedAmount],
      }),
    ...rest,
  }
}

export function useSendMessageOnChain(cloneAddress: Address | undefined) {
  const { mutate, mutateAsync, ...rest } = useWriteContract()
  return {
    sendMessage: () => {
      if (!cloneAddress) return
      mutate({
        address: cloneAddress,
        abi: challengeAbi,
        functionName: 'sendMessage',
      })
    },
    sendMessageAsync: () => {
      if (!cloneAddress) throw new Error('cloneAddress is required')
      return mutateAsync({
        address: cloneAddress,
        abi: challengeAbi,
        functionName: 'sendMessage',
      })
    },
    ...rest,
  }
}

export function useSendMessageWithPermit(cloneAddress: Address | undefined) {
  const { mutateAsync, ...rest } = useWriteContract()
  return {
    sendWithPermitAsync: (params: {
      deadline: bigint
      v: number
      r: `0x${string}`
      s: `0x${string}`
    }) => {
      if (!cloneAddress) throw new Error('cloneAddress is required')
      return mutateAsync({
        address: cloneAddress,
        abi: challengeAbi,
        functionName: 'sendMessageWithPermit',
        args: [params.deadline, params.v, params.r, params.s],
      })
    },
    ...rest,
  }
}

// Emergency withdrawal

export function useEmergencyRequestedAt(challengeAddress: `0x${string}`) {
  return useReadContract({
    address: challengeAddress,
    abi: challengeAbi,
    functionName: 'emergencyRequestedAt',
  })
}

export function useRequestEmergencyWithdrawal(
  _challengeAddress: `0x${string}`,
) {
  return useWriteContract()
}

export function useExecuteEmergencyWithdrawal(
  _challengeAddress: `0x${string}`,
) {
  return useWriteContract()
}

export function useCancelEmergencyWithdrawal(_challengeAddress: `0x${string}`) {
  return useWriteContract()
}

export function useEmergencyTimelock(challengeAddress: `0x${string}`) {
  return useReadContract({
    address: challengeAddress,
    abi: challengeAbi,
    functionName: 'EMERGENCY_TIMELOCK',
  })
}

// Prize pool seeding

export function useSeedPrizePool() {
  return useWriteContract()
}

// Cancel challenge

export function useCancelChallenge() {
  return useWriteContract()
}

// FeeDistributor reads

export function useFeeDistributorStats() {
  const totalCollected = useReadContract({
    address: config.contracts.feeDistributor,
    abi: feeDistributorAbi,
    functionName: 'totalCollected',
  })
  const totalDistributed = useReadContract({
    address: config.contracts.feeDistributor,
    abi: feeDistributorAbi,
    functionName: 'totalDistributed',
  })
  const agentWallet = useReadContract({
    address: config.contracts.feeDistributor,
    abi: feeDistributorAbi,
    functionName: 'agentWallet',
  })
  return { totalCollected, totalDistributed, agentWallet }
}

// ReputationOracle reads

export function useReputationSchemas() {
  const attackerSchema = useReadContract({
    address: config.contracts.reputationOracle,
    abi: reputationOracleAbi,
    functionName: 'attackerSchemaId',
  })
  const defenderSchema = useReadContract({
    address: config.contracts.reputationOracle,
    abi: reputationOracleAbi,
    functionName: 'defenderSchemaId',
  })
  const auditSchema = useReadContract({
    address: config.contracts.reputationOracle,
    abi: reputationOracleAbi,
    functionName: 'auditSchemaId',
  })
  return { attackerSchema, defenderSchema, auditSchema }
}

// EIP-5792 batch + paymaster hooks

type ChallengeConfig = {
  defender: `0x${string}`
  usdc: `0x${string}`
  basePrice: bigint
  maxFee: bigint
  duration: number
  growthRateBps: number
  pricingModel: number
}

type PaymasterCapabilities = Record<string, unknown>

export function useApproveAndSendMessage() {
  const { sendCallsAsync, ...rest } = useSendCalls()

  return {
    sendWithApproval: (params: {
      challengeAddress: `0x${string}`
      fee: bigint
      capabilities?: PaymasterCapabilities
    }) =>
      sendCallsAsync({
        calls: [
          {
            to: config.contracts.usdc,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [params.challengeAddress, params.fee],
            }),
          },
          {
            to: params.challengeAddress,
            data: encodeFunctionData({
              abi: challengeAbi,
              functionName: 'sendMessage',
              args: [],
            }),
          },
        ],
        capabilities: params.capabilities,
      }),
    ...rest,
  }
}

export function useApproveAndCreateChallenge() {
  const { sendCallsAsync, ...rest } = useSendCalls()

  return {
    createWithApproval: (params: {
      approvalAmount: bigint
      seedAmount: bigint
      factoryAddress: `0x${string}`
      challengeConfig: ChallengeConfig
      capabilities?: PaymasterCapabilities
    }) =>
      sendCallsAsync({
        calls: [
          {
            to: config.contracts.usdc,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [params.factoryAddress, params.approvalAmount],
            }),
          },
          {
            to: params.factoryAddress,
            data: encodeFunctionData({
              abi: challengeFactoryAbi,
              functionName: 'createChallenge',
              args: [params.challengeConfig, params.seedAmount],
            }),
          },
        ],
        capabilities: params.capabilities,
      }),
    ...rest,
  }
}

export function useApproveAndSeedPrizePool() {
  const { sendCallsAsync, ...rest } = useSendCalls()

  return {
    seedWithApproval: (params: {
      challengeAddress: `0x${string}`
      amount: bigint
      capabilities?: PaymasterCapabilities
    }) =>
      sendCallsAsync({
        calls: [
          {
            to: config.contracts.usdc,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [params.challengeAddress, params.amount],
            }),
          },
          {
            to: params.challengeAddress,
            data: encodeFunctionData({
              abi: challengeAbi,
              functionName: 'seedPrizePool',
              args: [params.amount],
            }),
          },
        ],
        capabilities: params.capabilities,
      }),
    ...rest,
  }
}

export function useResolveChallenge() {
  const { writeContractAsync } = useWriteContract()

  return {
    resolveAsync: (
      cloneAddress: string,
      winner: string,
      attemptNumber: number,
      deadline: number,
      signature: string,
    ) =>
      writeContractAsync({
        address: cloneAddress as `0x${string}`,
        abi: challengeAbi,
        functionName: 'resolveChallenge',
        args: [
          winner as `0x${string}`,
          winner as `0x${string}`,
          BigInt(attemptNumber),
          BigInt(deadline),
          signature as `0x${string}`,
        ],
      }),
  }
}

export function useListingFee() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.challengeFactory,
    abi: challengeFactoryAbi,
    functionName: 'listingFee',
  })
}

export function useFactoryPaused() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.challengeFactory,
    abi: challengeFactoryAbi,
    functionName: 'paused',
  })
}

export function useFeeDistribution(cloneAddress: Address | undefined) {
  const feePool = useReadContract({
    address: cloneAddress,
    abi: challengeAbi,
    functionName: 'FEE_POOL_BPS',
    query: { enabled: !!cloneAddress },
  })
  const feeDefender = useReadContract({
    address: cloneAddress,
    abi: challengeAbi,
    functionName: 'FEE_DEFENDER_BPS',
    query: { enabled: !!cloneAddress },
  })
  const feeProtocol = useReadContract({
    address: cloneAddress,
    abi: challengeAbi,
    functionName: 'FEE_PROTOCOL_BPS',
    query: { enabled: !!cloneAddress },
  })
  return { feePool, feeDefender, feeProtocol }
}

export function useCallsTracker(callsId: string | undefined) {
  return useCallsStatus({
    id: callsId as string,
    query: {
      enabled: !!callsId,
      refetchInterval: (query) =>
        query.state.data?.status === 'success' ? false : 1000,
    },
  })
}
