import Link from 'next/link'
import { TesseraShell } from '@/components/TesseraShell'
import { supabase } from '@/lib/supabase'
import { RISK_COLOURS, RISK_TINTS } from '@plato/ui/tokens'
import type { RiskLevel } from '@plato/ui/tokens'

export const dynamic = 'force-dynamic'

type ParkerQuestion = {
  id: string
  number: number
  question: string
}

type DomainRef = {
  id: string
  name: string
  slug: string
  risk_level: RiskLevel | null
}

type MappingRow = {
  parker_question_id: string
  domain_id: string
}

const RISK_LEVELS: RiskLevel[] = ['HIGH', 'MEDIUM', 'LOW', 'SCOPED']

export default async function ParkerPage() {
  const [questionsRes, mappingsRes] = await Promise.all([
    supabase
      .from('tessera_parker_questions')
      .select('id, number, question')
      .order('number'),
    supabase
      .from('tessera_domain_parker_mapping')
      .select('parker_question_id, domain_id'),
  ])

  if (questionsRes.error) console.error('[ParkerPage] questions error:', questionsRes.error)
  if (mappingsRes.error) console.error('[ParkerPage] mappings error:', mappingsRes.error)

  const questions = (questionsRes.data ?? []) as ParkerQuestion[]
  const mappings  = (mappingsRes.data ?? []) as MappingRow[]

  const domainIds = [...new Set(mappings.map((m) => m.domain_id))]

  let domains: DomainRef[] = []
  if (domainIds.length > 0) {
    const { data } = await supabase
      .from('tessera_domains')
      .select('id, name, slug, risk_level')
      .in('id', domainIds)
      .order('display_order')
    domains = (data ?? []) as DomainRef[]
  }

  const domainMap = new Map(domains.map((d) => [d.id, d]))

  const mappingsByQuestion = new Map<string, DomainRef[]>()
  for (const m of mappings) {
    const domain = domainMap.get(m.domain_id)
    if (!domain) continue
    const existing = mappingsByQuestion.get(m.parker_question_id) ?? []
    mappingsByQuestion.set(m.parker_question_id, [...existing, domain])
  }

  return (
    <TesseraShell activeRoute="/parker">
      <div
        style={{
          backgroundColor: 'var(--rmg-color-surface-light)',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            width: '100%',
            padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
            boxSizing: 'border-box',
          }}
        >
          {/* Page header */}
          <div style={{ marginBottom: 24 }}>
            <h1
              style={{
                fontFamily: 'var(--rmg-font-display)',
                fontSize: '2rem',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                color: 'var(--rmg-color-text-heading)',
                margin: 0,
              }}
            >
              Parker&apos;s 7
            </h1>
            <p
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 14,
                color: 'var(--rmg-color-text-light)',
                margin: 0,
                marginTop: 6,
              }}
            >
              Seven questions every KT programme must answer
            </p>
          </div>

          {/* Context note — Section 5 inline card, tint-green variant */}
          <div
            style={{
              borderRadius: '0 var(--rmg-radius-s) var(--rmg-radius-s) var(--rmg-radius-s)',
              padding: '18px 20px',
              background: 'var(--rmg-color-tint-green)',
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
              maxWidth: 560,
              marginBottom: 24,
            }}
          >
            <p
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 14,
                color: 'var(--rmg-color-text-heading)',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              These questions were posed by Robert Parker (CG Director) as the
              acceptance criteria for a successful knowledge transfer. Each
              domain&apos;s readiness is assessed against all seven.
            </p>
          </div>

          {/* Risk legend */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 24,
            }}
          >
            {RISK_LEVELS.map((level) => (
              <div
                key={level}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: RISK_COLOURS[level],
                    flexShrink: 0,
                    display: 'inline-block',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 12,
                    color: 'var(--rmg-color-text-light)',
                  }}
                >
                  {level.charAt(0) + level.slice(1).toLowerCase()}
                </span>
              </div>
            ))}
          </div>

          {/* Question cards */}
          {questions.map((q) => {
            const linked = mappingsByQuestion.get(q.id) ?? []
            const sortedLinked = [...linked].sort(
              (a, b) =>
                domains.findIndex((d) => d.id === a.id) -
                domains.findIndex((d) => d.id === b.id),
            )
            return (
              <QuestionCard key={q.id} question={q} domains={sortedLinked} />
            )
          })}
        </div>
      </div>
    </TesseraShell>
  )
}

function QuestionCard({
  question,
  domains,
}: {
  question: ParkerQuestion
  domains: DomainRef[]
}) {
  return (
    <div
      id={`q${question.number}`}
      style={{
        background: 'white',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: 24,
        marginBottom: 16,
        display: 'flex',
        gap: 20,
      }}
    >
      {/* Number badge */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--rmg-color-brand-black)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--rmg-font-display)',
          fontSize: '1.1rem',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {question.number}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--rmg-color-text-heading)',
            marginBottom: 12,
          }}
        >
          {question.question}
        </div>

        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.07em',
            color: 'var(--rmg-color-grey-1)',
            marginBottom: 10,
          }}
        >
          Addressed by
        </div>

        {domains.length === 0 ? (
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 12,
              color: 'var(--rmg-color-grey-1)',
              fontStyle: 'italic',
              margin: 0,
            }}
          >
            No domains linked yet
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {domains.map((d) => (
              <DomainChip key={d.id} domain={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DomainChip({ domain }: { domain: DomainRef }) {
  const level = domain.risk_level
  const bg           = level ? RISK_TINTS[level]   : 'var(--rmg-color-grey-3)'
  const borderColour = level ? RISK_COLOURS[level]  : 'var(--rmg-color-grey-1)'

  return (
    <Link href={`/domains/${domain.slug}`} style={{ textDecoration: 'none' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: 'var(--rmg-radius-xs)',
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 500,
          background: bg,
          borderLeft: `3px solid ${borderColour}`,
          color: 'var(--rmg-color-text-body)',
          fontFamily: 'var(--rmg-font-body)',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >
        {domain.name}
      </span>
    </Link>
  )
}
