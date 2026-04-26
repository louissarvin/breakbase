import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ChevronDown, ChevronRight, Lock } from 'lucide-react'
import { Skeleton } from '@heroui/react'
import { formatNumberToKMB } from '@/utils/format'
import { cnm } from '@/utils/style'
import GlassCard from '@/components/GlassCard'
import AnimateComponent from '@/components/elements/AnimateComponent'
import {
  useDataAttacks,
  useDataModels,
  useDataStats,
  useDataTrends,
  useOnchainActivity,
  useOnchainChallenges,
  useOnchainVolume,
  useX402Catalog,
} from '@/lib/api/hooks'
import { useFeeDistributorStats } from '@/lib/contracts/hooks'
import { config } from '@/config'

export const Route = createFileRoute('/analytics')({
  component: AnalyticsPage,
})

const OWASP_NAMES: Record<number, string> = {
  1: 'Prompt Injection',
  2: 'Insecure Output',
  3: 'Training Data Poisoning',
  4: 'Model Denial of Service',
  5: 'Supply Chain',
  6: 'Sensitive Info Disclosure',
  7: 'Insecure Plugin Design',
  8: 'Excessive Agency',
  9: 'Overreliance',
  10: 'Model Theft',
}

// --- Shared UI primitives ---

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] font-semibold text-[#9CA3AF] dark:text-[#6B7280] uppercase tracking-[0.08em] mb-4">
      {children}
    </h2>
  )
}

function StatCard({
  label,
  value,
  sub,
  loading,
}: {
  label: string
  value: string
  sub?: string
  loading?: boolean
}) {
  return (
    <GlassCard className="flex flex-col gap-1">
      <p className="text-[13px] text-[#9CA3AF] dark:text-[#6B7280] font-medium">
        {label}
      </p>
      {loading ? (
        <Skeleton className="h-8 w-28 rounded-lg bg-[#F3F4F6] dark:bg-[#141518]" />
      ) : (
        <p className="text-[32px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.03em] leading-none">
          {value}
        </p>
      )}
      {sub && !loading && (
        <p className="text-[13px] text-[#4B5563] dark:text-[#D1D5DB] mt-0.5">
          {sub}
        </p>
      )}
    </GlassCard>
  )
}

function SecurityScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'text-[#098551] bg-[rgba(9,133,81,0.08)]'
      : score >= 60
        ? 'text-[#ED702F] bg-[rgba(237,112,47,0.08)]'
        : 'text-[#CF202F] bg-[rgba(207,32,47,0.08)]'

  return (
    <span
      className={cnm(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[13px] font-semibold tabular-nums',
        color,
      )}
    >
      {score.toFixed(0)}
    </span>
  )
}

function DefenseRateBar({ rate }: { rate: number }) {
  const pct = Math.min(100, Math.max(0, rate * 100))
  const color =
    pct >= 80 ? 'bg-[#098551]' : pct >= 60 ? 'bg-[#ED702F]' : 'bg-[#CF202F]'

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 bg-[#F3F4F6] dark:bg-[#2D2F36] rounded-full overflow-hidden">
        <div
          className={cnm('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[13px] tabular-nums text-[#4B5563] dark:text-[#D1D5DB] w-10 text-right shrink-0">
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

// --- Locked section overlay ---

function LockedSection({
  title,
  price,
  onUnlock,
  skeletonRows = 4,
}: {
  title: string
  price: string
  onUnlock: () => void
  skeletonRows?: number
}) {
  return (
    <div className="relative">
      {/* Blurred skeleton preview */}
      <div className="blur-sm pointer-events-none select-none" aria-hidden>
        <GlassCard className="flex flex-col gap-3">
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton
                className="h-4 rounded bg-[#F3F4F6] dark:bg-[#141518]"
                style={{ width: `${90 + ((i * 37) % 120)}px` }}
              />
              <Skeleton className="h-3 flex-1 rounded-full bg-[#F3F4F6] dark:bg-[#141518]" />
              <Skeleton className="h-4 w-10 rounded bg-[#F3F4F6] dark:bg-[#141518] shrink-0" />
            </div>
          ))}
        </GlassCard>
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/60 dark:bg-[#0A0B0D]/60 backdrop-blur-[2px]">
        <div className="flex items-center gap-2 text-[#9CA3AF] dark:text-[#6B7280]">
          <Lock size={14} strokeWidth={2} />
          <span className="text-[13px] font-medium">{title}</span>
        </div>
        <button
          type="button"
          onClick={onUnlock}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0052FF] text-white text-[13px] font-semibold hover:bg-[#0047E0] active:bg-[#003ECC] transition-colors"
        >
          Unlock for {price}
        </button>
      </div>
    </div>
  )
}

// --- Section components (receive data from parent) ---

function PlatformStatsSection({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useDataStats>['data']
  isLoading: boolean
}) {
  const overallDefense =
    data && data.defenseRateByCategory.length > 0
      ? data.defenseRateByCategory.reduce((sum, c) => sum + c.defenseRate, 0) /
        data.defenseRateByCategory.length
      : null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        label="Total Challenges"
        value={data ? formatNumberToKMB(data.totalChallenges) : '—'}
        loading={isLoading}
      />
      <StatCard
        label="Total Messages"
        value={data ? formatNumberToKMB(data.totalMessages) : '—'}
        loading={isLoading}
      />
      <StatCard
        label="Volume (USDC)"
        value={
          data ? `$${formatNumberToKMB(parseFloat(data.totalVolumeUsdc))}` : '—'
        }
        loading={isLoading}
      />
      <StatCard
        label="Avg Defense Rate"
        value={
          overallDefense !== null
            ? `${(overallDefense * 100).toFixed(1)}%`
            : '—'
        }
        sub="across all OWASP categories"
        loading={isLoading}
      />
    </div>
  )
}

function OWASPRowExpanded({ owaspCategory }: { owaspCategory: number }) {
  const { data, isLoading, isError } = useDataAttacks(owaspCategory)

  if (isError) {
    return (
      <div className="px-5 pb-4">
        <p className="text-[13px] text-[#9CA3AF] dark:text-[#6B7280]">
          Connect wallet to view drill-down data
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="px-5 pb-4 flex flex-col gap-2">
        <Skeleton className="h-3 w-48 rounded bg-[#F3F4F6] dark:bg-[#141518]" />
        <Skeleton className="h-3 w-32 rounded bg-[#F3F4F6] dark:bg-[#141518]" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="px-5 pb-4 pt-1 bg-[#F9FAFB] dark:bg-[#141518] border-t border-[#F3F4F6] dark:border-[#2D2F36]">
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div>
          <p className="text-[11px] text-[#9CA3AF] dark:text-[#6B7280] font-semibold uppercase tracking-[0.06em] mb-0.5">
            Success Rate
          </p>
          <p
            className={cnm(
              'text-[15px] font-semibold tabular-nums',
              data.successRate >= 0.5 ? 'text-[#CF202F]' : 'text-[#098551]',
            )}
          >
            {(data.successRate * 100).toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[#9CA3AF] dark:text-[#6B7280] font-semibold uppercase tracking-[0.06em] mb-0.5">
            Attempts
          </p>
          <p className="text-[15px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tabular-nums">
            {data.totalAttempts.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[#9CA3AF] dark:text-[#6B7280] font-semibold uppercase tracking-[0.06em] mb-0.5">
            Successful
          </p>
          <p className="text-[15px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tabular-nums">
            {data.successfulAttacks.toLocaleString()}
          </p>
        </div>
      </div>

      {data.attackTypeDistribution.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] text-[#9CA3AF] dark:text-[#6B7280] font-semibold uppercase tracking-[0.06em] mb-1.5">
            Attack Types
          </p>
          <div className="flex flex-col gap-1">
            {data.attackTypeDistribution.slice(0, 4).map((a) => (
              <div key={a.attackType} className="flex items-center gap-2">
                <span className="text-[12px] text-[#4B5563] dark:text-[#D1D5DB] w-40 shrink-0 truncate">
                  {a.attackType}
                </span>
                <span className="text-[12px] text-[#9CA3AF] dark:text-[#6B7280] tabular-nums">
                  {a.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.severityDistribution.length > 0 && (
        <div>
          <p className="text-[11px] text-[#9CA3AF] dark:text-[#6B7280] font-semibold uppercase tracking-[0.06em] mb-1.5">
            Severity
          </p>
          <div className="flex gap-3">
            {data.severityDistribution.map((s) => (
              <div key={s.severity} className="text-center">
                <p className="text-[13px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tabular-nums">
                  {s.count}
                </p>
                <p className="text-[11px] text-[#9CA3AF] dark:text-[#6B7280]">
                  {s.severity === 1
                    ? 'Low'
                    : s.severity === 2
                      ? 'Med'
                      : s.severity === 3
                        ? 'High'
                        : `S${s.severity}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function OWASPSection({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useDataStats>['data']
  isLoading: boolean
}) {
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null)

  function toggleCategory(cat: number) {
    setExpandedCategory((prev) => (prev === cat ? null : cat))
  }

  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="divide-y divide-[#F3F4F6] dark:divide-[#2D2F36]">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-4 w-6 rounded bg-[#F3F4F6] dark:bg-[#141518] shrink-0" />
                <Skeleton className="h-4 rounded bg-[#F3F4F6] dark:bg-[#141518] flex-1 max-w-[180px]" />
                <Skeleton className="h-3 w-24 rounded-full bg-[#F3F4F6] dark:bg-[#141518] ml-auto" />
              </div>
            ))
          : !data?.defenseRateByCategory.length ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[14px]">
                  No defense data yet. Complete some challenges to generate OWASP metrics.
                </p>
              </div>
            )
          : data.defenseRateByCategory.map((cat) => {
              const isExpanded = expandedCategory === cat.owaspCategory
              return (
                <div key={cat.owaspCategory}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.owaspCategory)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-[#F9FAFB] dark:hover:bg-[#141518] transition-colors text-left"
                  >
                    <span className="text-[12px] font-semibold text-[#0052FF] w-10 shrink-0 tabular-nums">
                      LLM{String(cat.owaspCategory).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-[#0A0B0D] dark:text-[#F9FAFB] font-medium truncate">
                        {OWASP_NAMES[cat.owaspCategory] ??
                          `Category ${cat.owaspCategory}`}
                      </p>
                      <p className="text-[12px] text-[#9CA3AF] dark:text-[#6B7280] mt-0.5">
                        {cat.defended.toLocaleString()} /{' '}
                        {cat.total.toLocaleString()} defended
                      </p>
                    </div>
                    <div className="w-24 sm:w-36 shrink-0">
                      <DefenseRateBar rate={cat.defenseRate} />
                    </div>
                    <div className="text-[#9CA3AF] dark:text-[#6B7280] shrink-0 ml-1">
                      {isExpanded ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <OWASPRowExpanded owaspCategory={cat.owaspCategory} />
                  )}
                </div>
              )
            })}
      </div>
    </GlassCard>
  )
}

function AIModelsSection({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useDataModels>['data']
  isLoading: boolean
}) {
  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#F3F4F6] dark:border-[#2D2F36]">
              {[
                'Model',
                'Challenges',
                'Messages',
                'Defense Rate',
                'Security Score',
              ].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-[12px] font-semibold text-[#9CA3AF] dark:text-[#6B7280] uppercase tracking-[0.06em] whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6] dark:divide-[#2D2F36]">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <Skeleton className="h-4 w-20 rounded bg-[#F3F4F6] dark:bg-[#141518]" />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.models.map((m) => (
                  <tr
                    key={m.aiModel}
                    className="hover:bg-[#F9FAFB] dark:hover:bg-[#141518] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-[14px] font-medium text-[#0A0B0D] dark:text-[#F9FAFB]">
                        {m.aiModel}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[14px] text-[#4B5563] dark:text-[#D1D5DB] tabular-nums">
                      {m.challengeCount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-[14px] text-[#4B5563] dark:text-[#D1D5DB] tabular-nums">
                      {m.totalMessages.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <DefenseRateBar rate={m.defenseRate} />
                    </td>
                    <td className="px-5 py-3.5">
                      <SecurityScoreBadge score={m.securityScore} />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}

function AttackTypesSection({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useDataStats>['data']
  isLoading: boolean
}) {
  const attacks = data?.mostCommonAttackTypes ?? []
  const maxCount = attacks.length > 0 ? attacks[0].count : 1

  return (
    <GlassCard className="flex flex-col gap-3">
      {isLoading
        ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton
                className="h-4 rounded bg-[#F3F4F6] dark:bg-[#141518]"
                style={{ width: `${120 + ((i * 29) % 80)}px` }}
              />
              <Skeleton className="h-2 flex-1 rounded-full bg-[#F3F4F6] dark:bg-[#141518]" />
              <Skeleton className="h-4 w-8 rounded bg-[#F3F4F6] dark:bg-[#141518] shrink-0" />
            </div>
          ))
        : attacks.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[14px]">
                No attack data yet. Complete some challenges to see attack patterns.
              </p>
            </div>
          )
        : attacks.map((a) => {
            const pct = (a.count / maxCount) * 100
            return (
              <div key={a.attackType} className="flex items-center gap-3">
                <span className="text-[13px] text-[#4B5563] dark:text-[#D1D5DB] w-44 shrink-0 truncate">
                  {a.attackType}
                </span>
                <div className="flex-1 h-1.5 bg-[#F3F4F6] dark:bg-[#2D2F36] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0052FF] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[13px] tabular-nums text-[#9CA3AF] dark:text-[#6B7280] w-10 text-right shrink-0">
                  {formatNumberToKMB(a.count)}
                </span>
              </div>
            )
          })}
    </GlassCard>
  )
}

function TrendsSection({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useDataTrends>['data']
  isLoading: boolean
}) {
  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#F3F4F6] dark:border-[#2D2F36]">
              {['Date', 'Challenges', 'Messages', 'Defense Rate'].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-[12px] font-semibold text-[#9CA3AF] dark:text-[#6B7280] uppercase tracking-[0.06em] whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6] dark:divide-[#2D2F36]">
            {isLoading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <td key={j} className="px-5 py-3">
                        <Skeleton className="h-4 w-16 rounded bg-[#F3F4F6] dark:bg-[#141518]" />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.messageTrend.map((day, i) => {
                  const challengeDay = data.challengeTrend[i]
                  const isLowDefense = day.defenseRate < 0.5
                  return (
                    <tr
                      key={day.date}
                      className={cnm(
                        'transition-colors',
                        isLowDefense
                          ? 'bg-[rgba(207,32,47,0.03)] hover:bg-[rgba(207,32,47,0.05)]'
                          : 'hover:bg-[#F9FAFB] dark:hover:bg-[#141518]',
                      )}
                    >
                      <td className="px-5 py-3">
                        <span className="text-[13px] font-mono text-[#4B5563] dark:text-[#D1D5DB]">
                          {new Date(day.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[14px] text-[#0A0B0D] dark:text-[#F9FAFB] tabular-nums">
                        {challengeDay.count.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-[14px] text-[#0A0B0D] dark:text-[#F9FAFB] tabular-nums">
                        {day.totalMessages.toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cnm(
                            'text-[13px] font-medium tabular-nums',
                            isLowDefense ? 'text-[#CF202F]' : 'text-[#098551]',
                          )}
                        >
                          {(day.defenseRate * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}

function OnchainEventsSection({
  data,
  isLoading,
  isError,
}: {
  data: ReturnType<typeof useOnchainChallenges>['data']
  isLoading: boolean
  isError?: boolean
}) {
  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="divide-y divide-[#F3F4F6] dark:divide-[#2D2F36]">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="h-4 w-16 rounded bg-[#F3F4F6] dark:bg-[#141518] shrink-0" />
              <Skeleton className="h-4 rounded bg-[#F3F4F6] dark:bg-[#141518] flex-1" />
              <Skeleton className="h-3 w-20 rounded bg-[#F3F4F6] dark:bg-[#141518] shrink-0" />
            </div>
          ))
        ) : isError ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[14px]">
              Failed to load on-chain events. Please try again.
            </p>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[14px]">
              No on-chain events yet
            </p>
          </div>
        ) : (
          data.map((event) => (
            <div
              key={event.txHash}
              className="flex items-center gap-4 px-5 py-3.5"
            >
              <span className="text-[12px] font-semibold text-[#0052FF] shrink-0 tabular-nums min-w-[120px]">
                {event.eventType}
              </span>
              <span className="text-[13px] font-mono text-[#9CA3AF] dark:text-[#6B7280] truncate flex-1">
                {event.txHash.slice(0, 10)}...{event.txHash.slice(-6)}
              </span>
              <span className="text-[12px] text-[#9CA3AF] dark:text-[#6B7280] shrink-0 tabular-nums">
                {new Date(event.timestamp).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  )
}

function X402CatalogSection({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useX402Catalog>['data']
  isLoading: boolean
}) {
  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="divide-y divide-[#F3F4F6] dark:divide-[#2D2F36]">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="h-4 w-14 rounded bg-[#F3F4F6] dark:bg-[#141518] shrink-0" />
              <Skeleton className="h-4 rounded bg-[#F3F4F6] dark:bg-[#141518] flex-1" />
              <Skeleton className="h-4 w-16 rounded bg-[#F3F4F6] dark:bg-[#141518] shrink-0" />
            </div>
          ))
        ) : !data || data.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[14px]">
              No endpoints available
            </p>
          </div>
        ) : (
          data.map((entry) => (
            <div
              key={entry.path}
              className="flex items-center gap-4 px-5 py-3.5"
            >
              <span className="text-[11px] font-semibold text-[#4B5563] dark:text-[#D1D5DB] bg-[#F3F4F6] dark:bg-[#2D2F36] px-2 py-0.5 rounded font-mono shrink-0 w-12 text-center">
                {entry.method}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-mono text-[#0A0B0D] dark:text-[#F9FAFB] truncate">
                  {entry.path}
                </p>
                <p className="text-[12px] text-[#9CA3AF] dark:text-[#6B7280] truncate mt-0.5">
                  {entry.name || entry.description}
                </p>
              </div>
              <span className="text-[12px] font-semibold text-[#0052FF] shrink-0 tabular-nums">
                {entry.price}
              </span>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  )
}

function OnchainVolumeSection({
  data,
  isLoading,
  isError,
}: {
  data: ReturnType<typeof useOnchainVolume>['data']
  isLoading: boolean
  isError?: boolean
}) {
  return (
    <GlassCard className="p-0 overflow-hidden">
      {isLoading ? (
        <div className="flex items-center gap-6 px-5 py-5">
          {[120, 80, 96].map((w, i) => (
            <Skeleton
              key={i}
              className="h-6 rounded bg-[#F3F4F6] dark:bg-[#141518]"
              style={{ width: w }}
            />
          ))}
        </div>
      ) : isError || !data ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[14px]">
            {isError ? 'Failed to load volume data. Please try again.' : 'No volume data available yet.'}
          </p>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 divide-x divide-[#F3F4F6] dark:divide-[#2D2F36] sm:grid-cols-3">
            <div className="px-5 py-4">
              <p className="text-[12px] text-[#9CA3AF] dark:text-[#6B7280] font-medium uppercase tracking-[0.06em] mb-1">
                Total Volume
              </p>
              <p className="text-[22px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.02em]">
                ${formatNumberToKMB(parseFloat(data.totalVolumeUsdc))} USDC
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[12px] text-[#9CA3AF] dark:text-[#6B7280] font-medium uppercase tracking-[0.06em] mb-1">
                Transactions
              </p>
              <p className="text-[22px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.02em]">
                {data.transactionCount.toLocaleString()}
              </p>
            </div>
            <div className="px-5 py-4 col-span-2 sm:col-span-1">
              <p className="text-[12px] text-[#9CA3AF] dark:text-[#6B7280] font-medium uppercase tracking-[0.06em] mb-1">
                Period
              </p>
              <p className="text-[13px] font-mono text-[#4B5563] dark:text-[#D1D5DB]">
                Last {data.days} days
              </p>
            </div>
          </div>
          {data.breakdown.length > 0 && (
            <div className="border-t border-[#F3F4F6] dark:border-[#2D2F36] overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#F3F4F6] dark:border-[#2D2F36]">
                    {['Date', 'Volume (USDC)', 'Txns'].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-2.5 text-[11px] font-semibold text-[#9CA3AF] dark:text-[#6B7280] uppercase tracking-[0.06em] whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] dark:divide-[#2D2F36]">
                  {data.breakdown.slice(0, 7).map((row) => (
                    <tr
                      key={row.date}
                      className="hover:bg-[#F9FAFB] dark:hover:bg-[#141518] transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className="text-[13px] font-mono text-[#4B5563] dark:text-[#D1D5DB]">
                          {new Date(row.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[14px] text-[#0A0B0D] dark:text-[#F9FAFB] tabular-nums">
                        ${formatNumberToKMB(parseFloat(row.volume))}
                      </td>
                      <td className="px-5 py-3 text-[14px] text-[#4B5563] dark:text-[#D1D5DB] tabular-nums">
                        {row.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </GlassCard>
  )
}

function OnchainActivitySection({
  data,
  isLoading,
  isError,
}: {
  data: ReturnType<typeof useOnchainActivity>['data']
  isLoading: boolean
  isError?: boolean
}) {
  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="divide-y divide-[#F3F4F6] dark:divide-[#2D2F36]">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="h-4 w-24 rounded bg-[#F3F4F6] dark:bg-[#141518] shrink-0" />
              <Skeleton className="h-4 rounded bg-[#F3F4F6] dark:bg-[#141518] flex-1" />
              <Skeleton className="h-3 w-20 rounded bg-[#F3F4F6] dark:bg-[#141518] shrink-0" />
            </div>
          ))
        ) : isError ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[14px]">
              Failed to load activity data. Please try again.
            </p>
          </div>
        ) : !data || data.events.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[14px]">
              No activity yet
            </p>
          </div>
        ) : (
          data.events.slice(0, 10).map((event) => (
            <div
              key={event.txHash}
              className="flex items-center gap-4 px-5 py-3.5"
            >
              <span className="text-[12px] font-semibold text-[#0052FF] shrink-0 min-w-[130px]">
                {event.eventType}
              </span>
              <span className="text-[13px] font-mono text-[#9CA3AF] dark:text-[#6B7280] truncate flex-1">
                {event.txHash.slice(0, 10)}...{event.txHash.slice(-6)}
              </span>
              <span className="text-[12px] text-[#9CA3AF] dark:text-[#6B7280] shrink-0 tabular-nums">
                {new Date(event.timestamp).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  )
}

function FeeDistributorSection() {
  const { totalCollected, totalDistributed, agentWallet } =
    useFeeDistributorStats()

  const collected =
    typeof totalCollected.data === 'bigint' ? totalCollected.data : null
  const distributed =
    typeof totalDistributed.data === 'bigint' ? totalDistributed.data : null
  const wallet = typeof agentWallet.data === 'string' ? agentWallet.data : null

  const USDC_DECIMALS = 6n

  function formatUsdc(raw: bigint): string {
    const whole = raw / 10n ** USDC_DECIMALS
    const frac = raw % 10n ** USDC_DECIMALS
    const fracStr = frac.toString().padStart(6, '0').slice(0, 2)
    return `$${Number(whole).toLocaleString()}.${fracStr}`
  }

  const pending =
    collected !== null && distributed !== null ? collected - distributed : null

  const isLoading =
    totalCollected.isLoading ||
    totalDistributed.isLoading ||
    agentWallet.isLoading

  return (
    <AnimateComponent onScroll entry="fadeInUp" delay={50}>
      <SectionTitle>FeeDistributor Protocol</SectionTitle>
      <GlassCard variant="accent" className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <p className="text-[12px] text-[#9CA3AF] dark:text-[#6B7280] font-medium uppercase tracking-[0.06em]">
              Total Collected
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-28 rounded bg-[rgba(0,82,255,0.08)]" />
            ) : collected !== null ? (
              <p className="text-[24px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.02em]">
                {formatUsdc(collected)}
              </p>
            ) : (
              <p className="text-[24px] font-semibold text-[#9CA3AF] dark:text-[#6B7280]">
                —
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[12px] text-[#9CA3AF] dark:text-[#6B7280] font-medium uppercase tracking-[0.06em]">
              Total Distributed
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-28 rounded bg-[rgba(0,82,255,0.08)]" />
            ) : distributed !== null ? (
              <p className="text-[24px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.02em]">
                {formatUsdc(distributed)}
              </p>
            ) : (
              <p className="text-[24px] font-semibold text-[#9CA3AF] dark:text-[#6B7280]">
                —
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[12px] text-[#9CA3AF] dark:text-[#6B7280] font-medium uppercase tracking-[0.06em]">
              Pending Balance
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-28 rounded bg-[rgba(0,82,255,0.08)]" />
            ) : pending !== null ? (
              <p
                className={cnm(
                  'text-[24px] font-semibold tracking-[-0.02em]',
                  pending > 0n
                    ? 'text-[#0052FF]'
                    : 'text-[#0A0B0D] dark:text-[#F9FAFB]',
                )}
              >
                {formatUsdc(pending)}
              </p>
            ) : (
              <p className="text-[24px] font-semibold text-[#9CA3AF] dark:text-[#6B7280]">
                —
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-[rgba(0,82,255,0.1)] pt-4">
          <p className="text-[12px] text-[#9CA3AF] dark:text-[#6B7280] font-medium uppercase tracking-[0.06em] mb-1.5">
            Agent Wallet
          </p>
          {isLoading ? (
            <Skeleton className="h-5 w-64 rounded bg-[rgba(0,82,255,0.08)]" />
          ) : wallet ? (
            <p className="text-[13px] font-mono text-[#4B5563] dark:text-[#D1D5DB] break-all">
              {wallet}
            </p>
          ) : (
            <p className="text-[13px] text-[#9CA3AF] dark:text-[#6B7280]">
              Not configured
            </p>
          )}
        </div>
      </GlassCard>
    </AnimateComponent>
  )
}

// --- Page ---

type SectionKey =
  | 'stats'
  | 'models'
  | 'trends'
  | 'onchain_challenges'
  | 'onchain_volume'
  | 'onchain_activity'

const SECTION_PRICES: Record<SectionKey, string> = {
  stats: '$0.001',
  models: '$0.01',
  trends: '$0.05',
  onchain_challenges: '$0.01',
  onchain_volume: '$0.01',
  onchain_activity: '$0.01',
}

function AnalyticsPage() {
  const [unlocked, setUnlocked] = useState<Set<SectionKey>>(new Set())
  const factoryAddress = config.contracts.challengeFactory

  function unlock(key: SectionKey) {
    setUnlocked((prev) => new Set([...prev, key]))
  }

  const statsEnabled = unlocked.has('stats')
  const modelsEnabled = unlocked.has('models')
  const trendsEnabled = unlocked.has('trends')
  const onchainChallengesEnabled = unlocked.has('onchain_challenges')
  const onchainVolumeEnabled = unlocked.has('onchain_volume')
  const onchainActivityEnabled = unlocked.has('onchain_activity')

  const statsQuery = useDataStats({ enabled: statsEnabled })
  const modelsQuery = useDataModels({ enabled: modelsEnabled })
  const trendsQuery = useDataTrends({ enabled: trendsEnabled })
  const onchainChallengesQuery = useOnchainChallenges(10, {
    enabled: onchainChallengesEnabled,
  })
  const onchainVolumeQuery = useOnchainVolume(factoryAddress, undefined, {
    enabled: onchainVolumeEnabled,
  })
  const onchainActivityQuery = useOnchainActivity(factoryAddress, undefined, {
    enabled: onchainActivityEnabled,
  })
  const catalogQuery = useX402Catalog()

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0B0D] px-4 py-12">
      <div className="max-w-[980px] mx-auto">
        <AnimateComponent entry="fadeInUp">
          <div className="mb-12">
            <h1 className="text-[28px] sm:text-[40px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.02em] leading-[1.1] mb-2">
              Analytics
            </h1>
            <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[17px]">
              Platform intelligence and AI security data
            </p>
          </div>
        </AnimateComponent>

        <div className="flex flex-col gap-10">
          {/* Platform Stats + OWASP + Attack Types (one payment, same /data/stats endpoint) */}
          {statsEnabled ? (
            <>
              <AnimateComponent onScroll entry="fadeInUp" delay={0}>
                <SectionTitle>Platform Stats</SectionTitle>
                <PlatformStatsSection
                  data={statsQuery.data}
                  isLoading={statsQuery.isLoading}
                />
              </AnimateComponent>

              <AnimateComponent onScroll entry="fadeInUp" delay={50}>
                <SectionTitle>OWASP LLM Defense Rates</SectionTitle>
                <OWASPSection
                  data={statsQuery.data}
                  isLoading={statsQuery.isLoading}
                />
              </AnimateComponent>

              <AnimateComponent onScroll entry="fadeInUp" delay={50}>
                <SectionTitle>Attack Type Distribution</SectionTitle>
                <AttackTypesSection
                  data={statsQuery.data}
                  isLoading={statsQuery.isLoading}
                />
              </AnimateComponent>
            </>
          ) : (
            <AnimateComponent onScroll entry="fadeInUp" delay={0}>
              <SectionTitle>Platform Intelligence</SectionTitle>
              <LockedSection
                title="Stats, OWASP Defense Rates & Attack Patterns"
                price={SECTION_PRICES.stats}
                onUnlock={() => unlock('stats')}
                skeletonRows={6}
              />
            </AnimateComponent>
          )}

          {/* AI Model Comparison */}
          <AnimateComponent onScroll entry="fadeInUp" delay={50}>
            <SectionTitle>AI Model Comparison</SectionTitle>
            {modelsEnabled ? (
              <AIModelsSection
                data={modelsQuery.data}
                isLoading={modelsQuery.isLoading}
              />
            ) : (
              <LockedSection
                title="AI Model Comparison"
                price={SECTION_PRICES.models}
                onUnlock={() => unlock('models')}
                skeletonRows={4}
              />
            )}
          </AnimateComponent>

          {/* 30-Day Trends */}
          <AnimateComponent onScroll entry="fadeInUp" delay={50}>
            <SectionTitle>30-Day Trends</SectionTitle>
            {trendsEnabled ? (
              <TrendsSection
                data={trendsQuery.data}
                isLoading={trendsQuery.isLoading}
              />
            ) : (
              <LockedSection
                title="30-Day Trends"
                price={SECTION_PRICES.trends}
                onUnlock={() => unlock('trends')}
                skeletonRows={7}
              />
            )}
          </AnimateComponent>

          {/* On-chain Events */}
          <AnimateComponent onScroll entry="fadeInUp" delay={50}>
            <SectionTitle>On-chain Events</SectionTitle>
            {onchainChallengesEnabled ? (
              <OnchainEventsSection
                data={onchainChallengesQuery.data}
                isLoading={onchainChallengesQuery.isLoading}
                isError={onchainChallengesQuery.isError}
              />
            ) : (
              <LockedSection
                title="On-chain Events"
                price={SECTION_PRICES.onchain_challenges}
                onUnlock={() => unlock('onchain_challenges')}
                skeletonRows={5}
              />
            )}
          </AnimateComponent>

          {/* On-chain Volume */}
          <AnimateComponent onScroll entry="fadeInUp" delay={50}>
            <SectionTitle>On-chain Volume</SectionTitle>
            {onchainVolumeEnabled ? (
              <OnchainVolumeSection
                data={onchainVolumeQuery.data}
                isLoading={onchainVolumeQuery.isLoading}
                isError={onchainVolumeQuery.isError}
              />
            ) : (
              <LockedSection
                title="On-chain Volume"
                price={SECTION_PRICES.onchain_volume}
                onUnlock={() => unlock('onchain_volume')}
                skeletonRows={4}
              />
            )}
          </AnimateComponent>

          {/* On-chain Activity */}
          <AnimateComponent onScroll entry="fadeInUp" delay={50}>
            <SectionTitle>On-chain Activity</SectionTitle>
            {onchainActivityEnabled ? (
              <OnchainActivitySection
                data={onchainActivityQuery.data}
                isLoading={onchainActivityQuery.isLoading}
                isError={onchainActivityQuery.isError}
              />
            ) : (
              <LockedSection
                title="On-chain Activity"
                price={SECTION_PRICES.onchain_activity}
                onUnlock={() => unlock('onchain_activity')}
                skeletonRows={5}
              />
            )}
          </AnimateComponent>

          {/* x402 API Catalog — always visible, no payment gate */}
          <AnimateComponent onScroll entry="fadeInUp" delay={50}>
            <SectionTitle>x402 API Catalog</SectionTitle>
            <X402CatalogSection
              data={catalogQuery.data}
              isLoading={catalogQuery.isLoading}
            />
          </AnimateComponent>

          {/* FeeDistributor — always visible, reads on-chain directly */}
          <FeeDistributorSection />
        </div>
      </div>
    </div>
  )
}
