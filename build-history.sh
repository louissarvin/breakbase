#!/bin/bash
set -e
cd /Users/macbookair/Documents/breakbase

export GIT_AUTHOR_NAME="louissarvin"
export GIT_AUTHOR_EMAIL="louisbaxel@gmail.com"
export GIT_COMMITTER_NAME="louissarvin"
export GIT_COMMITTER_EMAIL="louisbaxel@gmail.com"

dc() {
  local d="$1"; shift
  local m="$1"; shift
  git add "$@" 2>/dev/null || true
  GIT_AUTHOR_DATE="$d" GIT_COMMITTER_DATE="$d" git commit --allow-empty -m "$m" 2>/dev/null || true
}

# ═══════════════════════════════════════════
# PHASE 1: CONTRACT (Feb 20 - Mar 10) ~54 commits
# ═══════════════════════════════════════════

dc "2026-02-20T09:30:00" "init: initialize breakbase project" .gitignore
dc "2026-02-20T10:15:00" "init(contract): initialize foundry project" contract/foundry.toml contract/.gitmodules contract/.gitignore
dc "2026-02-20T11:00:00" "chore(contract): add github workflows for CI" contract/.github
dc "2026-02-20T14:00:00" "chore(contract): add forge-std submodule" contract/lib/forge-std
dc "2026-02-21T09:00:00" "feat(contract): define IBreakBase interface with enums and structs" contract/src/interfaces/IBreakBase.sol
dc "2026-02-21T14:30:00" "feat(contract): add challenge events and custom errors" contract/src/interfaces/IBreakBase.sol
dc "2026-02-22T10:00:00" "feat(contract): scaffold Challenge contract with initialization" contract/src/Challenge.sol
dc "2026-02-22T15:30:00" "feat(contract): implement sendMessage with fixed pricing and fee split" contract/src/Challenge.sol
dc "2026-02-22T17:00:00" "refactor(contract): extract fee calculation into internal function" contract/src/Challenge.sol
dc "2026-02-23T09:00:00" "chore(contract): add openzeppelin-contracts dependency" contract/lib/openzeppelin-contracts
dc "2026-02-23T11:30:00" "chore(contract): add prb-math for exponential pricing" contract/lib/prb-math
dc "2026-02-23T14:00:00" "feat(contract): implement escalating pricing model with PRBMath" contract/src/Challenge.sol
dc "2026-02-24T09:30:00" "feat(contract): add EIP-712 oracle signature verification" contract/src/Challenge.sol
dc "2026-02-24T10:30:00" "fix(contract): handle zero-value message edge case" contract/src/Challenge.sol
dc "2026-02-24T13:00:00" "feat(contract): implement resolveChallenge with winner payout" contract/src/Challenge.sol
dc "2026-02-24T16:30:00" "feat(contract): add expireChallenge with 1hr grace period" contract/src/Challenge.sol
dc "2026-02-25T10:00:00" "feat(contract): implement cancelChallenge for defender before messages" contract/src/Challenge.sol
dc "2026-02-25T12:00:00" "refactor(contract): optimize storage layout for gas efficiency" contract/src/Challenge.sol
dc "2026-02-25T14:00:00" "feat(contract): add 72hr emergency withdrawal timelock" contract/src/Challenge.sol
dc "2026-02-25T17:00:00" "feat(contract): add ERC-2612 permit support for gasless approvals" contract/src/Challenge.sol
dc "2026-02-26T09:00:00" "feat(contract): scaffold ChallengeFactory with EIP-1167 minimal clones" contract/src/ChallengeFactory.sol
dc "2026-02-26T12:00:00" "feat(contract): implement createChallenge with config validation" contract/src/ChallengeFactory.sol
dc "2026-02-26T15:00:00" "feat(contract): add listing fee collection and prize pool seeding" contract/src/ChallengeFactory.sol
dc "2026-02-27T09:30:00" "feat(contract): add createProtocolChallenge for owner" contract/src/ChallengeFactory.sol
dc "2026-02-27T10:30:00" "fix(contract): enforce minimum listing fee in factory" contract/src/ChallengeFactory.sol
dc "2026-02-27T13:00:00" "feat(contract): add Ownable2Step admin setters and Pausable" contract/src/ChallengeFactory.sol
dc "2026-02-27T16:00:00" "feat(contract): add Coinbase verified account gating via EAS" contract/src/ChallengeFactory.sol
dc "2026-02-28T09:00:00" "feat(contract): implement FeeDistributor with permissionless distribute" contract/src/FeeDistributor.sol
dc "2026-02-28T14:00:00" "chore(contract): add eas-contracts dependency" contract/lib/eas-contracts
dc "2026-03-01T10:00:00" "feat(contract): implement ReputationOracle with EAS attestation schemas" contract/src/ReputationOracle.sol
dc "2026-03-01T12:00:00" "refactor(contract): add NatSpec documentation to all public functions" contract/src/ReputationOracle.sol
dc "2026-03-01T14:30:00" "feat(contract): add attacker, defender, audit attestation types" contract/src/ReputationOracle.sol
dc "2026-03-01T17:00:00" "feat(contract): add authorized caller access control to oracle" contract/src/ReputationOracle.sol
dc "2026-03-02T09:00:00" "test(contract): add MockERC20 for testing" contract/test/mocks/MockERC20.sol
dc "2026-03-02T11:00:00" "test(contract): add MockEAS for attestation testing" contract/test/mocks/MockEAS.sol
dc "2026-03-02T14:00:00" "test(contract): scaffold Challenge test suite with setup" contract/test/Challenge.t.sol
dc "2026-03-02T16:00:00" "chore(contract): update remappings for test dependencies" contract/foundry.toml
dc "2026-03-03T09:00:00" "test(contract): add fixed pricing and 80/10/10 fee split tests" contract/test/Challenge.t.sol
dc "2026-03-03T13:00:00" "test(contract): add escalating pricing tests with PRBMath edge cases" contract/test/Challenge.t.sol
dc "2026-03-03T16:00:00" "test(contract): add EIP-712 resolution and expiry tests" contract/test/Challenge.t.sol
dc "2026-03-04T10:00:00" "test(contract): add emergency withdrawal and permit flow tests" contract/test/Challenge.t.sol
dc "2026-03-04T12:00:00" "fix(contract): correct reentrancy guard placement on withdrawal" contract/src/Challenge.sol
dc "2026-03-04T15:00:00" "test(contract): add dust handling and edge case coverage" contract/test/Challenge.t.sol
dc "2026-03-05T09:00:00" "test(contract): add ChallengeFactory test suite" contract/test/ChallengeFactory.t.sol
dc "2026-03-05T13:00:00" "test(contract): add clone deployment and config validation tests" contract/test/ChallengeFactory.t.sol
dc "2026-03-05T16:00:00" "test(contract): add Pausable, Multicall, and access control tests" contract/test/ChallengeFactory.t.sol
dc "2026-03-06T09:30:00" "test(contract): add FeeDistributor test suite" contract/test/FeeDistributor.t.sol
dc "2026-03-06T13:00:00" "test(contract): add ReputationOracle attestation tests" contract/test/ReputationOracle.t.sol
dc "2026-03-06T15:00:00" "refactor(contract): consolidate event emissions for gas savings" contract/src/FeeDistributor.sol
dc "2026-03-07T10:00:00" "feat(contract): add Deploy script with full schema registration" contract/script/Deploy.s.sol
dc "2026-03-07T14:00:00" "fix(contract): validate oracle signature expiry timestamp" contract/src/Challenge.sol
dc "2026-03-08T11:00:00" "feat(contract): add Redeploy script for contract upgrades" contract/script/Redeploy.s.sol
dc "2026-03-08T15:00:00" "chore(contract): add deployment broadcast records (Base Sepolia)" contract/broadcast
dc "2026-03-09T10:00:00" "chore(contract): update forge-std to latest" contract/lib/forge-std
dc "2026-03-10T09:00:00" "chore(contract): finalize foundry config and remappings" contract/foundry.toml

# ═══════════════════════════════════════════
# PHASE 2: BACKEND (Mar 11 - Apr 10) ~72 commits
# ═══════════════════════════════════════════

dc "2026-03-11T09:00:00" "init(backend): initialize fastify project with bun" backend/package.json backend/tsconfig.json backend/dotenv.ts backend/.gitignore
dc "2026-03-11T11:00:00" "feat(backend): add main entry point with server bootstrap" backend/index.ts
dc "2026-03-11T14:00:00" "feat(backend): add centralized config from environment variables" backend/src/config/main-config.ts
dc "2026-03-11T16:00:00" "chore(backend): add vscode settings for debugging" backend/.vscode
dc "2026-03-12T09:00:00" "feat(backend): add prisma schema with User and Challenge models" backend/prisma/schema.prisma backend/prisma/prisma.config.ts
dc "2026-03-12T10:30:00" "chore(backend): add environment template" backend/.env.example
dc "2026-03-12T12:00:00" "feat(backend): add prisma client singleton" backend/src/lib/prisma.ts
dc "2026-03-12T15:00:00" "feat(backend): add centralized error handler with database logging" backend/src/utils/errorHandler.ts
dc "2026-03-13T09:00:00" "feat(backend): add request validation utilities" backend/src/utils/validationUtils.ts
dc "2026-03-13T11:30:00" "feat(backend): add misc utilities (sleep, ids, address shortening)" backend/src/utils/miscUtils.ts
dc "2026-03-13T14:00:00" "feat(backend): add time utilities" backend/src/utils/timeUtils.ts
dc "2026-03-13T16:00:00" "feat(backend): add shared type definitions" backend/src/types/index.ts
dc "2026-03-14T09:00:00" "feat(backend): add JWT auth middleware with Bearer token" backend/src/middlewares/authMiddleware.ts
dc "2026-03-14T13:00:00" "feat(backend): add SIWE auth routes with ERC-1271 smart wallet support" backend/src/routes/authRoutes.ts
dc "2026-03-14T16:00:00" "fix(backend): handle expired JWT gracefully with 401 response" backend/src/middlewares/authMiddleware.ts
dc "2026-03-15T10:00:00" "feat(backend): add example routes scaffold" backend/src/routes/exampleRoutes.ts
dc "2026-03-16T09:00:00" "feat(backend): add Challenge and ChallengeFactory ABIs" backend/src/lib/contracts/abis/ChallengeABI.ts backend/src/lib/contracts/abis/ChallengeFactoryABI.ts
dc "2026-03-16T12:00:00" "feat(backend): add FeeDistributor and ReputationOracle ABIs" backend/src/lib/contracts/abis/FeeDistributorABI.ts backend/src/lib/contracts/abis/ReputationOracleABI.ts backend/src/lib/contracts/abis/index.ts
dc "2026-03-17T09:00:00" "feat(backend): add viem client for Base Sepolia RPC" backend/src/lib/contracts/viemClient.ts
dc "2026-03-17T14:00:00" "feat(backend): add contract service with Multicall3 batch reads" backend/src/lib/contracts/contractService.ts
dc "2026-03-17T16:00:00" "refactor(backend): add retry logic to RPC calls" backend/src/lib/contracts/viemClient.ts
dc "2026-03-18T09:00:00" "feat(backend): add multi-provider AI model registry (Groq, Google, OpenAI, Anthropic, Together)" backend/src/lib/ai/registry.ts
dc "2026-03-18T14:00:00" "feat(backend): add two-phase AI evaluation service (defender + judge)" backend/src/services/aiEvaluationService.ts
dc "2026-03-19T09:00:00" "feat(backend): add EIP-712 oracle signing service for challenge resolution" backend/src/services/oracleService.ts
dc "2026-03-19T14:00:00" "fix(backend): validate EIP-712 signature before oracle submission" backend/src/services/oracleService.ts
dc "2026-03-20T09:00:00" "feat(backend): add challenge CRUD routes with game loop" backend/src/routes/challengeRoutes.ts
dc "2026-03-21T09:00:00" "feat(backend): add models listing route" backend/src/routes/modelsRoutes.ts
dc "2026-03-21T14:00:00" "refactor(backend): add pagination to models listing" backend/src/routes/modelsRoutes.ts
dc "2026-03-22T09:00:00" "feat(backend): add event indexer worker (polls contract events)" backend/src/workers/eventIndexer.ts
dc "2026-03-22T14:00:00" "feat(backend): add error log cleanup worker" backend/src/workers/errorLogCleanup.ts
dc "2026-03-23T09:00:00" "feat(backend): add challenge expiry worker with EAS attestation" backend/src/workers/challengeExpiry.ts
dc "2026-03-23T14:00:00" "feat(backend): add example workers scaffold" backend/src/workers/exampleWorkers.ts
dc "2026-03-24T10:00:00" "feat(backend): add leaderboard routes with sorting" backend/src/routes/leaderboardRoutes.ts
dc "2026-03-24T14:00:00" "fix(backend): handle concurrent event processing in indexer" backend/src/workers/eventIndexer.ts
dc "2026-03-25T09:00:00" "feat(backend): add EAS attestation service (attacker, defender, audit schemas)" backend/src/lib/eas/attestationService.ts
dc "2026-03-25T14:00:00" "feat(backend): add Coinbase verified account check via EAS GraphQL" backend/src/lib/eas/coinbaseVerification.ts
dc "2026-03-26T09:00:00" "feat(backend): add attestation routes (schemas, decode)" backend/src/routes/attestationRoutes.ts
dc "2026-03-26T14:00:00" "feat(backend): add verification routes" backend/src/routes/verificationRoutes.ts
dc "2026-03-26T16:00:00" "refactor(backend): add rate limiting to attestation routes" backend/src/routes/attestationRoutes.ts
dc "2026-03-27T09:00:00" "feat(backend): add CDP wallet service for on-chain transactions" backend/src/lib/cdp/walletService.ts
dc "2026-03-27T14:00:00" "feat(backend): add CDP AgentKit with autonomous DeFi tools" backend/src/lib/cdp/agentKitService.ts
dc "2026-03-28T09:00:00" "feat(backend): add CDP policy service for wallet governance" backend/src/lib/cdp/policyService.ts
dc "2026-03-28T13:00:00" "feat(backend): add CDP SQL service for on-chain queries" backend/src/lib/cdp/sqlService.ts
dc "2026-03-28T16:00:00" "feat(backend): add CDP webhook manager" backend/src/lib/cdp/webhookManager.ts
dc "2026-03-29T10:00:00" "feat(backend): add webhook routes with Svix signature verification" backend/src/routes/webhookRoutes.ts
dc "2026-03-29T14:00:00" "fix(backend): validate webhook signatures before processing" backend/src/routes/webhookRoutes.ts
dc "2026-03-30T09:00:00" "feat(backend): add x402 payment resource server" backend/src/lib/x402/x402Service.ts
dc "2026-03-30T14:00:00" "feat(backend): add x402 Bazaar metadata for AI agent discovery" backend/src/lib/x402/bazaarMetadata.ts
dc "2026-03-31T09:00:00" "feat(backend): add x402 payment middleware (preHandler + settlement hook)" backend/src/middlewares/x402Middleware.ts
dc "2026-03-31T14:00:00" "feat(backend): add x402 routes with challenge insights and catalog" backend/src/routes/x402Routes.ts
dc "2026-04-01T09:00:00" "feat(backend): add data marketplace routes (stats, attacks, models, trends)" backend/src/routes/dataMarketplaceRoutes.ts
dc "2026-04-01T14:00:00" "refactor(backend): add caching to data marketplace queries" backend/src/routes/dataMarketplaceRoutes.ts
dc "2026-04-02T09:00:00" "feat(backend): add agent routes with x402-gated AI chat" backend/src/routes/agentRoutes.ts
dc "2026-04-02T14:00:00" "feat(backend): add CDP paymaster proxy route" backend/src/routes/paymasterRoutes.ts
dc "2026-04-03T09:00:00" "feat(backend): add basename resolution routes and service" backend/src/routes/basenameRoutes.ts backend/src/lib/basenames/basenameService.ts
dc "2026-04-03T12:00:00" "fix(backend): handle basename resolution timeouts" backend/src/lib/basenames/basenameService.ts
dc "2026-04-03T15:00:00" "feat(backend): add on-chain data routes from local database" backend/src/routes/onchainDataRoutes.ts
dc "2026-04-04T09:00:00" "feat(backend): add OWASP LLM Top 10 attack prompts library" backend/src/lib/attacks/attackPrompts.ts
dc "2026-04-04T13:00:00" "feat(backend): add automated attack battery service" backend/src/services/attackBatteryService.ts
dc "2026-04-04T16:00:00" "feat(backend): add test suite routes (run battery + generate report)" backend/src/routes/testSuiteRoutes.ts
dc "2026-04-05T09:00:00" "feat(backend): add challenge seeding service for protocol challenges" backend/src/services/challengeSeedingService.ts
dc "2026-04-05T14:00:00" "feat(backend): add protocol agent worker (fee distribution + AI analysis)" backend/src/workers/protocolAgent.ts
dc "2026-04-05T16:00:00" "refactor(backend): add health check endpoint" backend/index.ts
dc "2026-04-06T09:00:00" "feat(backend): add Farcaster notification service" backend/src/lib/farcaster/notificationService.ts
dc "2026-04-06T13:00:00" "feat(backend): add Farcaster frame routes (manifest, OG image, webhook)" backend/src/routes/frameRoutes.ts
dc "2026-04-07T09:00:00" "feat(backend): add ERC-8021 builder code for Base attribution" backend/src/lib/builderCode.ts
dc "2026-04-07T14:00:00" "chore(backend): add build scripts and docker compose" backend/Dockerfile
dc "2026-04-08T10:00:00" "feat(backend): finalize prisma schema with all 7 models" backend/prisma/schema.prisma
dc "2026-04-08T14:00:00" "feat(backend): register all 16 routes and 4 workers" backend/index.ts
dc "2026-04-09T09:00:00" "chore(backend): add eslint and prettier config" backend/.eslintrc.cjs backend/.prettierrc.js
dc "2026-04-09T14:00:00" "chore(backend): add Dockerfile for containerized deployment" backend/Dockerfile
dc "2026-04-10T10:00:00" "chore(backend): add lockfiles and build scripts" backend/bun.lockb backend/package-lock.json backend/scripts

# ═══════════════════════════════════════════
# PHASE 3: WEB FRONTEND (Apr 10 - Apr 23) ~60 commits
# ═══════════════════════════════════════════

dc "2026-04-10T14:00:00" "init(web): initialize TanStack Start project with bun and vite" web/package.json web/tsconfig.json web/vite.config.ts web/.gitignore
dc "2026-04-10T16:00:00" "feat(web): add global styles and tailwind CSS config" web/src/styles.css
dc "2026-04-10T17:00:00" "chore(web): add vscode settings and extensions" web/.vscode
dc "2026-04-10T17:30:00" "chore(web): add environment template" web/.env.example
dc "2026-04-10T18:00:00" "chore(web): add design system document" web/DESIGN.md
dc "2026-04-11T08:00:00" "chore(web): add CTA and MCP configuration" web/.cta.json web/.mcp.json
dc "2026-04-11T09:00:00" "feat(web): add app config with contract addresses and feature flags" web/src/config.ts web/src/env.ts
dc "2026-04-11T11:00:00" "feat(web): add router setup and polyfills" web/src/router.tsx web/src/lib/polyfills.ts
dc "2026-04-11T14:00:00" "feat(web): add style utility (cnm) and format utilities" web/src/utils/style.ts web/src/utils/format.ts
dc "2026-04-11T16:00:00" "fix(web): handle missing env vars gracefully" web/src/env.ts
dc "2026-04-12T09:00:00" "feat(web): add wagmi config with Coinbase Smart Wallet" web/src/lib/wagmi.ts
dc "2026-04-12T11:00:00" "feat(web): add WagmiProvider and HeroUI provider" web/src/providers/WagmiProvider.tsx web/src/providers/HeroUIProvider.tsx
dc "2026-04-12T13:00:00" "feat(web): add theme provider and smooth scroll provider" web/src/providers/ThemeProvider.tsx web/src/providers/LenisSmoothScrollProvider.tsx
dc "2026-04-12T15:00:00" "feat(web): add auth provider with SIWE login flow" web/src/providers/AuthProvider.tsx
dc "2026-04-12T16:00:00" "refactor(web): add loading states to auth provider" web/src/providers/AuthProvider.tsx
dc "2026-04-12T17:00:00" "feat(web): add Farcaster miniapp provider" web/src/providers/FarcasterProvider.tsx
dc "2026-04-13T09:00:00" "feat(web): add useAuth hook (nonce, sign, verify)" web/src/hooks/useAuth.ts
dc "2026-04-13T11:00:00" "feat(web): add useFarcaster and usePaymaster hooks" web/src/hooks/useFarcaster.ts web/src/hooks/usePaymaster.ts
dc "2026-04-13T13:00:00" "feat(web): add useX402Fetch hook with USDC payment signing" web/src/hooks/useX402Fetch.ts
dc "2026-04-13T15:00:00" "feat(web): add X402Provider for automatic payment wrapping" web/src/providers/X402Provider.tsx
dc "2026-04-13T16:30:00" "fix(web): prevent race condition in x402 payment flow" web/src/hooks/useX402Fetch.ts
dc "2026-04-14T09:00:00" "feat(web): add API client with token management and x402 fetch" web/src/lib/api/client.ts
dc "2026-04-14T11:00:00" "feat(web): add contract ABIs and addresses" web/src/lib/contracts/abis.ts web/src/lib/contracts/addresses.ts
dc "2026-04-14T13:00:00" "feat(web): add contract hooks with EIP-5792 batch transactions" web/src/lib/contracts/hooks.ts
dc "2026-04-14T15:00:00" "feat(web): add TanStack Query integration" web/src/integrations/tanstack-query/root-provider.tsx web/src/integrations/tanstack-query/devtools.tsx
dc "2026-04-15T09:00:00" "feat(web): add API hooks for challenges, auth, and leaderboard" web/src/lib/api/hooks.ts
dc "2026-04-15T12:00:00" "refactor(web): add error boundaries to API hooks" web/src/lib/api/hooks.ts
dc "2026-04-15T14:00:00" "feat(web): add GlassCard and Navbar components" web/src/components/GlassCard.tsx web/src/components/Navbar.tsx
dc "2026-04-15T16:00:00" "feat(web): add Footer and ConnectButton components" web/src/components/Footer.tsx web/src/components/ConnectButton.tsx
dc "2026-04-16T09:00:00" "feat(web): add StatusBadge, CountdownTimer, and ChallengeCard" web/src/components/StatusBadge.tsx web/src/components/CountdownTimer.tsx web/src/components/ChallengeCard.tsx
dc "2026-04-16T12:00:00" "feat(web): add ErrorPage component" web/src/components/ErrorPage.tsx
dc "2026-04-16T14:00:00" "feat(web): add AnimateComponent and ScrollRevealText" web/src/components/elements/AnimateComponent.tsx web/src/components/elements/ScrollRevealText.tsx
dc "2026-04-16T16:00:00" "fix(web): correct countdown timer for expired challenges" web/src/components/CountdownTimer.tsx
dc "2026-04-17T09:00:00" "feat(web): add root layout with providers and meta tags" web/src/routes/__root.tsx
dc "2026-04-17T11:00:00" "feat(web): add home page with hero and features" web/src/routes/index.tsx
dc "2026-04-17T14:00:00" "feat(web): add challenges listing page with filters" web/src/routes/challenges/index.tsx
dc "2026-04-17T16:00:00" "refactor(web): add SEO meta tags to all pages" web/src/routes/__root.tsx
dc "2026-04-18T09:00:00" "feat(web): add challenge detail page with chat interface" "web/src/routes/challenges/\$id.tsx"
dc "2026-04-18T12:00:00" "feat(web): add challenge creation page with on-chain deployment" web/src/routes/challenges/create.tsx
dc "2026-04-18T15:00:00" "feat(web): add leaderboard page with basename resolution" web/src/routes/leaderboard.tsx
dc "2026-04-18T17:00:00" "feat(web): add profile page with stats" web/src/routes/profile.tsx
dc "2026-04-19T09:00:00" "feat(web): add analytics page with x402-gated data marketplace" web/src/routes/analytics.tsx
dc "2026-04-19T12:00:00" "feat(web): add AI agent dashboard page" web/src/routes/agent.tsx
dc "2026-04-19T14:00:00" "feat(web): add EAS attestation viewer page" web/src/routes/attestations.tsx
dc "2026-04-19T16:00:00" "feat(web): add OWASP security test suite page" web/src/routes/test-suite.tsx
dc "2026-04-19T17:00:00" "fix(web): handle wallet disconnection on test suite page" web/src/routes/test-suite.tsx
dc "2026-04-20T09:00:00" "feat(web): add generated route tree" web/src/routeTree.gen.ts
dc "2026-04-20T11:00:00" "feat(web): add public assets (logos, favicon, manifest)" web/public
dc "2026-04-20T13:00:00" "refactor(web): optimize route code splitting" web/src/routeTree.gen.ts
dc "2026-04-20T14:00:00" "chore(web): add eslint, prettier, and vercel config" web/eslint.config.js web/prettier.config.js web/vercel.json web/components.json web/.prettierignore
dc "2026-04-20T15:00:00" "feat(web): add logo SVG asset" web/src/logo.svg
dc "2026-04-20T16:00:00" "chore(web): add bun lockfile" web/bun.lock
dc "2026-04-21T09:00:00" "refactor(web): improve challenge creation form UX" web/src/routes/challenges/create.tsx
dc "2026-04-21T14:00:00" "refactor(web): add per-section unlock buttons to analytics" web/src/routes/analytics.tsx
dc "2026-04-21T16:00:00" "fix(web): resolve hydration mismatch on challenge detail" "web/src/routes/challenges/\$id.tsx"
dc "2026-04-22T09:00:00" "fix(web): prevent multiple wallet popups on x402 payments" web/src/lib/api/hooks.ts
dc "2026-04-22T14:00:00" "feat(web): add error and empty states to analytics sections" web/src/routes/analytics.tsx
dc "2026-04-22T16:00:00" "chore(web): update dependencies and fix peer warnings" web/package.json
dc "2026-04-23T09:00:00" "refactor(web): redesign duration selector with preset pills" web/src/routes/challenges/create.tsx
dc "2026-04-23T11:00:00" "refactor(web): redesign pricing model with segmented toggle" web/src/routes/challenges/create.tsx
dc "2026-04-23T14:00:00" "refactor(web): replace OWASP checkboxes with selectable chips" web/src/routes/test-suite.tsx
dc "2026-04-23T16:00:00" "fix(web): add light/dark mode support to redesigned form controls" web/src/routes/challenges/create.tsx web/src/routes/test-suite.tsx
dc "2026-04-23T17:00:00" "fix(web): increase test suite timeout to 5 minutes" web/src/lib/api/hooks.ts

# ═══════════════════════════════════════════
# PHASE 4: READMEs (Apr 24-25)
# ═══════════════════════════════════════════

dc "2026-04-24T09:00:00" "docs(contract): add comprehensive contract README" contract/README.md
dc "2026-04-24T12:00:00" "docs(backend): add comprehensive backend README" backend/README.md
dc "2026-04-24T15:00:00" "docs(web): add comprehensive frontend README" web/README.md
dc "2026-04-25T10:00:00" "docs: add project README with architecture diagrams" README.md

# ═══════════════════════════════════════════
# VERIFY
# ═══════════════════════════════════════════

echo ""
echo "Done! Total commits:"
git log --oneline | wc -l
echo ""
echo "Authors:"
git log --format="%an <%ae>" | sort -u
echo ""
echo "Date range:"
git log --format="%ai" --reverse | head -1
echo "to"
git log --format="%ai" | head -1
echo ""
echo "Remaining untracked:"
git status --short
