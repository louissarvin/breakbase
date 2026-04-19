import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Input, Skeleton } from '@heroui/react'
import {
  ClipboardList,
  ExternalLink,
  Search,
  Shield,
  Sword,
} from 'lucide-react'
import type { Attestation, AttestationSchemas } from '@/lib/api/hooks'
import GlassCard from '@/components/GlassCard'
import {
  useAttestation,
  useAttestationSchemas,
  useBasename,
} from '@/lib/api/hooks'
import { useReputationSchemas } from '@/lib/contracts/hooks'
import { config } from '@/config'
import { cnm } from '@/utils/style'

export const Route = createFileRoute('/attestations')({
  component: AttestationsPage,
})

const EAS_EXPLORER_BASE = 'https://base-sepolia.easscan.org'
const BASESCAN_BASE = 'https://sepolia.basescan.org'

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Low',
  2: 'Med',
  3: 'High',
  4: 'Critical',
}

const SEVERITY_COLORS: Record<number, string> = {
  1: 'text-[#16A34A] bg-[#F0FDF4] border-[#BBF7D0]',
  2: 'text-[#CA8A04] bg-[#FEFCE8] border-[#FEF08A]',
  3: 'text-[#EA580C] bg-[#FFF7ED] border-[#FED7AA]',
  4: 'text-[#DC2626] bg-[#FEF2F2] border-[#FECACA]',
}

function ExternalAnchor({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cnm(
        'inline-flex items-center gap-1 hover:underline',
        className,
      )}
    >
      {children}
    </a>
  )
}

function SchemaCard({
  label,
  uid,
  isLoading,
}: {
  label: string
  uid: string | null | undefined
  isLoading: boolean
}) {
  const shortUid = uid ? `${uid.slice(0, 10)}...${uid.slice(-8)}` : null

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[#0A0B0D] dark:text-[#F9FAFB] text-[14px] font-semibold">
          {label}
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="h-5 w-full rounded-lg bg-[#F3F4F6] dark:bg-[#141518]" />
      ) : uid ? (
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-[12px] text-[#4B5563] dark:text-[#D1D5DB] break-all leading-relaxed">
            {uid}
          </p>
          <ExternalAnchor
            href={`${EAS_EXPLORER_BASE}/schema/view/${uid}`}
            className="text-[#0052FF] text-[12px] font-medium"
          >
            View on EAS Explorer
            <ExternalLink size={11} />
          </ExternalAnchor>
        </div>
      ) : (
        <div>
          <p className="text-[12px] text-[#9CA3AF]">
            {shortUid ?? 'Not registered'}
          </p>
        </div>
      )}
    </GlassCard>
  )
}

function AddressDisplay({ address }: { address: string }) {
  const { data } = useBasename(address)
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`

  return (
    <span className="font-mono text-[13px] text-[#4B5563] dark:text-[#D1D5DB]">
      {data?.basename ?? short}
    </span>
  )
}

function DataRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider">
        {label}
      </p>
      <div className="text-[14px] text-[#0A0B0D] dark:text-[#F9FAFB]">
        {children}
      </div>
    </div>
  )
}

function AttackerFields({ data }: { data: Record<string, unknown> }) {
  const severity = typeof data.severity === 'number' ? data.severity : null

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      <DataRow label="Attacker">
        {typeof data.attacker === 'string' ? (
          <AddressDisplay address={data.attacker} />
        ) : (
          <span className="text-[#9CA3AF]">—</span>
        )}
      </DataRow>
      <DataRow label="Challenge ID">
        <span className="font-mono text-[13px]">
          {String(data.challengeId ?? '—')}
        </span>
      </DataRow>
      <DataRow label="Attack Type">
        <span>{String(data.attackType ?? '—')}</span>
      </DataRow>
      <DataRow label="Severity">
        {severity !== null ? (
          <span
            className={cnm(
              'inline-block px-2 py-0.5 rounded-md text-[12px] font-medium border',
              SEVERITY_COLORS[severity] ??
                'text-[#4B5563] dark:text-[#D1D5DB] bg-[#F3F4F6] dark:bg-[#141518] border-[#E5E7EB] dark:border-[#2D2F36]',
            )}
          >
            {SEVERITY_LABELS[severity] ?? String(severity)}
          </span>
        ) : (
          <span className="text-[#9CA3AF]">—</span>
        )}
      </DataRow>
      <DataRow label="OWASP Category">
        <span>{String(data.owaspCategory ?? '—')}</span>
      </DataRow>
      <DataRow label="Attempt #">
        <span>{String(data.attemptNumber ?? '—')}</span>
      </DataRow>
      <DataRow label="Prize Won">
        <span>{String(data.prizeWon ?? '—')}</span>
      </DataRow>
    </div>
  )
}

function DefenderFields({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      <DataRow label="Defender">
        {typeof data.defender === 'string' ? (
          <AddressDisplay address={data.defender} />
        ) : (
          <span className="text-[#9CA3AF]">—</span>
        )}
      </DataRow>
      <DataRow label="Challenge ID">
        <span className="font-mono text-[13px]">
          {String(data.challengeId ?? '—')}
        </span>
      </DataRow>
      <DataRow label="Total Attempts">
        <span>{String(data.totalAttempts ?? '—')}</span>
      </DataRow>
      <DataRow label="Survival Duration">
        <span>{String(data.survivalDuration ?? '—')}</span>
      </DataRow>
      <DataRow label="Prize Pool Size">
        <span>{String(data.prizePoolSize ?? '—')}</span>
      </DataRow>
      <DataRow label="Was Breached">
        <span
          className={cnm(
            'inline-block px-2 py-0.5 rounded-md text-[12px] font-medium border',
            data.wasBreached
              ? 'text-[#DC2626] bg-[#FEF2F2] border-[#FECACA]'
              : 'text-[#16A34A] bg-[#F0FDF4] border-[#BBF7D0]',
          )}
        >
          {data.wasBreached ? 'Yes' : 'No'}
        </span>
      </DataRow>
      <DataRow label="Model Used">
        <span>{String(data.modelUsed ?? '—')}</span>
      </DataRow>
    </div>
  )
}

function AuditFields({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      <DataRow label="Agent">
        {typeof data.agent === 'string' ? (
          <AddressDisplay address={data.agent} />
        ) : (
          <span className="text-[#9CA3AF]">—</span>
        )}
      </DataRow>
      <DataRow label="Audit ID">
        <span className="font-mono text-[13px]">
          {String(data.auditId ?? '—')}
        </span>
      </DataRow>
      <DataRow label="Total Tests">
        <span>{String(data.totalTests ?? '—')}</span>
      </DataRow>
      <DataRow label="Passed">
        <span className="text-[#16A34A] font-medium">
          {String(data.passed ?? '—')}
        </span>
      </DataRow>
      <DataRow label="Failed">
        <span className="text-[#DC2626] font-medium">
          {String(data.failed ?? '—')}
        </span>
      </DataRow>
      <DataRow label="OWASP Coverage">
        <span>{String(data.owaspCoverage ?? '—')}</span>
      </DataRow>
      <DataRow label="Security Score">
        <span className="font-semibold">
          {String(data.securityScore ?? '—')}
        </span>
      </DataRow>
    </div>
  )
}

function resolveSchemaType(
  schema: string,
  schemas: AttestationSchemas | undefined,
): 'attacker' | 'defender' | 'audit' | 'unknown' {
  if (!schemas) return 'unknown'
  if (schema === schemas.attacker) return 'attacker'
  if (schema === schemas.defender) return 'defender'
  if (schema === schemas.audit) return 'audit'
  return 'unknown'
}

function AttestationResult({
  attestation,
  schemas,
}: {
  attestation: Attestation
  schemas: AttestationSchemas | undefined
}) {
  const schemaType = resolveSchemaType(attestation.schema, schemas)
  const timestamp = attestation.time
    ? new Date(Number(attestation.time) * 1000).toLocaleString()
    : '—'

  const schemaTypeLabel =
    schemaType === 'attacker'
      ? 'Attacker'
      : schemaType === 'defender'
        ? 'Defender'
        : schemaType === 'audit'
          ? 'Audit'
          : 'Unknown'

  return (
    <GlassCard className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-1">
            Attestation UID
          </p>
          <p className="font-mono text-[12px] text-[#4B5563] dark:text-[#D1D5DB] break-all">
            {attestation.uid}
          </p>
        </div>
        <ExternalAnchor
          href={`${EAS_EXPLORER_BASE}/attestation/view/${attestation.uid}`}
          className="text-[#0052FF] text-[12px] font-medium shrink-0"
        >
          View on EAS
          <ExternalLink size={11} />
        </ExternalAnchor>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <DataRow label="Recipient">
          <AddressDisplay address={attestation.recipient} />
        </DataRow>
        <DataRow label="Attester">
          <AddressDisplay address={attestation.attester} />
        </DataRow>
        <DataRow label="Timestamp">
          <span className="text-[13px]">{timestamp}</span>
        </DataRow>
        <DataRow label="Schema Type">
          <span
            className={cnm(
              'inline-block px-2 py-0.5 rounded-md text-[12px] font-medium border',
              schemaType === 'attacker'
                ? 'text-[#DC2626] bg-[#FEF2F2] border-[#FECACA]'
                : schemaType === 'defender'
                  ? 'text-[#16A34A] bg-[#F0FDF4] border-[#BBF7D0]'
                  : schemaType === 'audit'
                    ? 'text-[#0052FF] bg-[#F0F4FF] dark:bg-[#0A1628] border-[#0052FF]/20'
                    : 'text-[#4B5563] dark:text-[#D1D5DB] bg-[#F3F4F6] dark:bg-[#141518] border-[#E5E7EB] dark:border-[#2D2F36]',
            )}
          >
            {schemaTypeLabel}
          </span>
        </DataRow>
      </div>

      {attestation.decodedData && (
        <>
          <div className="border-t border-black/[0.06] dark:border-white/[0.06]" />
          <div>
            <p className="text-[12px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] mb-4">
              Decoded Fields
            </p>
            {schemaType === 'attacker' && (
              <AttackerFields data={attestation.decodedData} />
            )}
            {schemaType === 'defender' && (
              <DefenderFields data={attestation.decodedData} />
            )}
            {schemaType === 'audit' && (
              <AuditFields data={attestation.decodedData} />
            )}
            {schemaType === 'unknown' && (
              <pre className="text-[12px] font-mono text-[#4B5563] dark:text-[#D1D5DB] bg-[#F9FAFB] dark:bg-[#141518] rounded-xl p-4 overflow-x-auto">
                {JSON.stringify(attestation.decodedData, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </GlassCard>
  )
}

function AttestationLookup({
  schemas,
}: {
  schemas: AttestationSchemas | undefined
}) {
  const [inputValue, setInputValue] = useState('')
  const [activeUid, setActiveUid] = useState('')

  const { data, isLoading, isError, error } = useAttestation(activeUid, {
    enabled: !!activeUid,
    retry: false,
  })

  function handleLookup() {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    setActiveUid(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleLookup()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onValueChange={setInputValue}
          onKeyDown={handleKeyDown}
          placeholder="0x..."
          classNames={{
            base: 'flex-1',
            inputWrapper:
              'bg-white dark:bg-[#141518] border border-black/[0.08] dark:border-[#2D2F36] shadow-none rounded-xl h-11 data-[hover=true]:border-[#0052FF]/30 data-[focus=true]:border-[#0052FF]',
            input:
              'text-[14px] font-mono text-[#0A0B0D] dark:text-[#F9FAFB] placeholder:text-[#9CA3AF] dark:placeholder:text-[#6B7280]',
          }}
          startContent={
            <Search size={14} className="text-[#9CA3AF] shrink-0" />
          }
          variant="bordered"
        />
        <Button
          onPress={handleLookup}
          isLoading={isLoading}
          className="bg-[#0052FF] text-white text-[14px] font-medium rounded-xl h-11 px-5 shrink-0"
        >
          Look up
        </Button>
      </div>

      {isLoading && (
        <GlassCard className="flex flex-col gap-4">
          <Skeleton className="h-4 w-48 rounded-lg bg-[#F3F4F6] dark:bg-[#141518]" />
          <Skeleton className="h-4 w-full rounded-lg bg-[#F3F4F6] dark:bg-[#141518]" />
          <Skeleton className="h-4 w-3/4 rounded-lg bg-[#F3F4F6] dark:bg-[#141518]" />
        </GlassCard>
      )}

      {isError && (
        <GlassCard>
          <p className="text-[#CF202F] text-[14px]">
            {error instanceof Error ? error.message : 'Attestation not found.'}
          </p>
        </GlassCard>
      )}

      {data && !isLoading && (
        <AttestationResult attestation={data} schemas={schemas} />
      )}
    </div>
  )
}

function AttestationsPage() {
  const { data: apiSchemas, isLoading: apiSchemasLoading } =
    useAttestationSchemas()
  const { attackerSchema, defenderSchema, auditSchema } = useReputationSchemas()

  const attackerUid =
    (attackerSchema.data as string | undefined) ?? apiSchemas?.attacker ?? null
  const defenderUid =
    (defenderSchema.data as string | undefined) ?? apiSchemas?.defender ?? null
  const auditUid =
    (auditSchema.data as string | undefined) ?? apiSchemas?.audit ?? null

  const schemasLoading =
    apiSchemasLoading ||
    attackerSchema.isLoading ||
    defenderSchema.isLoading ||
    auditSchema.isLoading

  const easAddress = apiSchemas?.easAddress

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0B0D] px-4 py-12">
      <div className="max-w-[980px] mx-auto flex flex-col gap-12">
        {/* Header */}
        <div>
          <h1 className="text-[40px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.02em] leading-[1.1] mb-2">
            Attestations
          </h1>
          <p className="text-[#4B5563] dark:text-[#D1D5DB] text-[17px]">
            On-chain reputation powered by Ethereum Attestation Service (EAS)
          </p>
        </div>

        {/* Schema Info */}
        <section className="flex flex-col gap-4">
          <h2 className="text-[18px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.01em]">
            Registered Schemas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SchemaCard
              label="Attacker Schema"
              uid={attackerUid}
              isLoading={schemasLoading}
            />
            <SchemaCard
              label="Defender Schema"
              uid={defenderUid}
              isLoading={schemasLoading}
            />
            <SchemaCard
              label="Audit Schema"
              uid={auditUid}
              isLoading={schemasLoading}
            />
          </div>
        </section>

        {/* Attestation Lookup */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-[18px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.01em] mb-1">
              Attestation Lookup
            </h2>
            <p className="text-[#6B7280] dark:text-[#9CA3AF] text-[14px]">
              Enter an attestation UID to decode its data.
            </p>
          </div>
          <AttestationLookup schemas={apiSchemas} />
        </section>

        {/* Protocol Info */}
        <section className="flex flex-col gap-4">
          <h2 className="text-[18px] font-semibold text-[#0A0B0D] dark:text-[#F9FAFB] tracking-[-0.01em]">
            Protocol Info
          </h2>
          <GlassCard className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06]">
                <div>
                  <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-0.5">
                    ReputationOracle
                  </p>
                  <p className="font-mono text-[13px] text-[#4B5563] dark:text-[#D1D5DB]">
                    {config.contracts.reputationOracle}
                  </p>
                </div>
                <ExternalAnchor
                  href={`${BASESCAN_BASE}/address/${config.contracts.reputationOracle}`}
                  className="text-[#0052FF] text-[12px] font-medium shrink-0"
                >
                  BaseScan
                  <ExternalLink size={11} />
                </ExternalAnchor>
              </div>

              <div className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-0.5">
                    EAS Contract
                  </p>
                  {easAddress ? (
                    <p className="font-mono text-[13px] text-[#4B5563] dark:text-[#D1D5DB]">
                      {easAddress}
                    </p>
                  ) : apiSchemasLoading ? (
                    <Skeleton className="h-4 w-48 rounded-lg bg-[#F3F4F6] dark:bg-[#141518] mt-0.5" />
                  ) : (
                    <p className="text-[13px] text-[#9CA3AF]">Loading...</p>
                  )}
                </div>
                {easAddress && (
                  <ExternalAnchor
                    href={`${BASESCAN_BASE}/address/${easAddress}`}
                    className="text-[#0052FF] text-[12px] font-medium shrink-0"
                  >
                    BaseScan
                    <ExternalLink size={11} />
                  </ExternalAnchor>
                )}
              </div>
            </div>
          </GlassCard>
        </section>
      </div>
    </div>
  )
}
