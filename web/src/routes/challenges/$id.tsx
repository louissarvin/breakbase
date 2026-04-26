import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  BarChart2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  ExternalLink,
  Info,
  MessageSquare,
  Send,
  Shield,
  Sprout,
  Tag,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react'
import {
  Button,
  Input,
  Skeleton,
  Spinner,
  Textarea,
  Tooltip,
} from '@heroui/react'
import { useAccount, useSignTypedData } from 'wagmi'
import { getCallsStatus, waitForTransactionReceipt } from 'wagmi/actions'
import type { Address } from 'viem'
import type { MessageEntry } from '@/lib/api/hooks'
import { wagmiConfig } from '@/lib/wagmi'
import { cnm } from '@/utils/style'
import GlassCard from '@/components/GlassCard'
import StatusBadge from '@/components/StatusBadge'
import CountdownTimer from '@/components/CountdownTimer'
import {
  useBasename,
  useChallenge,
  useSendMessage,
  useX402ChallengeInsights,
} from '@/lib/api/hooks'
import {
  useApproveAndSeedPrizePool,
  useApproveAndSendMessage,
  useApproveUSDC,
  useCallsTracker,
  useCancelChallenge,
  useCancelEmergencyWithdrawal,
  useChallengeCurrentFee,
  useChallengePrizePool,
  useEmergencyRequestedAt,
  useEmergencyTimelock,
  useExecuteEmergencyWithdrawal,
  useFeeDistribution,
  useRequestEmergencyWithdrawal,
  useResolveChallenge,
  useSeedPrizePool,
  useSendMessageOnChain,
  useSendMessageWithPermit,
  useUSDCAllowance,
} from '@/lib/contracts/hooks'
import { usePaymaster } from '@/hooks/usePaymaster'
import { useFarcasterContext } from '@/providers/FarcasterProvider'
import { challengeAbi } from '@/lib/contracts/abis'
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses'
import { config } from '@/config'

export const Route = createFileRoute('/challenges/$id')({
  component: ChallengePage,
})

const BASESCAN_TX =
  config.chainId === 8453
    ? 'https://basescan.org/tx/'
    : 'https://sepolia.basescan.org/tx/'

function formatUSDC(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(2)}K`
  return `$${amount.toFixed(2)}`
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function DefenderName({ address }: { address: Address }) {
  const { data: basenameData } = useBasename(address)
  return <span>{basenameData?.basename ?? truncateAddress(address)}</span>
}

function AgentAvatar({ seed, size = 32 }: { seed: string; size?: number }) {
  return (
    <img
      src={`https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed)}`}
      alt="AI Agent"
      width={size}
      height={size}
      className="rounded-full shrink-0"
    />
  )
}

function AttackTypeBadge({ type }: { type: string | null }) {
  if (!type) return null
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0052FF]/8 text-[#0052FF] border border-[#0052FF]/15">
      {type}
    </span>
  )
}

function MessageBubble({
  entry,
  agentName,
  agentSeed,
}: {
  entry: MessageEntry
  agentName?: string
  agentSeed?: string
}) {
  const { data: basenameData } = useBasename(entry.playerAddress)
  const displayName =
    basenameData?.basename ?? truncateAddress(entry.playerAddress)
  const isBroken = entry.evaluation === 'Broken'
  const timestamp = new Date(entry.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex flex-col gap-2 py-4 border-b border-black/[0.06] dark:border-white/[0.06] last:border-0">
      {/* Player message - right aligned */}
      <div className="flex items-start gap-3 justify-end">
        <div className="flex-1 min-w-0 flex flex-col items-end">
          <div className="flex items-center gap-2 mb-1">
            <AttackTypeBadge type={entry.attackType} />
            <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[11px]">
              {timestamp}
            </span>
            <span className="text-[#0052FF] text-[13px] font-semibold">
              {displayName}
            </span>
          </div>
          <div className="bg-[#0052FF] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-[15px] leading-[1.5] break-words max-w-[85%]">
            {entry.playerMessage}
          </div>
          {entry.feePaid && (
            <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[11px] mt-1">
              Fee: {formatUSDC(Number(entry.feePaid) / 1e6)}
              {entry.txHash && (
                <a
                  href={`${BASESCAN_TX}${entry.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 ml-1.5 text-[#0052FF] hover:underline"
                >
                  <ExternalLink size={10} />
                  tx
                </a>
              )}
            </span>
          )}
        </div>
        <div className="w-7 h-7 rounded-full bg-[#0052FF]/10 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[#0052FF] text-[11px] font-bold">
            {displayName.slice(0, 1).toUpperCase()}
          </span>
        </div>
      </div>

      {/* AI response - left aligned */}
      <div className="flex items-start gap-3">
        {agentSeed ? (
          <AgentAvatar seed={agentSeed} size={28} />
        ) : (
          <div
            className={cnm(
              'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
              isBroken ? 'bg-[#CF202F]/10' : 'bg-[#098551]/10',
            )}
          >
            {isBroken ? (
              <XCircle size={14} className="text-[#CF202F]" />
            ) : (
              <Shield size={14} className="text-[#098551]" />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px] font-semibold">
              {agentName || 'AI Agent'}
            </span>
            <span
              className={cnm(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold',
                isBroken
                  ? 'bg-[#CF202F]/10 text-[#CF202F] border border-[#CF202F]/20'
                  : 'bg-[#098551]/10 text-[#098551] border border-[#098551]/20',
              )}
            >
              {isBroken ? (
                <>
                  <XCircle size={10} /> Broken
                </>
              ) : (
                <>
                  <CheckCircle size={10} /> Defended
                </>
              )}
            </span>
          </div>
          <div className="bg-[#F3F4F6] dark:bg-[#141518] text-[#0A0B0D] dark:text-[#F9FAFB] rounded-2xl rounded-tl-sm px-4 py-2.5 text-[15px] leading-[1.5] break-words max-w-[85%]">
            {entry.aiResponse}
          </div>
          {entry.evaluationReason && (
            <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[11px] mt-1 max-w-[85%]">
              {entry.evaluationReason}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 py-3 border-t border-black/[0.06] dark:border-white/[0.06]">
      <Button
        isIconOnly
        size="sm"
        variant="flat"
        isDisabled={page <= 1}
        onPress={() => onPageChange(page - 1)}
        className="rounded-lg w-8 h-8 min-w-0 bg-[#F3F4F6] dark:bg-[#2D2F36] text-[#4B5563] dark:text-[#D1D5DB] disabled:opacity-40"
      >
        <ChevronLeft size={14} />
      </Button>
      <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px] font-medium">
        {page} / {totalPages}
      </span>
      <Button
        isIconOnly
        size="sm"
        variant="flat"
        isDisabled={page >= totalPages}
        onPress={() => onPageChange(page + 1)}
        className="rounded-lg w-8 h-8 min-w-0 bg-[#F3F4F6] dark:bg-[#2D2F36] text-[#4B5563] dark:text-[#D1D5DB] disabled:opacity-40"
      >
        <ChevronRight size={14} />
      </Button>
    </div>
  )
}

function mapStatus(s: string): 'active' | 'resolved' | 'expired' | 'cancelled' {
  return (s || 'active').toLowerCase() as
    | 'active'
    | 'resolved'
    | 'expired'
    | 'cancelled'
}

function mapPricing(s: string): string {
  return (s || 'fixed').toLowerCase()
}

/** Read the EIP-2612 permit nonce for a given owner from the USDC contract. */
async function getNonce(owner: Address): Promise<bigint> {
  const { readContract } = await import('wagmi/actions')
  return readContract(wagmiConfig, {
    address: CONTRACT_ADDRESSES.usdc,
    abi: [
      {
        type: 'function',
        name: 'nonces',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
      },
    ],
    functionName: 'nonces',
    args: [owner],
  })
}

/** Poll getCallsStatus until the batch call is confirmed or fails. */
async function waitForBatchCall(
  callsId: string,
  maxAttempts = 30,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    try {
      const status = await getCallsStatus(wagmiConfig, { id: callsId })
      if (
        status.status === 'success' &&
        status.receipts?.[0]?.transactionHash
      ) {
        return status.receipts[0].transactionHash
      }
      if (status.status === 'failure') {
        throw new Error('Transaction failed on-chain')
      }
    } catch (err) {
      if ((err as Error).message?.includes('failed')) throw err
    }
  }
  throw new Error('Transaction confirmation timed out')
}

type SendState = 'idle' | 'approving' | 'sending' | 'waiting' | 'done' | 'error'

function ChatInput({
  challengeId,
  challengeAddress,
  currentFeeRaw,
  isActive,
}: {
  challengeId: string
  challengeAddress: Address
  currentFeeRaw: bigint
  isActive: boolean
}) {
  const { address, isConnected, connector } = useAccount()
  const [text, setText] = useState('')
  const [state, setState] = useState<SendState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const { capabilities, supportsBatch } = usePaymaster()
  const isFarcaster = connector?.id === 'farcaster'

  const { data: allowance } = useUSDCAllowance(address, challengeAddress)
  // Batch path (EIP-5792 / Smart Wallet)
  const { sendWithApproval, data: callsData } = useApproveAndSendMessage()
  useCallsTracker(callsData?.id)
  // Fallback path (two-step)
  const { approveAsync } = useApproveUSDC()
  const { sendMessageAsync: sendOnChain } =
    useSendMessageOnChain(challengeAddress)
  // Permit path (single TX via sendCalls, used for Farcaster)
  const { sendWithPermitAsync, callsData: permitCallsData } = useSendMessageWithPermit(challengeAddress)
  useCallsTracker(permitCallsData?.id)
  const { signTypedDataAsync } = useSignTypedData()
  const { mutateAsync: sendMessage } = useSendMessage(challengeId)

  const needsApproval = allowance !== undefined && allowance < currentFeeRaw

  async function handleSend() {
    if (!text.trim() || !isConnected || !address) return
    setErrorMsg('')

    try {
      if (isFarcaster) {
        // Permit path: sign EIP-2612 permit off-chain, then single TX
        setState('approving')
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)
        const nonce = await getNonce(address)
        const signature = await signTypedDataAsync({
          types: {
            Permit: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          },
          primaryType: 'Permit',
          domain: {
            name: 'USDC',
            version: '2',
            chainId: wagmiConfig.chains[0].id,
            verifyingContract: CONTRACT_ADDRESSES.usdc,
          },
          message: {
            owner: address,
            spender: challengeAddress,
            value: currentFeeRaw,
            nonce,
            deadline,
          },
        })
        const r = `0x${signature.slice(2, 66)}` as `0x${string}`
        const s = `0x${signature.slice(66, 130)}` as `0x${string}`
        const v = parseInt(signature.slice(130, 132), 16)

        setState('sending')
        const permitResult = await sendWithPermitAsync({ deadline, v, r, s })
        setState('waiting')
        const realTxHash = await waitForBatchCall(permitResult.id)
        await sendMessage({ content: text.trim(), txHash: realTxHash })
      } else if (supportsBatch) {
        setState('sending')
        const batchResult = await sendWithApproval({
          challengeAddress,
          fee: currentFeeRaw,
          capabilities: capabilities ?? undefined,
        })
        setState('waiting')
        const realTxHash = await waitForBatchCall(batchResult.id)
        await sendMessage({
          content: text.trim(),
          txHash: realTxHash,
        })
      } else {
        if (needsApproval) {
          setState('approving')
          const approveTxHash = await approveAsync(challengeAddress, currentFeeRaw)
          await waitForTransactionReceipt(wagmiConfig, { hash: approveTxHash })
        }
        setState('sending')
        const txHash = await sendOnChain()
        setState('waiting')
        await sendMessage({ content: text.trim(), txHash: txHash as string })
      }

      setText('')
      setState('done')
      setTimeout(() => setState('idle'), 1500)
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  const isLoading =
    state === 'approving' || state === 'sending' || state === 'waiting'

  if (!isActive) {
    return (
      <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.06]">
        <p className="text-[#9CA3AF] dark:text-[#6B7280] text-sm text-center">
          This challenge is no longer active.
        </p>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.06] text-center">
        <p className="text-[#4B5563] dark:text-[#D1D5DB] text-sm mb-3">
          Connect your wallet to attack this challenge.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.06]">
      {state === 'error' && (
        <div className="mb-3 flex items-center gap-2 bg-[#CF202F]/10 border border-[#CF202F]/20 rounded-xl px-4 py-2">
          <AlertCircle size={14} className="text-[#CF202F] shrink-0" />
          <p className="text-[#CF202F] text-[13px]">{errorMsg}</p>
        </div>
      )}

      {state === 'done' && (
        <div className="mb-3 flex items-center gap-2 bg-[#098551]/10 border border-[#098551]/20 rounded-xl px-4 py-2">
          <CheckCircle size={14} className="text-[#098551] shrink-0" />
          <p className="text-[#098551] text-[13px]">
            Message sent successfully.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <Textarea
          value={text}
          onValueChange={setText}
          placeholder="Try to break the AI's instructions..."
          minRows={1}
          maxRows={4}
          disabled={isLoading}
          classNames={{
            input:
              'bg-[#F3F4F6] dark:bg-[#141518] text-[#0A0B0D] dark:text-[#F9FAFB] placeholder:text-[#D1D5DB] dark:placeholder:text-[#6B7280] text-[15px]',
            inputWrapper:
              'bg-[#F3F4F6] dark:bg-[#141518] border border-[#E5E7EB] dark:border-[#2D2F36] rounded-xl focus-within:border-[#0052FF] focus-within:ring-[3px] focus-within:ring-[rgba(0,82,255,0.15)] hover:border-[#9CA3AF] transition-all',
          }}
        />
        <Tooltip
          content={
            needsApproval
              ? `Approve ${formatUSDC(Number(currentFeeRaw) / 1e6)} USDC first`
              : `Send — costs ${formatUSDC(Number(currentFeeRaw) / 1e6)} USDC`
          }
        >
          <Button
            isIconOnly
            onPress={handleSend}
            isDisabled={!text.trim() || isLoading}
            isLoading={isLoading}
            className={cnm(
              'rounded-xl w-11 h-11 shrink-0 transition-colors duration-150',
              needsApproval
                ? 'bg-[#ED702F]/10 text-[#ED702F] hover:bg-[#ED702F]/20'
                : 'bg-[#0052FF] hover:bg-[#3377FF] text-white',
            )}
          >
            {isLoading ? <Spinner size="sm" /> : <Send size={16} />}
          </Button>
        </Tooltip>
      </div>

      <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[11px] mt-2 text-center">
        {needsApproval
          ? `Approve ${formatUSDC(Number(currentFeeRaw) / 1e6)} USDC, then send`
          : `Each message costs ${formatUSDC(Number(currentFeeRaw) / 1e6)} USDC`}
      </p>
    </div>
  )
}

function InsightsSection({ challengeId }: { challengeId: string }) {
  const {
    data: insights,
    isPending,
    isError,
    error,
    mutate: fetchInsights,
  } = useX402ChallengeInsights(challengeId)

  // Not yet requested: show unlock button
  if (!insights && !isPending && !isError) {
    return (
      <GlassCard variant="subtle" className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={13} className="text-[#9CA3AF] dark:text-[#6B7280]" />
          <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] font-semibold uppercase tracking-[0.5px]">
            Insights
          </p>
        </div>
        <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px] mb-3">
          View defense stats, attack patterns, and recent evaluations.
        </p>
        <Button
          size="sm"
          onPress={() => fetchInsights()}
          className="w-full bg-[#0052FF]/10 text-[#0052FF] rounded-full text-[13px] font-semibold hover:bg-[#0052FF]/20 transition-colors"
        >
          <BarChart2 size={12} />
          Unlock Insights (0.01 USDC)
        </Button>
      </GlassCard>
    )
  }

  if (isError) {
    return (
      <GlassCard variant="subtle" className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 size={13} className="text-[#9CA3AF] dark:text-[#6B7280]" />
          <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] font-semibold uppercase tracking-[0.5px]">
            Insights
          </p>
        </div>
        <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px]">
          Failed to load insights. Connect wallet and try again.
        </p>
        {error && (
          <p className="text-[#CF202F] text-[11px] mt-1 break-all">
            {error instanceof Error ? error.message : String(error)}
          </p>
        )}
        <Button
          size="sm"
          onPress={() => fetchInsights()}
          className="mt-2 w-full bg-[#F3F4F6] dark:bg-[#2D2F36] text-[#4B5563] dark:text-[#D1D5DB] rounded-full text-[12px]"
        >
          Retry
        </Button>
      </GlassCard>
    )
  }

  return (
    <GlassCard variant="subtle" className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 size={13} className="text-[#9CA3AF] dark:text-[#6B7280]" />
        <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] font-semibold uppercase tracking-[0.5px]">
          Insights
        </p>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-3 w-20 bg-[#F3F4F6] dark:bg-[#2D2F36] rounded animate-pulse" />
              <div className="h-3 w-12 bg-[#F3F4F6] dark:bg-[#2D2F36] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Defense rate */}
          <div className="flex items-center justify-between">
            <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px]">
              Defense Rate
            </span>
            <span
              className={cnm(
                'text-[13px] font-semibold',
                insights.insights.defenseRate >= 80
                  ? 'text-[#098551]'
                  : insights.insights.defenseRate >= 50
                    ? 'text-[#ED702F]'
                    : 'text-[#CF202F]',
              )}
            >
              {insights.insights.defenseRate.toFixed(1)}%
            </span>
          </div>

          {/* Evaluation breakdown */}
          <div className="flex items-center justify-between">
            <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px]">
              Defended
            </span>
            <span className="text-[#098551] text-[13px] font-semibold">
              {insights.insights.evaluationStats.defended}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px]">
              Broken
            </span>
            <span className="text-[#CF202F] text-[13px] font-semibold">
              {insights.insights.evaluationStats.broken}
            </span>
          </div>

          {/* Attack type distribution */}
          {insights.insights.attackTypeDistribution.length > 0 && (
            <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[11px] font-semibold uppercase tracking-[0.5px] mb-2">
                Attack Types
              </p>
              <div className="flex flex-col gap-1.5">
                {insights.insights.attackTypeDistribution
                  .slice(0, 3)
                  .map((a) => (
                    <div
                      key={a.type}
                      className="flex items-center justify-between"
                    >
                      <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[12px] truncate max-w-[140px]">
                        {a.type}
                      </span>
                      <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] tabular-nums">
                        {a.count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Recent evaluations */}
          {insights.insights.recentEvaluations.length > 0 && (
            <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[11px] font-semibold uppercase tracking-[0.5px] mb-2">
                Recent
              </p>
              <div className="flex flex-col gap-1.5">
                {insights.insights.recentEvaluations.slice(0, 3).map((e, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className={cnm(
                        'w-1.5 h-1.5 rounded-full shrink-0',
                        e.evaluation === 'Broken'
                          ? 'bg-[#CF202F]'
                          : 'bg-[#098551]',
                      )}
                    />
                    <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[12px] truncate">
                      {e.attackType ?? e.evaluation}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  )
}

// 72h in seconds
const EMERGENCY_TIMELOCK_SECONDS = 72 * 60 * 60

function EmergencySection({ challengeAddress }: { challengeAddress: Address }) {
  const { data: requestedAt } = useEmergencyRequestedAt(challengeAddress)
  const { data: timelockDuration } = useEmergencyTimelock(challengeAddress)
  const { writeContract: requestEmergency, isPending: isRequesting } =
    useRequestEmergencyWithdrawal(challengeAddress)
  const { writeContract: executeEmergency, isPending: isExecuting } =
    useExecuteEmergencyWithdrawal(challengeAddress)
  const { writeContract: cancelEmergency, isPending: isCancelling } =
    useCancelEmergencyWithdrawal(challengeAddress)

  const requestedAtNum = requestedAt ? Number(requestedAt) : 0
  const timelockSecs = timelockDuration
    ? Number(timelockDuration)
    : EMERGENCY_TIMELOCK_SECONDS
  const hasRequest = requestedAtNum > 0
  const unlockAt = requestedAtNum + timelockSecs
  const now = Math.floor(Date.now() / 1000)
  const canExecute = hasRequest && now >= unlockAt

  return (
    <GlassCard variant="subtle" className="p-4">
      <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] font-semibold uppercase tracking-[0.5px] mb-3">
        Emergency
      </p>

      {!hasRequest ? (
        <div>
          <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px] mb-3">
            Request an emergency withdrawal. A 72-hour timelock applies.
          </p>
          <Button
            size="sm"
            variant="bordered"
            isLoading={isRequesting}
            onPress={() =>
              requestEmergency({
                address: challengeAddress,
                abi: challengeAbi,
                functionName: 'requestEmergencyWithdrawal',
              })
            }
            className="border-[#CF202F]/30 text-[#CF202F] rounded-full text-[13px] font-semibold w-full"
          >
            Request Emergency Withdrawal
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px]">
              Requested
            </span>
            <span className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[13px] font-mono font-semibold">
              {new Date(requestedAtNum * 1000).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px]">
              Unlocks
            </span>
            {canExecute ? (
              <span className="text-[#098551] text-[13px] font-semibold">
                Ready to execute
              </span>
            ) : (
              <CountdownTimer endTime={unlockAt} />
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              isDisabled={!canExecute}
              isLoading={isExecuting}
              onPress={() =>
                executeEmergency({
                  address: challengeAddress,
                  abi: challengeAbi,
                  functionName: 'executeEmergencyWithdrawal',
                })
              }
              className={cnm(
                'flex-1 rounded-full text-[13px] font-semibold',
                canExecute
                  ? 'bg-[#CF202F] text-white'
                  : 'bg-[#F3F4F6] dark:bg-[#2D2F36] text-[#9CA3AF] dark:text-[#6B7280]',
              )}
            >
              Execute
            </Button>
            <Button
              size="sm"
              variant="bordered"
              isLoading={isCancelling}
              onPress={() =>
                cancelEmergency({
                  address: challengeAddress,
                  abi: challengeAbi,
                  functionName: 'cancelEmergencyWithdrawal',
                })
              }
              className="flex-1 border-black/20 dark:border-white/20 text-[#4B5563] dark:text-[#D1D5DB] rounded-full text-[13px] font-semibold"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </GlassCard>
  )
}

function SeedPrizePoolSection({
  challengeAddress,
}: {
  challengeAddress: Address
}) {
  const { address, isConnected } = useAccount()
  const [amount, setAmount] = useState('')
  const [seedState, setSeedState] = useState<
    'idle' | 'approving' | 'seeding' | 'done' | 'error'
  >('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const amountNum = parseFloat(amount) || 0
  const amountRaw = BigInt(Math.round(amountNum * 1e6))

  const { capabilities: seedCapabilities, supportsBatch } = usePaymaster()

  const { data: allowance } = useUSDCAllowance(address, challengeAddress)
  // Batch path (EIP-5792 / Smart Wallet / Farcaster)
  const { seedWithApproval, data: seedCallsData } = useApproveAndSeedPrizePool()
  useCallsTracker(seedCallsData?.id)
  // Fallback path (two-step)
  const { approveAsync } = useApproveUSDC()
  const { writeContractAsync: seedAsync } = useSeedPrizePool()

  const needsApproval =
    amountRaw > 0n && allowance !== undefined && allowance < amountRaw
  const isLoading = seedState === 'approving' || seedState === 'seeding'

  async function handleSeed() {
    if (!amountNum || !isConnected) return
    setErrorMsg('')
    try {
      if (supportsBatch) {
        setSeedState('seeding')
        const batchResult = await seedWithApproval({
          challengeAddress,
          amount: amountRaw,
          capabilities: seedCapabilities ?? undefined,
        })
        // Wait for batch call to actually confirm on-chain
        await waitForBatchCall(batchResult.id)
      } else {
        if (needsApproval) {
          setSeedState('approving')
          const approveTxHash = await approveAsync(challengeAddress, amountRaw)
          await waitForTransactionReceipt(wagmiConfig, { hash: approveTxHash })
        }
        setSeedState('seeding')
        await seedAsync({
          address: challengeAddress,
          abi: challengeAbi,
          functionName: 'seedPrizePool',
          args: [amountRaw],
        })
      }
      setAmount('')
      setSeedState('done')
      setTimeout(() => setSeedState('idle'), 2000)
    } catch (err) {
      setSeedState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed')
      setTimeout(() => setSeedState('idle'), 4000)
    }
  }

  return (
    <GlassCard variant="subtle" className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sprout size={13} className="text-[#098551]" />
        <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] font-semibold uppercase tracking-[0.5px]">
          Seed Prize Pool
        </p>
      </div>

      {seedState === 'error' && (
        <div className="mb-3 flex items-center gap-2 bg-[#CF202F]/10 border border-[#CF202F]/20 rounded-xl px-3 py-2">
          <AlertCircle size={12} className="text-[#CF202F] shrink-0" />
          <p className="text-[#CF202F] text-[12px] truncate">{errorMsg}</p>
        </div>
      )}

      {seedState === 'done' && (
        <div className="mb-3 flex items-center gap-2 bg-[#098551]/10 border border-[#098551]/20 rounded-xl px-3 py-2">
          <CheckCircle size={12} className="text-[#098551] shrink-0" />
          <p className="text-[#098551] text-[12px]">Prize pool seeded.</p>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={amount}
          onValueChange={setAmount}
          placeholder="0.00"
          type="number"
          min="0"
          step="0.01"
          disabled={isLoading}
          startContent={
            <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px] shrink-0">
              $
            </span>
          }
          endContent={
            <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[11px] shrink-0">
              USDC
            </span>
          }
          classNames={{
            input: 'text-[#0A0B0D] dark:text-[#F9FAFB] text-[14px]',
            inputWrapper:
              'bg-white dark:bg-[#141518] border border-[#E5E7EB] dark:border-[#2D2F36] rounded-xl h-9 hover:border-[#9CA3AF] focus-within:border-[#0052FF] transition-all',
          }}
        />
        <Button
          size="sm"
          isDisabled={!amountNum || !isConnected || isLoading}
          isLoading={isLoading}
          onPress={handleSeed}
          className="bg-[#098551] text-white rounded-xl h-9 px-4 text-[13px] font-semibold shrink-0"
        >
          {isLoading
            ? seedState === 'approving'
              ? 'Approving...'
              : 'Seeding...'
            : needsApproval
              ? 'Approve & Seed'
              : 'Seed'}
        </Button>
      </div>
      {!isConnected && (
        <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[11px] mt-2">
          Connect your wallet to seed the prize pool.
        </p>
      )}
    </GlassCard>
  )
}

function ClaimPrizeSection({
  cloneAddress,
  winnerAddress,
  winnerAttempt,
  prizePool,
  messages,
}: {
  cloneAddress: string
  winnerAddress: string
  winnerAttempt: number | null | undefined
  prizePool: number
  messages: Array<MessageEntry>
}) {
  const { address } = useAccount()
  const { resolveAsync } = useResolveChallenge()
  const [isClaiming, setIsClaiming] = useState(false)
  const [hasClaimed, setHasClaimed] = useState(false)
  const [claimError, setClaimError] = useState('')

  const isWinner =
    !!address && winnerAddress.toLowerCase() === address.toLowerCase()

  if (!isWinner) {
    return (
      <GlassCard variant="subtle" className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Trophy size={13} className="text-[#9CA3AF] dark:text-[#6B7280]" />
          <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] font-semibold uppercase tracking-[0.5px]">
            Winner
          </p>
        </div>
        <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px]">
          Broken by{' '}
          <span className="font-mono text-[#0052FF]">
            {truncateAddress(winnerAddress)}
          </span>
        </p>
      </GlassCard>
    )
  }

  async function handleClaimPrize() {
    const winningMsg = messages.find((m) => m.oracleSignature !== null)
    if (!winningMsg?.oracleSignature || !winningMsg.oracleDeadline) {
      setClaimError('Oracle signature not found. Contact support.')
      return
    }

    const deadlineUnix = Math.floor(
      new Date(winningMsg.oracleDeadline).getTime() / 1000,
    )
    const attemptNumber = winnerAttempt ?? winningMsg.attemptNumber

    setClaimError('')
    setIsClaiming(true)
    try {
      await resolveAsync(
        cloneAddress,
        winnerAddress,
        attemptNumber,
        deadlineUnix,
        winningMsg.oracleSignature,
      )
      setHasClaimed(true)
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Transaction failed')
    } finally {
      setIsClaiming(false)
    }
  }

  return (
    <GlassCard className="p-5 border border-[#098551]/30 bg-[#098551]/5">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#098551]/15 flex items-center justify-center">
          <Trophy size={18} className="text-[#098551]" />
        </div>
        <div>
          <p className="text-[#098551] dark:text-[#4ADE80] text-[16px] font-semibold">
            You Won!
          </p>
          <p className="text-[#4B5563] dark:text-[#9CA3AF] text-[13px] mt-0.5">
            Claim your prize of{' '}
            <span className="font-semibold text-[#0A0B0D] dark:text-[#F9FAFB]">
              {formatUSDC(prizePool)} USDC
            </span>
          </p>
        </div>

        {claimError && (
          <div className="w-full flex items-center gap-2 bg-[#CF202F]/10 border border-[#CF202F]/20 rounded-xl px-3 py-2">
            <AlertCircle size={12} className="text-[#CF202F] shrink-0" />
            <p className="text-[#CF202F] text-[12px] text-left">{claimError}</p>
          </div>
        )}

        <Button
          onPress={handleClaimPrize}
          isLoading={isClaiming}
          isDisabled={isClaiming || hasClaimed}
          className={cnm(
            'w-full rounded-full text-[14px] font-semibold transition-colors',
            hasClaimed
              ? 'bg-[#098551]/20 text-[#098551]'
              : 'bg-[#098551] hover:bg-[#0a9c5e] text-white',
          )}
        >
          {hasClaimed ? 'Prize Claimed!' : 'Claim Prize'}
        </Button>
      </div>
    </GlassCard>
  )
}

function ChallengePage() {
  const { id } = Route.useParams()
  const { address: userAddress } = useAccount()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useChallenge(id, { messagePage: page })

  const challenge = data?.challenge
  const messages = data?.messages?.items ?? []
  const pagination = data?.messages?.pagination
  const totalPages = pagination?.totalPages ?? 1

  const challengeAddress = challenge?.cloneAddress as Address | undefined

  const { data: prizePoolRaw } = useChallengePrizePool(challengeAddress)
  const { data: currentFeeRaw } = useChallengeCurrentFee(challengeAddress)
  const { feePool, feeDefender, feeProtocol } =
    useFeeDistribution(challengeAddress)

  const isActive = challenge?.status === 'Active'
  const isOwner =
    userAddress &&
    challenge?.defender?.toLowerCase() === userAddress.toLowerCase()

  // onChain messageCount takes precedence for cancel guard
  const onChainMessageCount = data?.onChainState?.messageCount
  const messageCountForCancel = onChainMessageCount
    ? Number(onChainMessageCount)
    : (challenge?.messageCount ?? 0)

  const { writeContract: cancelChallenge, isPending: isCancelling } =
    useCancelChallenge()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0B0D] px-4 py-10">
        <div className="max-w-[980px] mx-auto">
          <Skeleton className="h-6 w-32 mb-8 rounded-lg bg-[#F3F4F6] dark:bg-[#141518]" />
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
            <Skeleton className="h-[600px] rounded-[20px] bg-[#F3F4F6] dark:bg-[#141518]" />
            <Skeleton className="h-[600px] rounded-[20px] bg-[#F3F4F6] dark:bg-[#141518]" />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !challenge) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0B0D] px-4 py-20 flex items-center justify-center">
        <GlassCard className="text-center max-w-sm">
          <p className="text-[#CF202F] text-[17px] font-medium mb-2">
            Challenge not found
          </p>
          <p className="text-[#4B5563] dark:text-[#D1D5DB] text-sm mb-6">
            This challenge may have been removed or the ID is invalid.
          </p>
          <Link to="/challenges">
            <Button className="bg-[#0052FF] hover:bg-[#3377FF] text-white rounded-full px-6 py-2 text-sm font-semibold">
              Back to Challenges
            </Button>
          </Link>
        </GlassCard>
      </div>
    )
  }

  const prizePool =
    prizePoolRaw !== undefined
      ? Number(prizePoolRaw) / 1e6
      : parseFloat(challenge.prizePool) / 1e6
  const basePriceNum = parseFloat(challenge.basePrice) / 1e6
  const currentFee =
    currentFeeRaw !== undefined ? Number(currentFeeRaw) / 1e6 : basePriceNum

  const currentFeeForInput: bigint =
    currentFeeRaw ?? BigInt(Math.round(basePriceNum * 1e6))

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0B0D] px-4 py-10">
      <div className="max-w-[980px] mx-auto">
        {/* Back */}
        <Link
          to="/challenges"
          className="inline-flex items-center gap-2 text-[#4B5563] dark:text-[#D1D5DB] hover:text-[#0A0B0D] dark:hover:text-[#F9FAFB] text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={14} /> Challenges
        </Link>

        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <StatusBadge status={mapStatus(challenge.status)} />
              {challenge.challengeType &&
                challenge.challengeType !== 'Custom' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#0052FF]/8 text-[#0052FF] border border-[#0052FF]/15">
                    {challenge.challengeType.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                )}
              {challenge.difficulty && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#F3F4F6] dark:bg-[#1F2937] text-[#4B5563] dark:text-[#9CA3AF] capitalize">
                  {challenge.difficulty.toLowerCase()}
                </span>
              )}
            </div>
            <h1 className="text-[32px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.02em] leading-[1.1] max-w-[600px]">
              {challenge.title}
            </h1>
            {challenge.description && (
              <p className="text-[#4B5563] dark:text-[#9CA3AF] text-[15px] leading-[1.5] mt-2 max-w-[600px]">
                {challenge.description}
              </p>
            )}
            {challenge.tags && challenge.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {challenge.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-medium bg-[#F3F4F6] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF]"
                  >
                    <Tag size={10} />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {isOwner && isActive && messageCountForCancel === 0 && (
            <Button
              color="danger"
              variant="bordered"
              isLoading={isCancelling}
              onPress={() =>
                cancelChallenge({
                  address: challengeAddress as `0x${string}`,
                  abi: challengeAbi,
                  functionName: 'cancelChallenge',
                })
              }
              className="border-[#CF202F]/30 text-[#CF202F] rounded-full px-5 py-2 text-sm font-semibold"
            >
              Cancel Challenge
            </Button>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Left: Chat */}
          <GlassCard
            className="p-0 overflow-hidden flex flex-col min-h-[60vh] lg:min-h-[520px]"
          >
            {/* Chat header */}
            <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-3">
              <MessageSquare
                size={16}
                className="text-[#9CA3AF] dark:text-[#6B7280]"
              />
              <span className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[15px] font-semibold">
                Attack History
              </span>
              <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px]">
                {pagination?.total ?? messages.length} message
                {(pagination?.total ?? messages.length) !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-5 max-h-[40vh] lg:max-h-[480px]"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                  {challenge.agentGreeting && (
                    <div className="flex gap-3 text-left w-full mb-8">
                      <AgentAvatar seed={challenge.cloneAddress} size={32} />
                      <div className="flex-1">
                        <div className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px] font-semibold mb-1">
                          {challenge.agentName || 'AI Agent'}
                        </div>
                        <div className="bg-[#F3F4F6] dark:bg-[#1F2937] rounded-2xl rounded-tl-sm px-4 py-3 text-[14px] text-[#0A0B0D] dark:text-[#F9FAFB]">
                          {challenge.agentGreeting}
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[17px] font-medium">
                    No attacks yet
                  </p>
                  <p className="text-[#9CA3AF] dark:text-[#6B7280] text-sm mt-1">
                    Be the first to challenge this AI.
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      entry={msg}
                      agentName={challenge.agentName}
                      agentSeed={challenge.cloneAddress}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Pagination */}
            <PaginationControls
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />

            {/* Input */}
            <ChatInput
              challengeId={id}
              challengeAddress={challenge.cloneAddress as Address}
              currentFeeRaw={currentFeeForInput}
              isActive={isActive}
            />
          </GlassCard>

          {/* Right: Sidebar */}
          <div className="flex flex-col gap-4">
            {/* Prize Pool */}
            <GlassCard variant="accent" className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={16} className="text-[#0052FF]" />
                <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] font-semibold uppercase tracking-[0.5px]">
                  Prize Pool
                </span>
              </div>
              <p className="text-[40px] font-semibold text-[#0052FF] leading-tight">
                {formatUSDC(prizePool)}
              </p>
              <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] mt-1">
                Paid out in USDC on Base
              </p>
            </GlassCard>

            {/* Claim Prize / Winner - resolved only */}
            {challenge.status === 'Resolved' && challenge.winnerAddress && (
              <ClaimPrizeSection
                cloneAddress={challenge.cloneAddress}
                winnerAddress={challenge.winnerAddress}
                winnerAttempt={challenge.winnerAttempt}
                prizePool={prizePool}
                messages={messages}
              />
            )}

            {/* Stats */}
            <GlassCard className="p-5">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#4B5563] dark:text-[#D1D5DB] text-[13px]">
                    <DollarSign size={13} />
                    Entry Fee
                  </div>
                  <span className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[15px] font-semibold">
                    {formatUSDC(currentFee)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#4B5563] dark:text-[#D1D5DB] text-[13px]">
                    <MessageSquare size={13} />
                    Attacks
                  </div>
                  <span className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[15px] font-semibold">
                    {challenge.messageCount}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#4B5563] dark:text-[#D1D5DB] text-[13px]">
                    <Clock size={13} />
                    Ends
                  </div>
                  <CountdownTimer
                    endTime={Math.floor(
                      new Date(challenge.endTime).getTime() / 1000,
                    )}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#4B5563] dark:text-[#D1D5DB] text-[13px]">
                    <Info size={13} />
                    Pricing
                  </div>
                  <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px] capitalize">
                    {mapPricing(challenge.pricingModel)}
                  </span>
                </div>
              </div>
            </GlassCard>

            {/* Fee breakdown */}
            <GlassCard variant="subtle" className="p-4">
              <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] font-semibold uppercase tracking-[0.5px] mb-3">
                Fee Distribution
              </p>
              <div className="flex flex-col gap-2">
                {((): Array<{ label: string; pct: string; color: string }> => {
                  const poolPct =
                    feePool.data !== undefined ? Number(feePool.data) / 100 : 80
                  const defenderPct =
                    feeDefender.data !== undefined
                      ? Number(feeDefender.data) / 100
                      : 10
                  const protocolPct =
                    feeProtocol.data !== undefined
                      ? Number(feeProtocol.data) / 100
                      : 10
                  return [
                    {
                      label: 'Prize Pool',
                      pct: `${poolPct}%`,
                      color: '#0052FF',
                    },
                    {
                      label: 'Defender',
                      pct: `${defenderPct}%`,
                      color: '#098551',
                    },
                    {
                      label: 'Protocol',
                      pct: `${protocolPct}%`,
                      color: '#3377FF',
                    },
                  ]
                })().map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: row.color }}
                    />
                    <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px] flex-1">
                      {row.label}
                    </span>
                    <span className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[13px] font-semibold">
                      {row.pct}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Defender */}
            <GlassCard variant="subtle" className="p-4">
              <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] font-semibold uppercase tracking-[0.5px] mb-3">
                Defender
              </p>
              <p className="text-[#0052FF] text-[14px] font-medium">
                <DefenderName address={challenge.defender as Address} />
              </p>
            </GlassCard>

            {/* Insights - x402 gated */}
            <InsightsSection challengeId={id} />

            {/* Seed Prize Pool - defender only */}
            {config.features.prizePoolSeeding && isOwner && challengeAddress && (
              <SeedPrizePoolSection challengeAddress={challengeAddress} />
            )}

            {/* Emergency Withdrawal - defender only */}
            {config.features.emergencyWithdrawal &&
              isOwner &&
              challengeAddress && (
                <EmergencySection challengeAddress={challengeAddress} />
              )}
          </div>
        </div>
      </div>
    </div>
  )
}
