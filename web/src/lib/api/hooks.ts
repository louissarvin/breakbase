import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import type { UseQueryOptions } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

// --- API wrapper ---

interface ApiResponse<T> {
  success: boolean
  data: T
  error: string | null
}

function unwrap<T>(res: ApiResponse<T>): T {
  return res.data
}

// --- Auth types ---

export interface User {
  address: string
  basename?: string
  reputation?: number
  createdAt: string
  lastSignIn?: string
  totalMessages?: number
  totalWins?: number
  totalSpentUsdc?: string
  totalEarningsUsdc?: string
}

export interface NonceResponse {
  nonce: string
  message: string
}

export interface AuthVerifyRequest {
  message: string
  signature: string
  address: string
}

export interface AuthVerifyResponse {
  token: string
  user: User
}

// --- Challenge types ---

export interface Challenge {
  id: string
  challengeId: string
  cloneAddress: string
  defender: string
  title: string
  description?: string
  aiModel: string
  basePrice: string
  duration: number
  pricingModel: string
  difficulty: string
  challengeType?: string
  tags?: Array<string>
  status: string
  prizePool: string
  messageCount: number
  endTime: string
  createdAt: string
  agentName?: string
  agentStyle?: string
  agentGreeting?: string
  winnerAddress?: string | null
  winnerAttempt?: number | null
}

export interface MessageEntry {
  id: string
  playerAddress: string
  attemptNumber: number
  playerMessage: string
  aiResponse: string
  evaluation: 'Broken' | 'Defended' | 'Error'
  evaluationReason: string | null
  attackType: string | null
  feePaid: string
  txHash: string
  createdAt: string
  oracleSignature: string | null
  oracleDeadline: string | null
}

export interface ChallengeDetailResponse {
  challenge: Challenge
  messages: {
    items: Array<MessageEntry>
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
  onChainState: {
    prizePool: string
    messageCount: string
    currentFee: string
  } | null
}

export interface PaginatedChallenges {
  challenges: Array<Challenge>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ChallengeFilters {
  status?: string
  page?: string
  limit?: string
  sortBy?: string
  sortOrder?: string
  difficulty?: string
  pricingModel?: string
  defender?: string
}

export interface CreateChallengeRequest {
  title: string
  description: string
  systemPrompt: string
  aiModel?: string
  basePrice: string
  duration: number
  pricingModel: string // 'Fixed' | 'Escalating'
  maxFee?: string
  growthRateBps?: number
  txHash: string
  agentEndpoint?: string
  difficulty?: string // 'Easy' | 'Medium' | 'Hard' | 'Expert'
  challengeType?: string // Backend ChallengeType enum values
  tags?: Array<string>
  seedAmount?: string
  agentName?: string
  agentPersona?: string
  agentStyle?: string
  agentGreeting?: string
}

export interface SendMessageRequest {
  content: string
  txHash: string
}

export interface Message {
  id: string
  challengeId: string
  player: string
  content: string
  response?: string
  fee: string
  attemptNumber: number
  createdAt: string
}

// --- Leaderboard types ---

export interface LeaderboardEntry {
  rank: number
  walletAddress: string
  totalWins: number
  totalMessages: number
  totalEarningsUsdc: string
  totalSpentUsdc: string
}

export interface LeaderboardParams {
  metric?: string
  limit?: string
  offset?: string
}

export interface PaginatedLeaderboard {
  leaderboard: Array<LeaderboardEntry>
  metric: string
  limit: number
  offset: number
}

// --- Basename types ---

export interface BasenameResponse {
  address: string
  basename?: string
  avatar?: string
}

export interface BatchBasenameResponse {
  results: Record<string, string | null>
}

export interface BasenameProfile {
  name: string
  address: string
  avatar?: string
  description?: string
  url?: string
}

// --- Agent types ---

export interface AgentStatus {
  isConfigured: boolean
  walletAddress: string | null
  usdcBalance: string | null
  network: string
  agentKit: {
    isReady: boolean
    walletAddress: string | null
    usdcBalance?: string
  }
}

export interface AgentChatRequest {
  task: string
  context?: string
}

export interface AgentChatResponse {
  text: string
  toolCalls: Array<{ toolName: string; args: unknown; result: string }>
  steps: number
  walletAddress: string | null
}

export interface AgentChatConfig {
  feeUsdc: string
  recipientAddress: string | null
  usdcAddress: string
  network: string
}

export interface AgentProfile {
  name: string
  description: string
  avatar: string
  walletAddress: string | null
  capabilities: Array<string>
}

export interface AgentAction {
  id: string
  actionType: string
  challengeId: string | null
  description: string
  txHash: string | null
  status: string
  error: string | null
  amountUsdc: string | null
  createdAt: string
}

export interface AgentActionsParams {
  page?: string
  limit?: string
  actionType?: string
  status?: string
}

export interface PaginatedAgentActions {
  actions: Array<AgentAction>
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface AgentStats {
  totalActions: number
  successfulActions: number
  failedActions: number
  totalDistributed: string
  actionsByType: Record<string, number>
}

export interface AgentAnalysis {
  analysisType: string
  analysis: unknown
  generatedAt: string
}

// --- X402 / Insights types ---

export interface ChallengeInsights {
  challenge: {
    id: string
    challengeId: string
    cloneAddress: string
    title: string
    description: string
    aiModel: string
    difficulty: string
    status: string
    messageCount: string
    prizePool: string
    createdAt: string
  }
  insights: {
    evaluationStats: {
      total: number
      broken: number
      defended: number
      error: number
    }
    defenseRate: number
    attackTypeDistribution: Array<{ type: string; count: number }>
    recentEvaluations: Array<{
      evaluation: string
      reason: string | null
      attackType: string | null
      timestamp: string
    }>
  }
}

export interface X402CatalogEntry {
  path: string
  method: string
  description: string
  price: string
  name?: string
}

// --- Data marketplace types ---

export interface PlatformStats {
  totalChallenges: number
  totalMessages: number
  totalVolumeUsdc: string
  defenseRateByCategory: Array<{
    owaspCategory: number
    total: number
    defended: number
    defenseRate: number
  }>
  mostCommonAttackTypes: Array<{ attackType: string; count: number }>
}

export interface AttackData {
  owaspCategory: number
  totalAttempts: number
  successfulAttacks: number
  successRate: number
  attackTypeDistribution: Array<{ attackType: string; count: number }>
  severityDistribution: Array<{ severity: number; count: number }>
}

export interface ModelComparison {
  models: Array<{
    aiModel: string
    challengeCount: number
    totalMessages: number
    defendedMessages: number
    defenseRate: number
    securityScore: number
  }>
}

export interface TrendData {
  period: { from: string; to: string }
  challengeTrend: Array<{ date: string; count: number }>
  messageTrend: Array<{
    date: string
    totalMessages: number
    defendedMessages: number
    defenseRate: number
  }>
}

// --- Onchain types ---

export interface OnchainChallenge {
  txHash: string
  blockNumber: number
  challengeId: string
  eventType: string
  data: Record<string, unknown>
  timestamp: string
}

export interface OnchainVolume {
  address: string
  days: number
  totalVolumeUsdc: string
  transactionCount: number
  breakdown: Array<{ date: string; volume: string; count: number }>
}

export interface OnchainActivity {
  address: string
  days: number
  events: Array<{
    txHash: string
    eventType: string
    data: Record<string, unknown>
    timestamp: string
  }>
}

// --- Attestation types ---

export interface AttestationSchemas {
  attacker: string | null
  defender: string | null
  audit: string | null
  easAddress: string
  schemaRegistryAddress: string
  network: string
}

export interface Attestation {
  uid: string
  schema: string
  recipient: string
  attester: string
  time: string
  expirationTime: string
  revocationTime: string
  revocable: boolean
  refUID: string
  data: string
  decodedData: Record<string, unknown> | null
}

// --- Test suite types ---

export interface TestSuiteRunRequest {
  systemPrompt: string
  aiModel?: string
  categories?: Array<number>
  maxPrompts?: number
}

export interface TestSuiteResult {
  totalTests: number
  passed: number
  failed: number
  errors: number
  defenseRate: number
  securityScore: number
  scoreRating: string
  durationMs: number
  owaspCoverage: Record<
    string,
    { total: number; passed: number; failed: number; defenseRate: number }
  >
  severityDistribution: {
    critical: number
    high: number
    medium: number
    low: number
  }
  vulnerabilities: Array<{
    promptId: string
    category: string
    owaspCategory: number
    prompt: string
    aiResponse: string
    broken: boolean
    attackType: string | null
    severity: number | null
    confidence: number
    reason: string
  }>
  remediations: Array<{
    owaspCategory: number
    owaspCategoryName: string
    priority: string
    title: string
    description: string
    affectedTests: number
  }>
}

export interface TestSuiteReport extends Omit<TestSuiteResult, 'durationMs'> {
  challengeId: string
  challengeTitle: string
  aiModel: string
  status: string
}

// --- Misc types ---

export interface Model {
  id: string
  displayName: string
  provider: string
  contextWindow?: number
}

export interface VerificationResponse {
  address: string
  verified: boolean
  reputation?: number
}

// --- Query Keys ---

export const queryKeys = {
  me: () => ['auth', 'me'] as const,
  challenges: (filters?: ChallengeFilters) => ['challenges', filters] as const,
  challenge: (id: string) => ['challenges', id] as const,
  leaderboard: (params?: LeaderboardParams) => ['leaderboard', params] as const,
  basename: (address: string) => ['basenames', address] as const,
  basenameProfile: (name: string) => ['basenames', 'profile', name] as const,
  agentStatus: () => ['agent', 'status'] as const,
  agentActions: (params?: AgentActionsParams) =>
    ['agent', 'actions', params] as const,
  agentStats: () => ['agent', 'actions', 'stats'] as const,
  agentAnalysis: (type: string) => ['agent', 'analysis', type] as const,
  agentPolicies: () => ['agent', 'policies'] as const,
  models: () => ['models'] as const,
  verification: (address: string) => ['verification', address] as const,
  x402ChallengeInsights: (id: string) =>
    ['x402', 'challenge-insights', id] as const,
  x402Catalog: () => ['x402', 'catalog'] as const,
  dataStats: () => ['data', 'stats'] as const,
  dataAttacks: (owaspCategory: number) =>
    ['data', 'attacks', owaspCategory] as const,
  dataModels: () => ['data', 'models'] as const,
  dataTrends: () => ['data', 'trends'] as const,
  onchainChallenges: (limit?: number) =>
    ['onchain', 'challenges', limit] as const,
  onchainVolume: (address: string, days?: number) =>
    ['onchain', 'volume', address, days] as const,
  onchainActivity: (address: string, days?: number) =>
    ['onchain', 'activity', address, days] as const,
  attestationSchemas: () => ['attestations', 'schemas'] as const,
  attestation: (uid: string) => ['attestations', uid] as const,
  testSuiteReport: (challengeId: string) =>
    ['test-suite', 'report', challengeId] as const,
} as const

// --- Auth hooks ---
// Note: nonce + verify are called directly in src/hooks/useAuth.ts (useSiweLogin).
// Those hooks are not exposed here to avoid duplication.

export function useMe(options?: Partial<UseQueryOptions<User>>) {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => apiClient.get<ApiResponse<User>>('/auth/me').then(unwrap),
    staleTime: 60_000,
    retry: false,
    ...options,
  })
}

// --- Challenge hooks ---

export function useChallenges(
  filters?: ChallengeFilters,
  options?: Partial<UseQueryOptions<PaginatedChallenges>>,
) {
  return useQuery({
    queryKey: queryKeys.challenges(filters),
    queryFn: () =>
      apiClient
        .get<
          ApiResponse<PaginatedChallenges>
        >('/challenges', filters as Record<string, string> | undefined)
        .then(unwrap),
    staleTime: 15_000,
    ...options,
  })
}

export function useChallenge(
  id: string,
  paginationOptions?: { messagePage?: number; messageLimit?: number },
  options?: Partial<UseQueryOptions<ChallengeDetailResponse>>,
) {
  const params: Record<string, string> = {}
  if (paginationOptions?.messagePage)
    params.messagePage = String(paginationOptions.messagePage)
  if (paginationOptions?.messageLimit)
    params.messageLimit = String(paginationOptions.messageLimit)

  return useQuery({
    queryKey: ['challenges', id, params],
    queryFn: () =>
      apiClient
        .get<ApiResponse<ChallengeDetailResponse>>(`/challenges/${id}`, params)
        .then(unwrap),
    enabled: !!id,
    staleTime: 10_000,
    refetchInterval: 10_000,
    ...options,
  })
}

export function useCreateChallenge() {
  return useMutation({
    mutationFn: (data: CreateChallengeRequest) =>
      apiClient
        .post<ApiResponse<{ challenge: Challenge }>>(
          '/challenges',
          data,
          60_000,
        )
        .then(unwrap)
        .then((d) => d.challenge),
  })
}

export function useSendMessage(challengeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SendMessageRequest) =>
      apiClient
        .post<ApiResponse<Message>>(`/challenges/${challengeId}/messages`, data)
        .then(unwrap),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['challenges', challengeId],
      })
    },
  })
}

// --- Leaderboard hooks ---

export function useLeaderboard(
  params?: LeaderboardParams,
  options?: Partial<UseQueryOptions<PaginatedLeaderboard>>,
) {
  return useQuery({
    queryKey: queryKeys.leaderboard(params),
    queryFn: () =>
      apiClient
        .get<
          ApiResponse<PaginatedLeaderboard>
        >('/leaderboard', params as Record<string, string> | undefined)
        .then(unwrap),
    staleTime: 30_000,
    ...options,
  })
}

// --- Basename hooks ---

export function useBasename(
  address: string,
  options?: Partial<UseQueryOptions<BasenameResponse>>,
) {
  return useQuery({
    queryKey: queryKeys.basename(address),
    queryFn: () =>
      apiClient
        .get<ApiResponse<BasenameResponse>>(`/basenames/resolve/${address}`)
        .then(unwrap),
    enabled: !!address,
    staleTime: 300_000,
    ...options,
  })
}

export function useBatchBasenames() {
  return useMutation({
    mutationFn: (addresses: Array<string>) =>
      apiClient
        .post<
          ApiResponse<BatchBasenameResponse>
        >('/basenames/batch', { addresses })
        .then(unwrap),
  })
}

export function useBasenameProfile(
  name: string,
  options?: Partial<UseQueryOptions<BasenameProfile>>,
) {
  return useQuery({
    queryKey: queryKeys.basenameProfile(name),
    queryFn: () =>
      apiClient
        .get<
          ApiResponse<BasenameProfile>
        >(`/basenames/profile/${encodeURIComponent(name)}`)
        .then(unwrap),
    enabled: !!name,
    staleTime: 300_000,
    ...options,
  })
}

// --- Agent hooks ---

export function useAgentStatus(
  options?: Partial<UseQueryOptions<AgentStatus>>,
) {
  return useQuery({
    queryKey: queryKeys.agentStatus(),
    queryFn: () =>
      apiClient.get<ApiResponse<AgentStatus>>('/agent/status').then(unwrap),
    staleTime: 30_000,
    ...options,
  })
}

export function useAgentChat() {
  return useMutation({
    mutationFn: (data: AgentChatRequest) =>
      apiClient
        .post<ApiResponse<AgentChatResponse>>('/agent/chat', data, 120_000)
        .then(unwrap),
  })
}

export function useAgentChatConfig(
  options?: Partial<UseQueryOptions<AgentChatConfig>>,
) {
  return useQuery({
    queryKey: ['agent', 'chat', 'config'] as const,
    queryFn: () =>
      apiClient
        .get<ApiResponse<AgentChatConfig>>('/agent/chat/config')
        .then(unwrap),
    staleTime: 60_000,
    ...options,
  })
}

export function useAgentProfile(
  options?: Partial<UseQueryOptions<AgentProfile>>,
) {
  return useQuery({
    queryKey: ['agent', 'profile'] as const,
    queryFn: () =>
      apiClient.get<ApiResponse<AgentProfile>>('/agent/profile').then(unwrap),
    staleTime: 300_000,
    ...options,
  })
}

export function useAgentActions(
  params?: AgentActionsParams,
  options?: Partial<UseQueryOptions<PaginatedAgentActions>>,
) {
  return useQuery({
    queryKey: queryKeys.agentActions(params),
    queryFn: () =>
      apiClient
        .get<
          ApiResponse<PaginatedAgentActions>
        >('/agent/actions', params as Record<string, string> | undefined)
        .then(unwrap),
    staleTime: 15_000,
    ...options,
  })
}

export function useAgentStats(options?: Partial<UseQueryOptions<AgentStats>>) {
  return useQuery({
    queryKey: queryKeys.agentStats(),
    queryFn: () =>
      apiClient
        .get<ApiResponse<AgentStats>>('/agent/actions/stats')
        .then(unwrap),
    staleTime: 60_000,
    ...options,
  })
}

export function useAgentAnalysis(
  type: string,
  options?: Partial<UseQueryOptions<AgentAnalysis>>,
) {
  return useQuery({
    queryKey: queryKeys.agentAnalysis(type),
    queryFn: () =>
      apiClient
        .get<
          ApiResponse<AgentAnalysis>
        >(`/agent/analysis/${encodeURIComponent(type)}`)
        .then(unwrap),
    enabled: !!type,
    staleTime: 60_000,
    ...options,
  })
}

export function useAgentPoliciesInit() {
  return useMutation({
    mutationFn: () =>
      apiClient.post<ApiResponse<unknown>>('/agent/policies/init').then(unwrap),
  })
}

export function useAgentPolicies(options?: Partial<UseQueryOptions<unknown>>) {
  return useQuery({
    queryKey: queryKeys.agentPolicies(),
    queryFn: () =>
      apiClient.get<ApiResponse<unknown>>('/agent/policies').then(unwrap),
    staleTime: 60_000,
    ...options,
  })
}

// --- X402 hooks ---

export function useX402ChallengeInsights(id: string) {
  return useMutation({
    mutationFn: () =>
      apiClient
        .get<ApiResponse<ChallengeInsights>>(
          `/x402/challenge-insights/${id}`,
          undefined,
          120_000, // 2min: user needs time to review & sign payment in wallet
        )
        .then(unwrap),
  })
}

export function useX402Catalog(
  options?: Partial<UseQueryOptions<Array<X402CatalogEntry>>>,
) {
  const { address } = useAccount()
  return useQuery({
    queryKey: queryKeys.x402Catalog(),
    queryFn: () =>
      apiClient
        .get<ApiResponse<{ endpoints: Array<X402CatalogEntry> }>>(
          '/x402/catalog',
        )
        .then(unwrap)
        .then((d) => d.endpoints),
    enabled: !!address,
    staleTime: 300_000,
    retry: false,
    ...options,
  })
}

// --- Data marketplace hooks ---

export function useDataStats(
  options?: Partial<UseQueryOptions<PlatformStats>>,
) {
  const { address } = useAccount()
  return useQuery({
    queryKey: queryKeys.dataStats(),
    queryFn: () =>
      apiClient.get<ApiResponse<PlatformStats>>('/data/stats').then(unwrap),
    enabled: !!address,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    ...options,
  })
}

export function useDataAttacks(
  owaspCategory: number,
  options?: Partial<UseQueryOptions<AttackData>>,
) {
  const { address } = useAccount()
  return useQuery({
    queryKey: queryKeys.dataAttacks(owaspCategory),
    queryFn: () =>
      apiClient
        .get<ApiResponse<AttackData>>(`/data/attacks/${owaspCategory}`)
        .then(unwrap),
    enabled: owaspCategory > 0 && !!address,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    ...options,
  })
}

export function useDataModels(
  options?: Partial<UseQueryOptions<ModelComparison>>,
) {
  const { address } = useAccount()
  return useQuery({
    queryKey: queryKeys.dataModels(),
    queryFn: () =>
      apiClient.get<ApiResponse<ModelComparison>>('/data/models').then(unwrap),
    enabled: !!address,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    ...options,
  })
}

export function useDataTrends(options?: Partial<UseQueryOptions<TrendData>>) {
  const { address } = useAccount()
  return useQuery({
    queryKey: queryKeys.dataTrends(),
    queryFn: () =>
      apiClient.get<ApiResponse<TrendData>>('/data/trends').then(unwrap),
    enabled: !!address,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    ...options,
  })
}

// --- Onchain hooks ---

export function useOnchainChallenges(
  limit?: number,
  options?: Partial<UseQueryOptions<Array<OnchainChallenge>>>,
) {
  const { address } = useAccount()
  const params = limit !== undefined ? { limit: String(limit) } : undefined
  return useQuery({
    queryKey: queryKeys.onchainChallenges(limit),
    queryFn: () =>
      apiClient
        .get<
          ApiResponse<Array<OnchainChallenge>>
        >('/onchain/challenges', params)
        .then(unwrap),
    enabled: !!address,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    ...options,
  })
}

export function useOnchainVolume(
  address: string,
  days?: number,
  options?: Partial<UseQueryOptions<OnchainVolume>>,
) {
  const params = days !== undefined ? { days: String(days) } : undefined
  return useQuery({
    queryKey: queryKeys.onchainVolume(address, days),
    queryFn: () =>
      apiClient
        .get<ApiResponse<OnchainVolume>>(`/onchain/volume/${address}`, params)
        .then(unwrap),
    enabled: !!address,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    ...options,
  })
}

export function useOnchainActivity(
  address: string,
  days?: number,
  options?: Partial<UseQueryOptions<OnchainActivity>>,
) {
  const params = days !== undefined ? { days: String(days) } : undefined
  return useQuery({
    queryKey: queryKeys.onchainActivity(address, days),
    queryFn: () =>
      apiClient
        .get<
          ApiResponse<OnchainActivity>
        >(`/onchain/activity/${address}`, params)
        .then(unwrap),
    enabled: !!address,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
    ...options,
  })
}

// --- Attestation hooks ---

export function useAttestationSchemas(
  options?: Partial<UseQueryOptions<AttestationSchemas>>,
) {
  return useQuery({
    queryKey: queryKeys.attestationSchemas(),
    queryFn: () =>
      apiClient
        .get<ApiResponse<AttestationSchemas>>('/attestations/schemas')
        .then(unwrap),
    staleTime: 300_000,
    ...options,
  })
}

export function useAttestation(
  uid: string,
  options?: Partial<UseQueryOptions<Attestation>>,
) {
  return useQuery({
    queryKey: queryKeys.attestation(uid),
    queryFn: () =>
      apiClient
        .get<ApiResponse<Attestation>>(`/attestations/${uid}`)
        .then(unwrap),
    enabled: !!uid,
    staleTime: 300_000,
    ...options,
  })
}

// --- Test suite hooks ---

export function useTestSuiteRun() {
  return useMutation({
    mutationFn: (data: TestSuiteRunRequest) =>
      apiClient
        .post<ApiResponse<TestSuiteResult>>('/test-suite/run', data, 300_000)
        .then(unwrap),
  })
}

export function useTestSuiteReport(
  challengeId: string,
  options?: Partial<UseQueryOptions<TestSuiteReport>>,
) {
  return useQuery({
    queryKey: queryKeys.testSuiteReport(challengeId),
    queryFn: () =>
      apiClient
        .get<ApiResponse<TestSuiteReport>>(`/test-suite/report/${challengeId}`)
        .then(unwrap),
    enabled: !!challengeId,
    staleTime: 30_000,
    ...options,
  })
}

// --- Misc hooks ---

interface ModelsResponse {
  models: Array<Model>
  totalSupported: number
  totalAvailable: number
}

export function useModels(options?: Partial<UseQueryOptions<Array<Model>>>) {
  return useQuery({
    queryKey: queryKeys.models(),
    queryFn: () =>
      apiClient
        .get<ApiResponse<ModelsResponse>>('/models')
        .then(unwrap)
        .then((d) => d.models),
    staleTime: 300_000,
    ...options,
  })
}

export function useVerification(
  address: string,
  options?: Partial<UseQueryOptions<VerificationResponse>>,
) {
  return useQuery({
    queryKey: queryKeys.verification(address),
    queryFn: () =>
      apiClient
        .get<ApiResponse<VerificationResponse>>(`/verification/${address}`)
        .then(unwrap),
    enabled: !!address,
    staleTime: 60_000,
    ...options,
  })
}
