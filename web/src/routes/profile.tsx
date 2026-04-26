import { Link, createFileRoute } from '@tanstack/react-router'
import { useAccount } from 'wagmi'
import {
  ExternalLink,
  MessageSquare,
  Percent,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
} from 'lucide-react'
import { Skeleton } from '@heroui/react'
import GlassCard from '@/components/GlassCard'
import ChallengeCard from '@/components/ChallengeCard'
import ConnectButton from '@/components/ConnectButton'
import {
  useBasename,
  useBasenameProfile,
  useChallenges,
  useMe,
  useVerification,
} from '@/lib/api/hooks'
import { useUSDCBalance } from '@/lib/contracts/hooks'

export const Route = createFileRoute('/profile')({ component: ProfilePage })

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  loading,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
  loading?: boolean
}) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} style={{ color }} />
        <span className="text-[#9CA3AF] text-[12px] font-semibold uppercase tracking-[0.5px]">
          {label}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24 rounded-lg bg-[#F3F4F6] dark:bg-[#141518] mt-1" />
      ) : (
        <p className="text-[28px] font-bold text-[#0A0B0D] dark:text-[#F9FAFB] leading-tight">
          {value}
        </p>
      )}
    </GlassCard>
  )
}

function AvatarGradient({ address }: { address: string }) {
  // Deterministic hue from address for a unique but consistent gradient
  const hue = parseInt(address.slice(2, 6), 16) % 360
  const hue2 = (hue + 40) % 360
  return (
    <div
      className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: `linear-gradient(135deg, hsl(${hue},80%,55%), hsl(${hue2},70%,45%))`,
      }}
    >
      <span className="text-white text-[24px] font-bold select-none">
        {address.slice(2, 3).toUpperCase()}
      </span>
    </div>
  )
}

function ProfilePage() {
  const { address, isConnected } = useAccount()

  const { data: me, isLoading: meLoading } = useMe({ enabled: isConnected })
  const { data: basenameData } = useBasename(address ?? '', {
    enabled: !!address,
  })
  const basename = basenameData?.basename
  const { data: basenameProfile } = useBasenameProfile(basename ?? '', {
    enabled: !!basename,
  })
  const { data: usdcBalance } = useUSDCBalance(address)
  const { data: verification } = useVerification(address ?? '')
  const { data: createdChallenges, isLoading: challengesLoading } =
    useChallenges({ defender: address, limit: '50' }, { enabled: !!address })

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0B0D] px-4 py-20 flex items-center justify-center">
        <GlassCard className="text-center max-w-sm p-8">
          <div className="w-14 h-14 rounded-2xl bg-[#0052FF]/10 flex items-center justify-center mx-auto mb-5">
            <ShieldCheck size={24} className="text-[#0052FF]" />
          </div>
          <h2 className="text-[21px] font-bold text-[#0A0B0D] dark:text-[#F9FAFB] mb-2">
            Connect to view profile
          </h2>
          <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[15px] mb-6">
            Your stats, challenges, and history live here.
          </p>
          <ConnectButton />
        </GlassCard>
      </div>
    )
  }

  const displayName =
    basenameData?.basename ?? `${address!.slice(0, 6)}...${address!.slice(-4)}`
  const hasBasename = !!basenameData?.basename

  // Richer profile data from basename profile lookup
  const profileDescription = basenameProfile?.description
  const profileUrl = basenameProfile?.url
  const profileAvatar = basenameProfile?.avatar ?? basenameData?.avatar

  const usdcHuman =
    usdcBalance !== undefined ? Number(usdcBalance) / 1e6 : undefined
  const isVerified = !!verification?.verified

  const totalWins = me?.totalWins ?? 0
  const totalMessages = me?.totalMessages ?? 0
  const totalSpent = me?.totalSpentUsdc ? parseFloat(me.totalSpentUsdc) : 0
  const totalEarnings = me?.totalEarningsUsdc
    ? parseFloat(me.totalEarningsUsdc)
    : 0
  const winRate =
    totalMessages > 0 ? ((totalWins / totalMessages) * 100).toFixed(1) : '0.0'

  const joinDate = me?.createdAt
    ? new Date(me.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null

  const isLoading = meLoading

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0B0D] px-4 py-12">
      <div className="max-w-[980px] mx-auto">
        {/* Profile header */}
        <GlassCard className="mb-8 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {profileAvatar ? (
              <img
                src={profileAvatar}
                alt={displayName}
                className="w-16 h-16 rounded-full object-cover shrink-0"
              />
            ) : (
              <AvatarGradient address={address!} />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-[24px] font-bold text-[#0A0B0D] dark:text-[#F9FAFB] truncate">
                  {displayName}
                </h1>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#098551]/10 text-[#098551] border border-[#098551]/20 shrink-0">
                    <ShieldCheck size={11} />
                    Verified on Base
                  </span>
                )}
              </div>
              {hasBasename && (
                <p className="text-[#9CA3AF] font-mono text-[12px] truncate">
                  {address}
                </p>
              )}
              {profileDescription && (
                <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px] mt-1 max-w-[420px]">
                  {profileDescription}
                </p>
              )}
              {profileUrl && (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0052FF] hover:text-[#3377FF] text-[13px] mt-0.5 inline-block transition-colors"
                >
                  {profileUrl.replace(/^https?:\/\//, '')}
                </a>
              )}
              {joinDate && (
                <p className="text-[#9CA3AF] text-[12px] mt-0.5">
                  Joined {joinDate}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1 sm:text-right shrink-0">
              <p className="text-[#9CA3AF] text-[12px] uppercase tracking-[0.5px] font-semibold">
                USDC Balance
              </p>
              {usdcHuman !== undefined ? (
                <p className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[20px] font-bold">
                  ${usdcHuman.toFixed(2)}
                </p>
              ) : (
                <Skeleton className="h-8 w-28 rounded-lg bg-[#F3F4F6] dark:bg-[#141518]" />
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
            <a
              href={`https://basescan.org/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#9CA3AF] hover:text-[#0052FF] text-[13px] transition-colors"
            >
              View on BaseScan
              <ExternalLink size={12} />
            </a>
          </div>
        </GlassCard>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={Trophy}
            label="Wins"
            value={totalWins.toString()}
            color="#B8860B"
            loading={isLoading}
          />
          <StatCard
            icon={MessageSquare}
            label="Attacks"
            value={totalMessages.toLocaleString()}
            color="#0052FF"
            loading={isLoading}
          />
          <StatCard
            icon={Percent}
            label="Win Rate"
            value={`${winRate}%`}
            color="#6366F1"
            loading={isLoading}
          />
          <StatCard
            icon={TrendingUp}
            label="Earned"
            value={`$${totalEarnings.toFixed(2)}`}
            color="#098551"
            loading={isLoading}
          />
          <StatCard
            icon={TrendingDown}
            label="Spent"
            value={`$${totalSpent.toFixed(2)}`}
            color="#CF202F"
            loading={isLoading}
          />
          <StatCard
            icon={Wallet}
            label="On-chain Balance"
            value={usdcHuman !== undefined ? `$${usdcHuman.toFixed(2)}` : '--'}
            color="#0052FF"
            loading={usdcHuman === undefined && isConnected}
          />
        </div>

        {/* Created Challenges */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[21px] font-bold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.02em]">
              My Challenges
            </h2>
            <Link to="/challenges/create">
              <button
                type="button"
                className="text-[#0052FF] hover:text-[#3377FF] text-[14px] font-medium transition-colors"
              >
                + Create new
              </button>
            </Link>
          </div>

          {challengesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => (
                <Skeleton
                  key={i}
                  className="h-[260px] rounded-[20px] bg-[#F3F4F6] dark:bg-[#141518]"
                />
              ))}
            </div>
          ) : createdChallenges?.challenges &&
            createdChallenges.challenges.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {createdChallenges.challenges.map((c) => (
                <ChallengeCard key={c.id} challenge={c} />
              ))}
            </div>
          ) : (
            <GlassCard variant="subtle" className="text-center py-10">
              <p className="text-[#9CA3AF] text-[15px]">
                No challenges created yet.
              </p>
              <Link
                to="/challenges/create"
                className="inline-block mt-3 text-[#0052FF] hover:text-[#3377FF] text-[14px] transition-colors"
              >
                Create your first challenge
              </Link>
            </GlassCard>
          )}
        </div>

        {/* Attack History - summary from useMe stats */}
        <div>
          <h2 className="text-[21px] font-bold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.02em] mb-5">
            Attack History
          </h2>

          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton
                  key={i}
                  className="h-16 rounded-2xl bg-[#F3F4F6] dark:bg-[#141518]"
                />
              ))}
            </div>
          ) : totalMessages > 0 ? (
            <GlassCard className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <p className="text-[#9CA3AF] text-[11px] uppercase tracking-[0.5px] font-semibold mb-1">
                    Total Attacks
                  </p>
                  <p className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[22px] font-bold">
                    {totalMessages.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[#9CA3AF] text-[11px] uppercase tracking-[0.5px] font-semibold mb-1">
                    Successful Breaks
                  </p>
                  <p className="text-[#B8860B] text-[22px] font-bold">
                    {totalWins}
                  </p>
                </div>
                <div>
                  <p className="text-[#9CA3AF] text-[11px] uppercase tracking-[0.5px] font-semibold mb-1">
                    Win Rate
                  </p>
                  <p className="text-[#6366F1] text-[22px] font-bold">
                    {winRate}%
                  </p>
                </div>
                <div>
                  <p className="text-[#9CA3AF] text-[11px] uppercase tracking-[0.5px] font-semibold mb-1">
                    Total Spent
                  </p>
                  <p className="text-[#CF202F] text-[22px] font-bold">
                    ${totalSpent.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="mt-5 pt-5 border-t border-black/[0.06] dark:border-white/[0.06]">
                <Link
                  to="/challenges"
                  className="inline-flex items-center gap-1.5 text-[#0052FF] hover:text-[#3377FF] text-[14px] font-medium transition-colors"
                >
                  Browse active challenges
                  <ExternalLink size={13} />
                </Link>
              </div>
            </GlassCard>
          ) : (
            <GlassCard variant="subtle" className="text-center py-10">
              <p className="text-[#9CA3AF] text-[15px]">No attacks yet.</p>
              <Link
                to="/challenges"
                className="inline-block mt-3 text-[#0052FF] hover:text-[#3377FF] text-[14px] transition-colors"
              >
                Browse challenges to start attacking
              </Link>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  )
}
