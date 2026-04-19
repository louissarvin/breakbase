import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  AlertCircle,
  Bot,
  CheckCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Send,
} from 'lucide-react'
import { Button, Skeleton, Spinner, Textarea } from '@heroui/react'
import type { AgentAction } from '@/lib/api/hooks'
import { cnm } from '@/utils/style'
import GlassCard from '@/components/GlassCard'
import {
  useAgentActions,
  useAgentAnalysis,
  useAgentChat,
  useAgentChatConfig,
  useAgentPolicies,
  useAgentPoliciesInit,
  useAgentProfile,
  useAgentStats,
  useAgentStatus,
} from '@/lib/api/hooks'
import { useAuth } from '@/hooks/useAuth'

export const Route = createFileRoute('/agent')({ component: AgentPage })

interface ChatMessage {
  role: 'user' | 'agent'
  content: string
}

const BASESCAN_TX = 'https://sepolia.basescan.org/tx/'

function statusIcon(status: string) {
  if (status === 'success' || status === 'completed')
    return <CheckCircle size={14} className="text-[#098551]" />
  if (status === 'pending')
    return <Clock size={14} className="text-[#ED702F]" />
  return <AlertCircle size={14} className="text-[#CF202F]" />
}

function statusBadge(status: string) {
  const isSuccess = status === 'success' || status === 'completed'
  const isPending = status === 'pending'
  return (
    <span
      className={cnm(
        'text-[11px] font-semibold px-2 py-0.5 rounded-full',
        isSuccess && 'bg-[#ECFDF5] text-[#065F46]',
        isPending && 'bg-[#FFF7ED] text-[#92400E]',
        !isSuccess && !isPending && 'bg-[#FEF2F2] text-[#991B1B]',
      )}
    >
      {status}
    </span>
  )
}

function ActionRow({ action }: { action: AgentAction }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-black/[0.06] dark:border-white/[0.06] last:border-0">
      <div className="mt-0.5 shrink-0">{statusIcon(action.status)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[14px] truncate">
            {action.description}
          </p>
          {statusBadge(action.status)}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px]">
            {action.actionType}
          </span>
          {action.amountUsdc && (
            <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[12px] font-medium">
              ${action.amountUsdc} USDC
            </span>
          )}
          {action.txHash && (
            <a
              href={`${BASESCAN_TX}${action.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#0052FF] text-[12px] hover:underline"
            >
              tx <ExternalLink size={10} />
            </a>
          )}
          {action.error && (
            <span className="text-[#CF202F] text-[12px] truncate max-w-[160px]">
              {action.error}
            </span>
          )}
        </div>
        <p className="text-[#D1D5DB] dark:text-[#4B5563] text-[11px] mt-0.5">
          {new Date(action.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  )
}

function AnalysisCard({ title, type }: { title: string; type: string }) {
  const [enabled, setEnabled] = useState(false)
  const { data, isLoading, refetch, isFetching, isError } = useAgentAnalysis(
    type,
    {
      enabled,
      retry: false,
    },
  )

  function handleGenerate() {
    if (enabled) {
      refetch()
    } else {
      setEnabled(true)
    }
  }

  return (
    <GlassCard className="p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[14px] font-semibold">
          {title}
        </span>
        <Button
          size="sm"
          variant="light"
          isIconOnly
          onPress={handleGenerate}
          isLoading={isFetching}
          className="text-[#9CA3AF] dark:text-[#6B7280] hover:text-[#0A0B0D] dark:hover:text-[#F9FAFB]"
        >
          <RefreshCw size={13} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 rounded-lg bg-[#F3F4F6] dark:bg-[#141518]" />
          <Skeleton className="h-4 rounded-lg bg-[#F3F4F6] dark:bg-[#141518] w-4/5" />
          <Skeleton className="h-4 rounded-lg bg-[#F3F4F6] dark:bg-[#141518] w-3/5" />
        </div>
      ) : isError ? (
        <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px]">
          Analysis unavailable. The agent may still be initializing.
        </p>
      ) : data ? (
        <div className="flex flex-col gap-2">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-[12px]">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
          <pre className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[12px] leading-[1.6] whitespace-pre-wrap font-sans bg-[#F9FAFB] dark:bg-[#141518] border border-black/[0.06] dark:border-white/[0.06] rounded-xl p-3 max-h-[200px] overflow-y-auto">
            {typeof data.analysis === 'string'
              ? data.analysis
              : JSON.stringify(data.analysis, null, 2)}
          </pre>
        </div>
      ) : (
        <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px]">
          Click <RefreshCw size={11} className="inline" /> to generate analysis.
        </p>
      )}
    </GlassCard>
  )
}

interface PolicyRule {
  action: string
  operation: string
  criteria: Array<{
    type: string
    networks?: Array<string>
    addresses?: Array<string>
    ethValue?: string
    operator: string
  }>
}

interface Policy {
  id: string
  description?: string
  rules?: Array<PolicyRule>
  scope?: string
}

interface PoliciesData {
  policies: Array<Policy>
}

function ruleLabel(rule: PolicyRule): string {
  const criteria = rule.criteria?.[0]
  if (!criteria) return `${rule.action} ${rule.operation}`
  if (criteria.type === 'evmNetwork')
    return `Network: ${criteria.networks?.join(', ') || 'any'} only`
  if (criteria.type === 'evmAddress')
    return `${criteria.addresses?.length || 0} allowed contracts`
  if (criteria.type === 'ethValue') {
    const eth = criteria.ethValue
      ? (parseFloat(criteria.ethValue) / 1e18).toFixed(2)
      : '?'
    return `Max ${eth} ETH per tx`
  }
  return `${criteria.type}: ${criteria.operator}`
}

function WalletPoliciesCard() {
  const { isAuthenticated } = useAuth()
  const {
    data: policiesData,
    isLoading,
    isError,
    refetch,
  } = useAgentPolicies({
    enabled: isAuthenticated,
  })
  const { mutate: initPolicy, isPending: isInitializing } =
    useAgentPoliciesInit()

  const data = policiesData as PoliciesData | undefined
  const policyList = data?.policies ?? []
  const hasPolicy = policyList.length > 0

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] font-semibold uppercase tracking-[0.5px]">
          Wallet Policies
        </span>
        {hasPolicy && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46]">
            Active
          </span>
        )}
      </div>

      <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] mb-3">
        Security rules that restrict what the agent wallet can do on-chain.
      </p>

      {!isAuthenticated ? (
        <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px]">
          Connect wallet and sign in to manage policies.
        </p>
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 rounded-lg bg-[#F3F4F6] dark:bg-[#141518]" />
          <Skeleton className="h-5 rounded-lg bg-[#F3F4F6] dark:bg-[#141518] w-3/4" />
        </div>
      ) : isError || !hasPolicy ? (
        <div>
          <p className="text-[#ED702F] text-[13px] mb-3">
            No policies configured. The agent wallet is unrestricted.
          </p>
          <Button
            size="sm"
            isLoading={isInitializing}
            onPress={() =>
              initPolicy(undefined, { onSuccess: () => refetch() })
            }
            className="bg-[#0052FF] text-white rounded-full text-[13px] font-semibold w-full"
          >
            Initialize Policy
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {policyList.map((policy) => (
            <div key={policy.id} className="flex flex-col gap-1.5">
              <p className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[13px] font-medium">
                {policy.description || 'Agent Policy'}
              </p>
              {policy.rules && policy.rules.length > 0 && (
                <div className="flex flex-col gap-1">
                  {policy.rules.map((rule, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-[12px]"
                    >
                      <span
                        className={cnm(
                          'px-1.5 py-0.5 rounded font-medium',
                          rule.action === 'accept'
                            ? 'bg-[#ECFDF5] text-[#065F46]'
                            : 'bg-[#FEF2F2] text-[#991B1B]',
                        )}
                      >
                        {rule.action}
                      </span>
                      <span className="text-[#4B5563] dark:text-[#D1D5DB]">
                        {ruleLabel(rule)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Button
            size="sm"
            isLoading={isInitializing}
            onPress={() =>
              initPolicy(undefined, { onSuccess: () => refetch() })
            }
            className="bg-[#F3F4F6] dark:bg-[#2D2F36] text-[#4B5563] dark:text-[#D1D5DB] rounded-full text-[13px] font-medium w-full mt-1"
          >
            Re-initialize Policy
          </Button>
        </div>
      )}
    </GlassCard>
  )
}

function AgentPage() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<ChatMessage>>([])
  const [sending, setSending] = useState(false)
  const [selectedChallengeId] = useState<string | undefined>(undefined)

  const { data: status, isLoading: statusLoading } = useAgentStatus()
  const { data: actionsData, isLoading: actionsLoading } = useAgentActions()
  const { data: stats, isLoading: statsLoading } = useAgentStats()
  const { data: chatConfig } = useAgentChatConfig()
  const { data: profile } = useAgentProfile()
  const { mutateAsync: chat } = useAgentChat()

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)

    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])

    try {
      // x402 payment is handled automatically by the fetch wrapper
      // when the backend returns 402, the wrapper signs and retries
      const response = await chat({
        task: text,
        context: selectedChallengeId,
      })
      setMessages((prev) => [
        ...prev,
        { role: 'agent', content: response.text },
      ])
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      let content = 'Sorry, I encountered an error. Please try again.'
      if (errorMsg.includes('rejected') || errorMsg.includes('denied')) {
        content = 'Payment was cancelled.'
      } else if (errorMsg.includes('503') || errorMsg.includes('not ready')) {
        content = 'Agent is currently offline. Please try again later.'
      } else if (errorMsg.includes('402') || errorMsg.includes('payment')) {
        content =
          'Payment required. Please connect your wallet and ensure you have USDC.'
      } else if (errorMsg.includes('timed out')) {
        content = 'Request timed out. The agent may be busy, please try again.'
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          content,
        },
      ])
    } finally {
      setSending(false)
    }
  }

  const actions = actionsData?.actions

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0B0D] px-4 py-12">
      <div className="max-w-[980px] mx-auto">
        <div className="mb-10">
          <h1 className="text-[40px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.02em] leading-[1.1] mb-2">
            Protocol Agent
          </h1>
          <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[17px]">
            An autonomous AI that monitors challenges and executes tasks.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-stretch">
          {/* Chat */}
          <GlassCard className="p-0 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-3">
              {profile?.avatar && (
                <img
                  src={profile.avatar}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div>
                <span className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[15px] font-semibold">
                  {profile?.name || 'Agent Chat'}
                </span>
                {chatConfig?.feeUsdc && (
                  <span className="text-[#9CA3AF] text-[12px] ml-2">
                    ${chatConfig.feeUsdc} per message
                  </span>
                )}
              </div>
              {status?.network && (
                <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px] ml-auto">
                  {status.network}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  {profile?.avatar && (
                    <img
                      src={profile.avatar}
                      alt=""
                      className="w-16 h-16 rounded-full mb-4"
                    />
                  )}
                  <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[17px] font-medium">
                    {profile?.name || 'Agent is ready'}
                  </p>
                  <p className="text-[#9CA3AF] dark:text-[#6B7280] text-sm mt-1 max-w-[280px]">
                    Ask the agent to analyze challenges, check DeFi positions,
                    or get platform insights.
                  </p>
                  {chatConfig?.feeUsdc && (
                    <p className="text-[#0052FF] text-[13px] font-medium mt-3">
                      ${chatConfig.feeUsdc} USDC per message
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={cnm(
                        'flex gap-3',
                        msg.role === 'user' ? 'justify-end' : 'justify-start',
                      )}
                    >
                      {msg.role === 'agent' && (
                        <div className="w-7 h-7 rounded-full bg-[#0052FF]/10 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                          {profile?.avatar ? (
                            <img
                              src={profile.avatar}
                              alt=""
                              className="w-7 h-7"
                            />
                          ) : (
                            <Bot size={14} className="text-[#0052FF]" />
                          )}
                        </div>
                      )}
                      <div
                        className={cnm(
                          'max-w-[80%] rounded-2xl px-4 py-3 text-[14px] leading-[1.5]',
                          msg.role === 'user'
                            ? 'bg-[#0052FF] text-white rounded-tr-sm'
                            : 'bg-[#F3F4F6] dark:bg-[#141518] text-[#0A0B0D] dark:text-[#F9FAFB] rounded-tl-sm',
                        )}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#0052FF]/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {profile?.avatar ? (
                          <img
                            src={profile.avatar}
                            alt=""
                            className="w-7 h-7"
                          />
                        ) : (
                          <Bot size={14} className="text-[#0052FF]" />
                        )}
                      </div>
                      <div className="bg-[#F3F4F6] dark:bg-[#141518] rounded-2xl rounded-tl-sm px-4 py-3">
                        <Spinner size="sm" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.06] flex gap-3 mt-auto">
              <Textarea
                value={input}
                onValueChange={setInput}
                placeholder="Ask the agent to analyze a challenge, suggest prompts..."
                minRows={1}
                maxRows={3}
                disabled={sending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                classNames={{
                  input:
                    'bg-[#F3F4F6] dark:bg-[#141518] text-[#0A0B0D] dark:text-[#F9FAFB] placeholder:text-[#D1D5DB] dark:placeholder:text-[#6B7280] text-[14px]',
                  inputWrapper:
                    'bg-[#F3F4F6] dark:bg-[#141518] border border-[#E5E7EB] dark:border-[#2D2F36] rounded-xl focus-within:border-[#0052FF] hover:border-[#9CA3AF] transition-all',
                }}
              />
              <Button
                isIconOnly
                onPress={handleSend}
                isDisabled={!input.trim() || sending}
                isLoading={sending}
                className="bg-[#0052FF] hover:bg-[#3377FF] text-white rounded-xl w-11 h-11 shrink-0 transition-colors"
              >
                <Send size={16} />
              </Button>
            </div>
          </GlassCard>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            {/* Agent Profile */}
            {profile && (
              <GlassCard className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={profile.avatar}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[15px] font-semibold">
                      {profile.name}
                    </p>
                    <p className="text-[#9CA3AF] text-[12px]">
                      Autonomous Agent
                    </p>
                  </div>
                </div>
                <p className="text-[#6B7280] dark:text-[#9CA3AF] text-[13px] leading-[1.5] mb-3">
                  {profile.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-[#F3F4F6] dark:bg-[#141518] text-[#4B5563] dark:text-[#D1D5DB]"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Status */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] font-semibold uppercase tracking-[0.5px]">
                  Agent Status
                </span>
              </div>
              {statusLoading ? (
                <div className="flex flex-col gap-2.5">
                  <Skeleton className="h-4 rounded-lg bg-[#F3F4F6] dark:bg-[#141518]" />
                  <Skeleton className="h-4 rounded-lg bg-[#F3F4F6] dark:bg-[#141518]" />
                  <Skeleton className="h-4 rounded-lg bg-[#F3F4F6] dark:bg-[#141518]" />
                </div>
              ) : status ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px]">
                      Configured
                    </span>
                    <span
                      className={cnm(
                        'text-[13px] font-semibold flex items-center gap-1.5',
                        status.isConfigured
                          ? 'text-[#098551]'
                          : 'text-[#ED702F]',
                      )}
                    >
                      <span
                        className={cnm(
                          'w-1.5 h-1.5 rounded-full',
                          status.isConfigured ? 'bg-[#098551]' : 'bg-[#ED702F]',
                        )}
                      />
                      {status.isConfigured ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px]">
                      AgentKit
                    </span>
                    <span
                      className={cnm(
                        'text-[13px] font-semibold flex items-center gap-1.5',
                        status.agentKit.isReady
                          ? 'text-[#098551]'
                          : 'text-[#ED702F]',
                      )}
                    >
                      <span
                        className={cnm(
                          'w-1.5 h-1.5 rounded-full',
                          status.agentKit.isReady
                            ? 'bg-[#098551]'
                            : 'bg-[#ED702F]',
                        )}
                      />
                      {status.agentKit.isReady ? 'Ready' : 'Offline'}
                    </span>
                  </div>
                  {status.walletAddress && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px]">
                        Wallet
                      </span>
                      <span className="text-[#0052FF] font-mono text-[12px]">
                        {status.walletAddress.slice(0, 6)}...
                        {status.walletAddress.slice(-4)}
                      </span>
                    </div>
                  )}
                  {status.agentKit.walletAddress &&
                    status.agentKit.walletAddress !== status.walletAddress && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px]">
                          Kit Wallet
                        </span>
                        <span className="text-[#0052FF] font-mono text-[12px]">
                          {status.agentKit.walletAddress.slice(0, 6)}...
                          {status.agentKit.walletAddress.slice(-4)}
                        </span>
                      </div>
                    )}
                  {status.agentKit.usdcBalance && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px]">
                        Kit Balance
                      </span>
                      <span className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[13px] font-semibold">
                        ${parseFloat(status.agentKit.usdcBalance).toFixed(2)}{' '}
                        USDC
                      </span>
                    </div>
                  )}
                  {status.usdcBalance && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px]">
                        CDP Balance
                      </span>
                      <span className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[13px] font-semibold">
                        ${status.usdcBalance} USDC
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px]">
                      Network
                    </span>
                    <span className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[13px]">
                      {status.network}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[14px]">
                  Agent offline
                </p>
              )}
            </GlassCard>

            {/* Stats */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] font-semibold uppercase tracking-[0.5px]">
                  Stats
                </span>
              </div>
              {statsLoading ? (
                <div className="flex flex-col gap-2.5">
                  {[0, 1, 2].map((i) => (
                    <Skeleton
                      key={i}
                      className="h-4 rounded-lg bg-[#F3F4F6] dark:bg-[#141518]"
                    />
                  ))}
                </div>
              ) : stats ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px]">
                      Total Actions
                    </span>
                    <span className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[13px] font-semibold">
                      {stats.totalActions.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px]">
                      Distributed
                    </span>
                    <span className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[13px] font-semibold">
                      ${(parseFloat(stats.totalDistributed) / 1e6).toFixed(2)}
                    </span>
                  </div>
                  {Object.entries(stats.actionsByType).map(([type, count]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between"
                    >
                      <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px] truncate max-w-[140px]">
                        {type}
                      </span>
                      <span className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[13px] font-semibold">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[14px]">
                  No stats available
                </p>
              )}
            </GlassCard>

            {/* Recent Actions */}
            <GlassCard className="p-5 flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] font-semibold uppercase tracking-[0.5px]">
                  Recent Actions
                </span>
              </div>
              {actionsLoading ? (
                <div className="flex flex-col gap-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton
                      key={i}
                      className="h-14 rounded-xl bg-[#F3F4F6] dark:bg-[#141518]"
                    />
                  ))}
                </div>
              ) : actions && actions.length > 0 ? (
                <div className="max-h-[300px] overflow-y-auto">
                  {actions.slice(0, 5).map((action) => (
                    <ActionRow key={action.id} action={action} />
                  ))}
                </div>
              ) : (
                <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[14px]">
                  No recent actions
                </p>
              )}
            </GlassCard>
          </div>
        </div>

        {/* Bottom row: Wallet Policies + Analysis */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6">
          <WalletPoliciesCard />
          <div>
            <div className="mb-4">
              <h2 className="text-[22px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.01em]">
                Analysis
              </h2>
              <p className="text-[#6B7280] dark:text-[#9CA3AF] text-[15px] mt-1">
                Agent-generated insights across the protocol.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <AnalysisCard title="Fee Distribution" type="fee_distribution" />
              <AnalysisCard title="Challenge Health" type="challenge_health" />
              <AnalysisCard
                title="Platform Overview"
                type="platform_overview"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
