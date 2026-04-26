import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Button,
  Chip,
  Input,
  Progress,
  Select,
  SelectItem,
  Spinner,
  Textarea,
} from '@heroui/react'
import { AlertCircle, Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { TestSuiteReport, TestSuiteResult } from '@/lib/api/hooks'
import GlassCard from '@/components/GlassCard'
import { useModels, useTestSuiteReport, useTestSuiteRun } from '@/lib/api/hooks'
import { cnm } from '@/utils/style'

export const Route = createFileRoute('/test-suite')({
  component: TestSuitePage,
})

const OWASP_CATEGORIES: Record<number, string> = {
  1: 'LLM01: Prompt Injection',
  2: 'LLM02: Insecure Output Handling',
  3: 'LLM03: Training Data Poisoning',
  4: 'LLM04: Model Denial of Service',
  5: 'LLM05: Supply Chain Vulnerabilities',
  6: 'LLM06: Sensitive Information Disclosure',
  7: 'LLM07: Insecure Plugin Design',
  8: 'LLM08: Excessive Agency',
  9: 'LLM09: Overreliance',
  10: 'LLM10: Model Theft',
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-[#098551]'
  if (score >= 60) return 'text-[#ED702F]'
  return 'text-[#CF202F]'
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-[#098551]/10 border-[#098551]/20'
  if (score >= 60) return 'bg-[#ED702F]/10 border-[#ED702F]/20'
  return 'bg-[#CF202F]/10 border-[#CF202F]/20'
}

function defenseRateColor(rate: number): string {
  if (rate >= 80) return '#098551'
  if (rate >= 60) return '#ED702F'
  return '#CF202F'
}

function priorityChipColor(priority: string): 'danger' | 'warning' | 'primary' {
  if (priority === 'High') return 'danger'
  if (priority === 'Medium') return 'warning'
  return 'primary'
}

function severityLabel(severity: number | null): string {
  if (severity === null) return 'Unknown'
  if (severity >= 9) return 'Critical'
  if (severity >= 7) return 'High'
  if (severity >= 4) return 'Medium'
  return 'Low'
}

function severityColor(
  severity: number | null,
): 'danger' | 'warning' | 'primary' | 'default' {
  if (severity === null) return 'default'
  if (severity >= 9) return 'danger'
  if (severity >= 7) return 'warning'
  if (severity >= 4) return 'primary'
  return 'default'
}

function inputClasses() {
  return {
    input:
      'bg-[#F3F4F6] dark:bg-[#141518] text-[#0A0B0D] dark:text-[#F9FAFB] placeholder:text-[#D1D5DB] dark:placeholder:text-[#6B7280] text-[15px]',
    inputWrapper:
      'bg-[#F3F4F6] dark:bg-[#141518] border border-[#E5E7EB] dark:border-[#2D2F36] rounded-xl focus-within:border-[#0052FF] focus-within:ring-[3px] focus-within:ring-[rgba(0,82,255,0.15)] hover:border-[#9CA3AF] transition-all h-auto',
    label: 'hidden',
  }
}

function selectClasses() {
  return {
    trigger:
      'bg-[#F3F4F6] dark:bg-[#141518] border border-[#E5E7EB] dark:border-[#2D2F36] rounded-xl hover:border-[#9CA3AF] data-[focus=true]:border-[#0052FF]',
    value: 'text-[#0A0B0D] dark:text-[#F9FAFB] text-[15px]',
    listbox: 'text-[#0A0B0D] dark:text-[#F9FAFB]',
    popoverContent:
      'bg-white dark:bg-[#141518] border border-black/[0.08] dark:border-[#2D2F36]',
  }
}

function FormLabel({
  children,
  hint,
}: {
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[14px] font-semibold">
        {children}
      </span>
      {hint && (
        <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px]">
          {hint}
        </span>
      )}
    </div>
  )
}

interface VulnerabilityRowProps {
  vuln: TestSuiteResult['vulnerabilities'][number]
}

function VulnerabilityRow({ vuln }: VulnerabilityRowProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-black/[0.08] dark:border-white/[0.08] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-[#F9FAFB] dark:hover:bg-[#141518] transition-colors"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Chip
            size="sm"
            color={severityColor(vuln.severity)}
            variant="flat"
            className="shrink-0"
          >
            {severityLabel(vuln.severity)}
          </Chip>
          <Chip
            size="sm"
            variant="flat"
            className="shrink-0 text-[#4B5563] dark:text-[#D1D5DB]"
          >
            {vuln.category}
          </Chip>
          {vuln.attackType && (
            <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] truncate">
              {vuln.attackType}
            </span>
          )}
        </div>
        <div className="shrink-0 text-[#9CA3AF] dark:text-[#6B7280] mt-0.5">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-black/[0.06] dark:border-white/[0.06]">
          <div className="pt-3">
            <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[11px] uppercase tracking-wider mb-1.5 font-semibold">
              Prompt
            </p>
            <p className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[13px] bg-[#F3F4F6] dark:bg-[#141518] rounded-lg p-3 font-mono leading-relaxed">
              {vuln.prompt}
            </p>
          </div>
          <div>
            <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[11px] uppercase tracking-wider mb-1.5 font-semibold">
              AI Response
            </p>
            <p className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[13px] bg-[#F3F4F6] dark:bg-[#141518] rounded-lg p-3 font-mono leading-relaxed">
              {vuln.aiResponse}
            </p>
          </div>
          <div className="flex items-center gap-4 text-[13px]">
            <span className="text-[#4B5563] dark:text-[#D1D5DB]">
              Confidence:{' '}
              <span className="text-[#0A0B0D] dark:text-[#F9FAFB] font-medium">
                {Math.round(vuln.confidence * 100)}%
              </span>
            </span>
          </div>
          {vuln.reason && (
            <div>
              <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[11px] uppercase tracking-wider mb-1.5 font-semibold">
                Reason
              </p>
              <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px]">
                {vuln.reason}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface ResultsViewProps {
  result: TestSuiteResult | TestSuiteReport
}

function ResultsView({ result }: ResultsViewProps) {
  const durationSec =
    'durationMs' in result ? (result.durationMs / 1000).toFixed(1) : null

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <GlassCard
          variant="accent"
          className={cnm('p-4 border', scoreBg(result.securityScore))}
        >
          <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[12px] font-medium mb-1">
            Security Score
          </p>
          <p
            className={cnm(
              'text-[32px] font-bold leading-none',
              scoreColor(result.securityScore),
            )}
          >
            {result.securityScore}
          </p>
          <p
            className={cnm(
              'text-[12px] mt-1 font-medium',
              scoreColor(result.securityScore),
            )}
          >
            {result.scoreRating}
          </p>
        </GlassCard>

        <GlassCard variant="standard" className="p-4">
          <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[12px] font-medium mb-1">
            Defense Rate
          </p>
          <p className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[32px] font-bold leading-none">
            {result.defenseRate.toFixed(1)}
            <span className="text-[18px] font-medium text-[#9CA3AF] dark:text-[#6B7280]">
              %
            </span>
          </p>
        </GlassCard>

        <GlassCard variant="standard" className="p-4">
          <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[12px] font-medium mb-2">
            Tests
          </p>
          <div className="flex flex-col gap-1 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[#4B5563] dark:text-[#D1D5DB]">Total</span>
              <span className="text-[#0A0B0D] dark:text-[#F9FAFB] font-semibold">
                {result.totalTests}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#098551]">Passed</span>
              <span className="text-[#098551] font-semibold">
                {result.passed}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#CF202F]">Failed</span>
              <span className="text-[#CF202F] font-semibold">
                {result.failed}
              </span>
            </div>
            {result.errors > 0 && (
              <div className="flex justify-between">
                <span className="text-[#9CA3AF] dark:text-[#6B7280]">
                  Errors
                </span>
                <span className="text-[#9CA3AF] dark:text-[#6B7280] font-semibold">
                  {result.errors}
                </span>
              </div>
            )}
          </div>
        </GlassCard>

        {durationSec && (
          <GlassCard variant="standard" className="p-4">
            <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[12px] font-medium mb-1">
              Duration
            </p>
            <p className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[28px] font-bold leading-none">
              {durationSec}
              <span className="text-[16px] font-medium text-[#9CA3AF] dark:text-[#6B7280]">
                s
              </span>
            </p>
          </GlassCard>
        )}
      </div>

      {/* Severity distribution */}
      <GlassCard>
        <h3 className="text-[15px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] mb-4">
          Severity Distribution
        </h3>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-[#CF202F]/10 border border-[#CF202F]/20 rounded-lg px-3 py-2">
            <span className="text-[#CF202F] text-[12px] font-semibold uppercase tracking-wide">
              Critical
            </span>
            <span className="text-[#CF202F] text-[20px] font-bold leading-none">
              {result.severityDistribution.critical}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-[#ED702F]/10 border border-[#ED702F]/20 rounded-lg px-3 py-2">
            <span className="text-[#ED702F] text-[12px] font-semibold uppercase tracking-wide">
              High
            </span>
            <span className="text-[#ED702F] text-[20px] font-bold leading-none">
              {result.severityDistribution.high}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg px-3 py-2">
            <span className="text-[#F59E0B] text-[12px] font-semibold uppercase tracking-wide">
              Medium
            </span>
            <span className="text-[#F59E0B] text-[20px] font-bold leading-none">
              {result.severityDistribution.medium}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-[#0052FF]/10 border border-[#0052FF]/20 rounded-lg px-3 py-2">
            <span className="text-[#0052FF] text-[12px] font-semibold uppercase tracking-wide">
              Low
            </span>
            <span className="text-[#0052FF] text-[20px] font-bold leading-none">
              {result.severityDistribution.low}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* OWASP coverage */}
      {Object.keys(result.owaspCoverage).length > 0 && (
        <GlassCard>
          <h3 className="text-[15px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] mb-4">
            OWASP Coverage Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.06]">
                  <th className="text-left text-[#9CA3AF] dark:text-[#6B7280] font-medium pb-3 pr-4">
                    Category
                  </th>
                  <th className="text-right text-[#9CA3AF] dark:text-[#6B7280] font-medium pb-3 px-3 w-16">
                    Total
                  </th>
                  <th className="text-right text-[#9CA3AF] dark:text-[#6B7280] font-medium pb-3 px-3 w-16">
                    Passed
                  </th>
                  <th className="text-right text-[#9CA3AF] dark:text-[#6B7280] font-medium pb-3 px-3 w-16">
                    Failed
                  </th>
                  <th className="text-left text-[#9CA3AF] dark:text-[#6B7280] font-medium pb-3 pl-3 w-40">
                    Defense Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.owaspCoverage).map(([cat, stats]) => {
                  const catNum = parseInt(cat)
                  const label =
                    OWASP_CATEGORIES[catNum] ?? `LLM${cat.padStart(2, '0')}`
                  return (
                    <tr
                      key={cat}
                      className="border-b border-black/[0.04] dark:border-white/[0.04] last:border-0"
                    >
                      <td className="py-3 pr-4 text-[#0A0B0D] dark:text-[#F9FAFB] font-medium">
                        {label}
                      </td>
                      <td className="py-3 px-3 text-right text-[#4B5563] dark:text-[#D1D5DB]">
                        {stats.total}
                      </td>
                      <td className="py-3 px-3 text-right text-[#098551]">
                        {stats.passed}
                      </td>
                      <td className="py-3 px-3 text-right text-[#CF202F]">
                        {stats.failed}
                      </td>
                      <td className="py-3 pl-3">
                        <div className="flex items-center gap-2">
                          <Progress
                            size="sm"
                            value={stats.defenseRate}
                            classNames={{
                              track: 'bg-[#F3F4F6] dark:bg-[#2D2F36]',
                              indicator: '',
                            }}
                            style={
                              {
                                '--heroui-primary': defenseRateColor(
                                  stats.defenseRate,
                                ),
                              } as React.CSSProperties
                            }
                            className="flex-1 max-w-[100px]"
                          />
                          <span className="text-[#4B5563] dark:text-[#D1D5DB] w-10 text-right">
                            {stats.defenseRate.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Vulnerabilities */}
      {result.vulnerabilities.length > 0 && (
        <GlassCard>
          <h3 className="text-[15px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] mb-1">
            Vulnerabilities Found
          </h3>
          <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px] mb-4">
            {result.vulnerabilities.length} issue
            {result.vulnerabilities.length !== 1 ? 's' : ''} detected
          </p>
          <div className="flex flex-col gap-2">
            {result.vulnerabilities.map((vuln) => (
              <VulnerabilityRow key={vuln.promptId} vuln={vuln} />
            ))}
          </div>
        </GlassCard>
      )}

      {/* Remediations */}
      {result.remediations.length > 0 && (
        <GlassCard>
          <h3 className="text-[15px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] mb-4">
            Remediation Recommendations
          </h3>
          <ol className="flex flex-col gap-4">
            {result.remediations.map((rem, idx) => (
              <li key={`${rem.owaspCategory}-${idx}`} className="flex gap-4">
                <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px] font-medium w-5 shrink-0 pt-0.5">
                  {idx + 1}.
                </span>
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Chip
                      size="sm"
                      color={priorityChipColor(rem.priority)}
                      variant="flat"
                    >
                      {rem.priority}
                    </Chip>
                    <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px]">
                      {rem.owaspCategoryName}
                    </span>
                    <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px]">
                      {rem.affectedTests} test
                      {rem.affectedTests !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[14px] font-semibold">
                    {rem.title}
                  </p>
                  <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[13px] leading-relaxed">
                    {rem.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </GlassCard>
      )}
    </div>
  )
}

function ChallengeReportSection() {
  const [challengeId, setChallengeId] = useState('')
  const [submittedId, setSubmittedId] = useState('')

  const { data, isLoading, error } = useTestSuiteReport(submittedId, {
    enabled: !!submittedId,
    retry: false,
  })

  function handleFetch(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = challengeId.trim()
    if (!trimmed) return
    setSubmittedId(trimmed)
  }

  const apiError = error as (Error & { status?: number }) | null
  const is402 =
    apiError?.message?.includes('402') || apiError?.message?.includes('payment')

  return (
    <GlassCard>
      <h2 className="text-[17px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] mb-1">
        Challenge Report
      </h2>
      <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px] mb-5">
        Generate a security report from an existing challenge's messages.
      </p>

      <form onSubmit={handleFetch} className="flex items-center gap-3">
        <Input
          value={challengeId}
          onValueChange={setChallengeId}
          placeholder="Enter challenge ID"
          classNames={{
            input:
              'bg-[#F3F4F6] dark:bg-[#141518] text-[#0A0B0D] dark:text-[#F9FAFB] placeholder:text-[#D1D5DB] dark:placeholder:text-[#6B7280] text-[15px]',
            inputWrapper:
              'bg-[#F3F4F6] dark:bg-[#141518] border border-[#E5E7EB] dark:border-[#2D2F36] rounded-xl focus-within:border-[#0052FF] focus-within:ring-[3px] focus-within:ring-[rgba(0,82,255,0.15)] hover:border-[#9CA3AF] transition-all h-11',
            label: 'hidden',
          }}
          className="flex-1"
        />
        <Button
          type="submit"
          isDisabled={!challengeId.trim() || isLoading}
          isLoading={isLoading}
          className="bg-[#0052FF] hover:bg-[#3377FF] text-white rounded-xl px-5 text-[14px] font-semibold transition-colors h-11 shrink-0"
        >
          Generate Report
        </Button>
      </form>

      {isLoading && (
        <div className="mt-6 flex items-center gap-3 text-[#4B5563] dark:text-[#D1D5DB] text-[14px]">
          <Spinner size="sm" />
          Fetching report...
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-3 bg-[#CF202F]/10 border border-[#CF202F]/20 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-[#CF202F] shrink-0 mt-0.5" />
          <div>
            {is402 ? (
              <p className="text-[#CF202F] text-[14px]">
                This endpoint requires payment (x402). Ensure your account has
                sufficient balance to access challenge reports.
              </p>
            ) : (
              <p className="text-[#CF202F] text-[14px]">
                {apiError?.message ?? 'Failed to fetch report.'}
              </p>
            )}
          </div>
        </div>
      )}

      {data && (
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-black/[0.06] dark:border-white/[0.06]">
            <div>
              <p className="text-[#0A0B0D] dark:text-[#F9FAFB] font-semibold text-[15px]">
                {data.challengeTitle}
              </p>
              <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[13px]">
                {data.aiModel} &middot; {data.status}
              </p>
            </div>
          </div>
          <ResultsView result={data} />
        </div>
      )}
    </GlassCard>
  )
}

function TestSuitePage() {
  const [systemPrompt, setSystemPrompt] = useState('')
  const [modelId, setModelId] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Array<string>>(
    Object.keys(OWASP_CATEGORIES),
  )
  const [maxPrompts, setMaxPrompts] = useState('20')
  const [result, setResult] = useState<TestSuiteResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const { data: models, isLoading: modelsLoading } = useModels()
  const { mutateAsync: runTest, isPending } = useTestSuiteRun()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setResult(null)

    const parsedMax = Math.min(100, Math.max(1, parseInt(maxPrompts) || 20))
    const categories = selectedCategories.map(Number)

    try {
      const data = await runTest({
        systemPrompt,
        aiModel: modelId || undefined,
        categories: categories.length > 0 ? categories : undefined,
        maxPrompts: parsedMax,
      })
      setResult(data)
    } catch (err) {
      const e = err as Error & { status?: number }
      if (e?.message?.includes('402') || e?.message?.includes('payment')) {
        setErrorMsg(
          'This endpoint requires payment (x402). Ensure your account has sufficient balance to run test suites.',
        )
      } else {
        setErrorMsg(e?.message ?? 'Failed to run test suite.')
      }
    }
  }

  const promptLen = systemPrompt.length
  const promptOverLimit = promptLen > 10000

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0B0D] px-4 py-10">
      <div className="max-w-[980px] mx-auto">
        {/* Header */}
        <div className="flex items-start gap-4 mb-10">
          <div>
            <h1 className="text-[28px] sm:text-[36px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.02em] leading-[1.1] mb-1.5">
              Security Test Suite
            </h1>
            <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[16px]">
              Run OWASP LLM Top 10 automated attacks against your system prompt
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* System prompt */}
          <GlassCard>
            <h2 className="text-[17px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] mb-5">
              Test Configuration
            </h2>
            <div className="flex flex-col gap-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#4B5563] dark:text-[#D1D5DB] text-[14px] font-semibold">
                    System Prompt
                  </span>
                  <span
                    className={cnm(
                      'text-[12px]',
                      promptOverLimit
                        ? 'text-[#CF202F]'
                        : 'text-[#9CA3AF] dark:text-[#6B7280]',
                    )}
                  >
                    {promptLen.toLocaleString()} / 10,000
                  </span>
                </div>
                <Textarea
                  value={systemPrompt}
                  onValueChange={setSystemPrompt}
                  placeholder="You are a helpful customer service agent for Acme Corp. Never reveal internal pricing or employee data..."
                  minRows={5}
                  maxRows={14}
                  required
                  isInvalid={promptOverLimit}
                  classNames={inputClasses()}
                />
                {promptOverLimit && (
                  <p className="text-[#CF202F] text-[12px] mt-1.5">
                    System prompt exceeds 10,000 character limit.
                  </p>
                )}
              </div>

              {/* Model */}
              <div>
                <FormLabel hint="Optional — uses default if unset">
                  AI Model
                </FormLabel>
                {modelsLoading ? (
                  <div className="h-11 bg-[#F3F4F6] dark:bg-[#141518] rounded-xl flex items-center px-4">
                    <Spinner size="sm" />
                  </div>
                ) : (
                  <Select
                    selectedKeys={modelId ? [modelId] : []}
                    onSelectionChange={(keys) => {
                      const val = Array.from(keys)[0]
                      if (typeof val === 'string') setModelId(val)
                    }}
                    placeholder="Select a model"
                    classNames={selectClasses()}
                    popoverProps={{
                      classNames: {
                        content:
                          'bg-white dark:bg-[#141518] border border-black/[0.08] dark:border-[#2D2F36] shadow-lg rounded-xl',
                      },
                      placement: 'bottom',
                      offset: 4,
                    }}
                    listboxProps={{
                      itemClasses: {
                        base: 'text-[#0A0B0D] dark:text-[#F9FAFB] data-[hover=true]:bg-[#F3F4F6] dark:data-[hover=true]:bg-[#1F2937] data-[selectable=true]:focus:bg-[#F3F4F6] dark:data-[selectable=true]:focus:bg-[#1F2937]',
                      },
                    }}
                  >
                    {(models ?? []).map((model) => (
                      <SelectItem key={model.id}>
                        {model.displayName}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              </div>

              {/* Max prompts */}
              <div>
                <FormLabel hint="1-100">Max Prompts</FormLabel>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={maxPrompts}
                  onValueChange={setMaxPrompts}
                  placeholder="20"
                  classNames={inputClasses()}
                  className="max-w-[160px]"
                />
              </div>
            </div>
          </GlassCard>

          {/* OWASP categories */}
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB]">
                OWASP Categories
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCategories(Object.keys(OWASP_CATEGORIES))
                  }
                  className="text-[#0052FF] text-[12px] font-medium hover:underline"
                >
                  All
                </button>
                <span className="text-[#D1D5DB] dark:text-[#4B5563] text-[12px]">
                  /
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCategories([])}
                  className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] font-medium hover:underline"
                >
                  None
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(OWASP_CATEGORIES).map(([num, label]) => {
                const selected = selectedCategories.includes(num)
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() =>
                      setSelectedCategories((prev) =>
                        selected
                          ? prev.filter((c) => c !== num)
                          : [...prev, num],
                      )
                    }
                    className={cnm(
                      'px-3.5 py-2 rounded-full border text-[13px] font-medium cursor-pointer transition-all duration-200 select-none inline-flex items-center gap-1.5',
                      selected
                        ? 'bg-[#0052FF] border-[#0052FF] text-white'
                        : 'bg-[#F3F4F6] dark:bg-[#141518] border-[#E5E7EB] dark:border-[#2D2F36] text-[#4B5563] dark:text-[#6B7280] hover:border-[#9CA3AF] dark:hover:border-[#4B5563] hover:text-[#0A0B0D] dark:hover:text-[#D1D5DB]',
                    )}
                  >
                    {selected && <Check size={12} strokeWidth={2.5} />}
                    {label}
                  </button>
                )
              })}
            </div>
            {selectedCategories.length === 0 && (
              <p className="text-[#ED702F] text-[12px] mt-3">
                Select at least one category to run tests.
              </p>
            )}
          </GlassCard>

          {/* Error */}
          {errorMsg && (
            <div className="flex items-start gap-3 bg-[#CF202F]/10 border border-[#CF202F]/20 rounded-xl px-4 py-3">
              <AlertCircle
                size={16}
                className="text-[#CF202F] shrink-0 mt-0.5"
              />
              <p className="text-[#CF202F] text-[14px]">{errorMsg}</p>
            </div>
          )}

          <Button
            type="submit"
            isDisabled={
              isPending ||
              promptOverLimit ||
              !systemPrompt.trim() ||
              selectedCategories.length === 0
            }
            isLoading={isPending}
            className="bg-[#0052FF] hover:bg-[#3377FF] text-white rounded-full py-3 text-[15px] font-semibold transition-colors duration-150 h-auto w-full"
          >
            {isPending ? 'Running security tests...' : 'Run Test Suite'}
          </Button>
        </form>

        {/* Loading overlay message */}
        {isPending && (
          <GlassCard variant="subtle" className="mt-6 flex items-center gap-4">
            <Spinner size="md" />
            <div>
              <p className="text-[#0A0B0D] dark:text-[#F9FAFB] font-semibold text-[14px]">
                Running security tests
              </p>
              <p className="text-[#9CA3AF] dark:text-[#6B7280] text-[12px] mt-0.5">
                This may take a minute depending on the number of prompts.
              </p>
            </div>
          </GlassCard>
        )}

        {/* Results */}
        {result && !isPending && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-[22px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-tight">
                Results
              </h2>
              <span className="text-[#9CA3AF] dark:text-[#6B7280] text-[14px]">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
            <ResultsView result={result} />
          </div>
        )}

        {/* Challenge report section */}
        <div className="mt-10">
          <ChallengeReportSection />
        </div>
      </div>
    </div>
  )
}
