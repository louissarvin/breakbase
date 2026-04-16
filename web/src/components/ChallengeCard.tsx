import { Link } from '@tanstack/react-router'
import { Clock, DollarSign, MessageSquare, Trophy } from 'lucide-react'
import type { Address } from 'viem'
import type { Challenge as APIChallenge } from '@/lib/api/hooks'
import { cnm } from '@/utils/style'
import StatusBadge from '@/components/StatusBadge'
import CountdownTimer from '@/components/CountdownTimer'
import { useBasename } from '@/lib/api/hooks'

interface ChallengeCardProps {
  challenge: APIChallenge
  className?: string
}

function mapStatus(s: string): 'active' | 'resolved' | 'expired' | 'cancelled' {
  return (s || 'active').toLowerCase() as
    | 'active'
    | 'resolved'
    | 'expired'
    | 'cancelled'
}

function formatUSDC(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`
  }
  return `$${amount.toFixed(2)}`
}

/** Human-readable label for challengeType enum values */
function formatChallengeType(type: string): string {
  const map: Record<string, string> = {
    SecretExtraction: 'Secret Extraction',
    PersonaBreak: 'Persona Break',
    SystemPromptLeak: 'Prompt Leak',
    FunctionAbuse: 'Function Abuse',
    LogicManipulation: 'Logic Manipulation',
    ContextPoisoning: 'Context Poisoning',
    MultiTurnErosion: 'Multi-Turn Erosion',
    AgentEscape: 'Agent Escape',
    Custom: 'Custom',
  }
  return map[type] ?? type
}

function DefenderLabel({ address }: { address: Address }) {
  const { data: basenameData } = useBasename(address)
  const display =
    basenameData?.basename ?? `${address.slice(0, 6)}...${address.slice(-4)}`
  return (
    <span className="text-[#0052FF] text-xs truncate max-w-[120px]">
      {display}
    </span>
  )
}

export default function ChallengeCard({
  challenge,
  className,
}: ChallengeCardProps) {
  const prizePool = parseFloat(challenge.prizePool) / 1e6
  const basePrice = parseFloat(challenge.basePrice) / 1e6
  const hasType =
    challenge.challengeType && challenge.challengeType !== 'Custom'
  const hasTags = challenge.tags && challenge.tags.length > 0

  return (
    <Link
      to="/challenges/$id"
      params={{ id: challenge.id }}
      className={cnm(
        'block bg-white dark:bg-[#141518] rounded-[20px] p-6 group',
        'border border-black/[0.08] dark:border-[#2D2F36]',
        'shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none',
        'transition-all duration-300 cursor-pointer',
        'hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:-translate-y-2',
        '[transition-timing-function:cubic-bezier(.165,.84,.44,1)]',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <img
          src={`https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(challenge.cloneAddress)}`}
          alt=""
          width={36}
          height={36}
          className="rounded-full shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[17px] font-bold leading-snug line-clamp-2">
            {challenge.title}
          </h3>
          {challenge.agentName && (
            <span className="text-[#9CA3AF] text-[12px]">
              {challenge.agentName}
            </span>
          )}
        </div>
        <StatusBadge
          status={mapStatus(challenge.status)}
          className="shrink-0 mt-0.5"
        />
      </div>

      {/* Description */}
      {challenge.description && (
        <p className="text-[#4B5563] dark:text-[#9CA3AF] text-[13px] leading-[1.4] line-clamp-2 mb-3">
          {challenge.description}
        </p>
      )}

      {/* Challenge type + pricing badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {hasType && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0052FF]/8 text-[#0052FF] border border-[#0052FF]/15">
            {formatChallengeType(challenge.challengeType!)}
          </span>
        )}
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] dark:bg-[#1F2937] text-[#4B5563] dark:text-[#9CA3AF] capitalize">
          {(challenge.pricingModel || 'fixed').toLowerCase()}
        </span>
        {challenge.difficulty && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] dark:bg-[#1F2937] text-[#4B5563] dark:text-[#9CA3AF] capitalize">
            {challenge.difficulty.toLowerCase()}
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-[#9CA3AF] dark:text-[#6B7280] text-[11px] uppercase tracking-[0.5px] font-semibold">
            <Trophy size={11} />
            Prize Pool
          </div>
          <span className="text-[#0052FF] text-[17px] font-bold">
            {formatUSDC(prizePool)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-[#9CA3AF] dark:text-[#6B7280] text-[11px] uppercase tracking-[0.5px] font-semibold">
            <DollarSign size={11} />
            Entry Fee
          </div>
          <span className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[17px] font-bold">
            {formatUSDC(basePrice)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-[#9CA3AF] dark:text-[#6B7280] text-[11px] uppercase tracking-[0.5px] font-semibold">
            <MessageSquare size={11} />
            Messages
          </div>
          <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[15px] font-semibold">
            {challenge.messageCount}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-[#9CA3AF] dark:text-[#6B7280] text-[11px] uppercase tracking-[0.5px] font-semibold">
            <Clock size={11} />
            Ends
          </div>
          <CountdownTimer
            endTime={Math.floor(new Date(challenge.endTime).getTime() / 1000)}
            className="text-[15px]"
          />
        </div>
      </div>

      {/* Tags */}
      {hasTags && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {challenge.tags!.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F3F4F6] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF]"
            >
              #{tag}
            </span>
          ))}
          {challenge.tags!.length > 3 && (
            <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[11px]">
              +{challenge.tags!.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Defender */}
      <div className="flex items-center gap-2 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
        <span className="text-[#9CA3AF] dark:text-[#6B7280] text-xs">
          Defender:
        </span>
        <DefenderLabel address={challenge.defender as Address} />
      </div>
    </Link>
  )
}
