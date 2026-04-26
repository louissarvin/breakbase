import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { Button, Pagination, Skeleton } from '@heroui/react'
import { z } from 'zod'
import GlassCard from '@/components/GlassCard'
import ChallengeCard from '@/components/ChallengeCard'
import { useChallenges } from '@/lib/api/hooks'

const searchSchema = z.object({
  page: z.number().optional().default(1),
  status: z
    .enum(['active', 'resolved', 'expired', 'cancelled', 'all'])
    .optional()
    .default('all'),
  difficulty: z
    .enum(['easy', 'medium', 'hard', 'expert', 'all'])
    .optional()
    .default('all'),
  pricingModel: z
    .enum(['fixed', 'escalating', 'all'])
    .optional()
    .default('all'),
  sort: z
    .enum(['prizePool', 'newest', 'messageCount'])
    .optional()
    .default('newest'),
})

export const Route = createFileRoute('/challenges/')({
  validateSearch: searchSchema,
  component: ChallengesPage,
})

const PAGE_SIZE = 12

const STATUS_OPTIONS = [
  'all',
  'active',
  'resolved',
  'expired',
  'cancelled',
] as const
const DIFFICULTY_OPTIONS = ['all', 'easy', 'medium', 'hard', 'expert'] as const
const PRICING_OPTIONS = ['all', 'fixed', 'escalating'] as const
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'prizePool', label: 'Prize Pool' },
  { value: 'messageCount', label: 'Most Attacked' },
] as const

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type StatusFilter = 'active' | 'resolved' | 'expired' | 'cancelled' | 'all'
type DifficultyFilter = 'easy' | 'medium' | 'hard' | 'expert' | 'all'
type PricingFilter = 'fixed' | 'escalating' | 'all'
type SortOption = 'prizePool' | 'newest' | 'messageCount'

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'px-3 py-1 rounded-full text-[13px] font-semibold bg-[#0052FF] text-white transition-all duration-150'
          : 'px-3 py-1 rounded-full text-[13px] font-medium bg-[#F3F4F6] dark:bg-[#141518] border border-black/[0.08] dark:border-white/[0.08] text-[#4B5563] dark:text-[#D1D5DB] hover:bg-[#E5E7EB] dark:hover:bg-[#1E2028] transition-all duration-150'
      }
    >
      {label}
    </button>
  )
}

function ChallengesPage() {
  const search = Route.useSearch()

  const [status, setStatus] = useState<StatusFilter>(search.status ?? 'all')
  const [difficulty, setDifficulty] = useState<DifficultyFilter>(
    search.difficulty ?? 'all',
  )
  const [pricingModel, setPricingModel] = useState<PricingFilter>(
    search.pricingModel ?? 'all',
  )
  const [sort, setSort] = useState<SortOption>(search.sort ?? 'newest')
  const [page, setPage] = useState(search.page ?? 1)

  const sortByMap: Record<SortOption, string> = {
    newest: 'createdAt',
    prizePool: 'prizePool',
    messageCount: 'messageCount',
  }

  const queryParams = {
    status: status === 'all' ? undefined : capitalize(status),
    difficulty: difficulty === 'all' ? undefined : capitalize(difficulty),
    pricingModel: pricingModel === 'all' ? undefined : capitalize(pricingModel),
    sortBy: sortByMap[sort],
    sortOrder: 'desc',
    page: String(page),
    limit: String(PAGE_SIZE),
  }

  const { data, isLoading, isError } = useChallenges(queryParams)
  const challenges = data?.challenges
  const totalPages = data?.pagination?.totalPages ?? 1

  function updateFilter<T>(setter: (v: T) => void, value: T) {
    setter(value)
    setPage(1)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0B0D] px-4 py-12">
      <div className="max-w-[980px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[40px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.02em] leading-[1.1]">
              Challenges
            </h1>
            <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[17px] mt-1">
              Find an AI to break and claim the prize.
            </p>
          </div>
          <Link to="/challenges/create">
            <Button className="bg-[#0052FF] hover:bg-[#3377FF] text-white rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-150 shrink-0 flex items-center gap-2 h-auto">
              <Plus size={15} />
              Create
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <GlassCard variant="subtle" className="p-4 mb-8">
          <div className="flex flex-col gap-4">
            {/* Status */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[#9CA3AF] text-[12px] font-semibold uppercase tracking-[0.5px] w-16 shrink-0">
                Status
              </span>
              {STATUS_OPTIONS.map((s) => (
                <FilterPill
                  key={s}
                  label={capitalize(s)}
                  active={status === s}
                  onClick={() => updateFilter(setStatus, s as StatusFilter)}
                />
              ))}
            </div>

            {/* Difficulty */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[#9CA3AF] text-[12px] font-semibold uppercase tracking-[0.5px] w-16 shrink-0">
                Level
              </span>
              {DIFFICULTY_OPTIONS.map((d) => (
                <FilterPill
                  key={d}
                  label={capitalize(d)}
                  active={difficulty === d}
                  onClick={() =>
                    updateFilter(setDifficulty, d as DifficultyFilter)
                  }
                />
              ))}
            </div>

            {/* Pricing */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[#9CA3AF] text-[12px] font-semibold uppercase tracking-[0.5px] w-16 shrink-0">
                Pricing
              </span>
              {PRICING_OPTIONS.map((p) => (
                <FilterPill
                  key={p}
                  label={capitalize(p)}
                  active={pricingModel === p}
                  onClick={() =>
                    updateFilter(setPricingModel, p as PricingFilter)
                  }
                />
              ))}
            </div>

            {/* Sort */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <span className="text-[#9CA3AF] text-[12px] font-semibold uppercase tracking-[0.5px] w-16 shrink-0 flex items-center gap-1">
                <SlidersHorizontal size={11} /> Sort
              </span>
              {SORT_OPTIONS.map((s) => (
                <FilterPill
                  key={s.value}
                  label={s.label}
                  active={sort === s.value}
                  onClick={() => updateFilter(setSort, s.value as SortOption)}
                />
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-[280px] rounded-[20px] bg-[#F3F4F6] dark:bg-[#141518]"
              />
            ))}
          </div>
        ) : isError ? (
          <GlassCard className="text-center py-16">
            <p className="text-[#CF202F] text-[17px] font-medium">
              Failed to load challenges.
            </p>
            <p className="text-[#4B5563] dark:text-[#D1D5DB] text-sm mt-1">
              Please try again later.
            </p>
          </GlassCard>
        ) : challenges && challenges.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {challenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center mt-10">
                <Pagination
                  total={totalPages}
                  page={page}
                  onChange={setPage}
                  classNames={{
                    cursor: 'bg-[#0052FF]',
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <GlassCard className="text-center py-16">
            <p className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[17px] font-medium">
              No challenges match your filters.
            </p>
            <p className="text-[#4B5563] dark:text-[#D1D5DB] text-sm mt-1">
              Try adjusting the filters or create a new challenge.
            </p>
            <Link to="/challenges/create">
              <Button className="mt-6 bg-[#0052FF] hover:bg-[#3377FF] text-white rounded-full px-6 py-2 text-sm font-semibold">
                Create Challenge
              </Button>
            </Link>
          </GlassCard>
        )}
      </div>
    </div>
  )
}
