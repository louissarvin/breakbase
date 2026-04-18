import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { DollarSign, MessageSquare, TrendingUp, Trophy } from 'lucide-react'
import { Skeleton, Tab, Tabs } from '@heroui/react'
import type { Address } from 'viem'
import GlassCard from '@/components/GlassCard'
import { useBatchBasenames, useLeaderboard } from '@/lib/api/hooks'
import { cnm } from '@/utils/style'

export const Route = createFileRoute('/leaderboard')({
  component: LeaderboardPage,
})

type LeaderboardCategory = 'wins' | 'messages' | 'earnings' | 'spent'

const TAB_CONFIG: Array<{
  key: LeaderboardCategory
  label: string
  icon: React.ElementType
  metric: string
  format: (v: number) => string
}> = [
  {
    key: 'wins',
    label: 'Top Winners',
    icon: Trophy,
    metric: 'Wins',
    format: (v) => v.toString(),
  },
  {
    key: 'messages',
    label: 'Most Active',
    icon: MessageSquare,
    metric: 'Attacks',
    format: (v) => v.toLocaleString(),
  },
  {
    key: 'earnings',
    label: 'Top Earners',
    icon: DollarSign,
    metric: 'Earned',
    format: (v) => `$${v.toFixed(2)}`,
  },
  {
    key: 'spent',
    label: 'Most Spent',
    icon: TrendingUp,
    metric: 'Spent',
    format: (v) => `$${v.toFixed(2)}`,
  },
]

interface LeaderboardEntry {
  rank: number
  address: Address
  value: number
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="text-[#B8860B] text-[15px] font-bold w-8 text-center">
        1
      </span>
    )
  if (rank === 2)
    return (
      <span className="text-[#9CA3AF] text-[15px] font-bold w-8 text-center">
        2
      </span>
    )
  if (rank === 3)
    return (
      <span className="text-[#CD7F32] text-[15px] font-bold w-8 text-center">
        3
      </span>
    )
  return (
    <span className="text-[#D1D5DB] text-[14px] font-medium w-8 text-center">
      {rank}
    </span>
  )
}

function AddressCell({
  address,
  basename,
}: {
  address: Address
  basename?: string
}) {
  const display = basename ?? `${address.slice(0, 6)}...${address.slice(-4)}`
  return (
    <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[15px]">
      {basename ? display : <span className="font-mono">{display}</span>}
    </span>
  )
}

function LeaderboardRow({
  entry,
  metric,
  formatValue,
  basename,
}: {
  entry: LeaderboardEntry
  metric: string
  formatValue: (v: number) => string
  basename?: string
}) {
  const isTop3 = entry.rank <= 3

  return (
    <div
      className={cnm(
        'flex items-center gap-4 px-5 py-4 rounded-2xl transition-colors duration-150',
        isTop3
          ? 'bg-[#F5F8FF] dark:bg-[#0A1628] border border-[#0052FF]/10'
          : 'hover:bg-[#F9FAFB] dark:hover:bg-[#141518]',
      )}
    >
      <RankBadge rank={entry.rank} />
      <div className="flex-1 min-w-0">
        <AddressCell address={entry.address} basename={basename} />
      </div>
      <div className="text-right shrink-0">
        <p className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[15px] font-semibold">
          {formatValue(entry.value)}
        </p>
        <p className="text-[#9CA3AF] text-[12px]">{metric}</p>
      </div>
    </div>
  )
}

function LeaderboardPage() {
  const [tab, setTab] = useState<LeaderboardCategory>('wins')
  const {
    data: leaderboardData,
    isLoading,
    isError,
  } = useLeaderboard({ metric: tab })

  const tabConfig = TAB_CONFIG.find((t) => t.key === tab)!

  const { mutate: batchResolve, data: batchData } = useBatchBasenames()

  const addresses =
    leaderboardData?.leaderboard.map((e) => e.walletAddress) ?? []

  useEffect(() => {
    if (addresses.length > 0) {
      batchResolve(addresses)
    }
  }, [leaderboardData]) // batchResolve is stable (mutation fn ref)

  const basenameMap: Record<string, string | undefined> = {}
  if (batchData?.results) {
    for (const [addr, name] of Object.entries(batchData.results)) {
      if (name) basenameMap[addr.toLowerCase()] = name
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0B0D] px-4 py-12">
      <div className="max-w-[980px] mx-auto">
        <div className="mb-10">
          <h1 className="text-[40px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.02em] leading-[1.1] mb-2">
            Leaderboard
          </h1>
          <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[17px]">
            Who's breaking the most AI?
          </p>
        </div>

        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) => setTab(key as LeaderboardCategory)}
          classNames={{
            tabList:
              'bg-[#F3F4F6] dark:bg-[#141518] rounded-2xl p-1 gap-1 mb-8',
            tab: 'rounded-xl text-[14px] font-medium text-[#4B5563] dark:text-[#D1D5DB] data-[selected=true]:bg-[#0052FF] data-[selected=true]:text-white',
            cursor: 'hidden',
          }}
          variant="light"
        >
          {TAB_CONFIG.map((t) => (
            <Tab
              key={t.key}
              title={
                <div className="flex items-center gap-1.5">
                  <t.icon size={14} />
                  <span>{t.label}</span>
                </div>
              }
            />
          ))}
        </Tabs>

        <GlassCard className="p-2">
          {isLoading ? (
            <div className="flex flex-col gap-1 p-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl"
                >
                  <Skeleton className="h-5 w-5 rounded-full bg-[#F3F4F6] dark:bg-[#141518] shrink-0" />
                  <Skeleton
                    className="h-5 rounded-lg bg-[#F3F4F6] dark:bg-[#141518]"
                    style={{ width: `${180 + ((i * 37) % 100)}px` }}
                  />
                  <Skeleton className="h-5 w-16 rounded-lg bg-[#F3F4F6] dark:bg-[#141518] ml-auto shrink-0" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-12">
              <p className="text-[#CF202F] text-[17px] font-medium">
                Failed to load leaderboard.
              </p>
            </div>
          ) : !leaderboardData?.leaderboard ||
            leaderboardData.leaderboard.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[17px]">
                No data yet.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {leaderboardData.leaderboard.map((apiEntry) => {
                const valueMap: Record<LeaderboardCategory, number> = {
                  wins: apiEntry.totalWins,
                  messages: apiEntry.totalMessages,
                  earnings: parseFloat(apiEntry.totalEarningsUsdc) / 1e6,
                  spent: parseFloat(apiEntry.totalSpentUsdc) / 1e6,
                }
                const entry: LeaderboardEntry = {
                  rank: apiEntry.rank,
                  address: apiEntry.walletAddress as Address,
                  value: valueMap[tab],
                }
                return (
                  <LeaderboardRow
                    key={apiEntry.walletAddress}
                    entry={entry}
                    metric={tabConfig.metric}
                    formatValue={tabConfig.format}
                    basename={basenameMap[apiEntry.walletAddress.toLowerCase()]}
                  />
                )
              })}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
