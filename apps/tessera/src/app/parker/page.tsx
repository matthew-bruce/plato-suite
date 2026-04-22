import Link from 'next/link'
import { TesseraShell } from '@plato/ui/components/tessera'
import { supabase } from '@/lib/supabase'
import type { RiskLevel } from '@/components/RiskPill'

export const dynamic = 'force-dynamic'

const RISK_COLOURS: Record<RiskLevel, string> = {
  HIGH: '#E8382A',
  MEDIUM: '#E65100',
  LOW: '#1B5E20',
  SCOPED: '#6A1B9A',
}

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

export default async function ParkerPage() {
  const [questionsRes, mappingsRes] = await Promise.all([
    supabase
      .from('kt_parker_questions')
      .select('id, number, question')
      .order('number'),
    supabase
      .from('kt_domain_parker_mapping')
      .select('parker_question_id, domain_id'),
  ])

  const questions = (questionsRes.data ?? []) as ParkerQuestion[]
  const mappings = (mappingsRes.data ?? []) as MappingRow[]

  const domainIds = [...new Set(mappings.map((m) => m.domain_id))]

  let domains: DomainRef[] = []
  if (domainIds.length > 0) {
    const { data } = await supabase
      .from('kt_domains')
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
          maxWidth: 900,
          padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--rmg-spacing-05)',
            flexWrap: 'wrap',
            marginBottom: 'var(--rmg-spacing-08)',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: 'var(--rmg-font-display)',
                fontSize: 'var(--rmg-text-h2)',
                lineHeight: 'var(--rmg-leading-h2)',
                color: 'var(--rmg-color-text-heading)',
                margin: 0,
              }}
            >
              Parker&apos;s 7
            </h1>
            <p
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-b3)',
                lineHeight: 'var(--rmg-leading-b3)',
                color: 'var(--rmg-color-text-light)',
                margin: 0,
                marginTop: 'var(--rmg-spacing-02)',
                maxWidth: 560,
              }}
            >
              Seven questions from CG Director Robert Parker. These are not
              rhetorical — he will follow up.
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--rmg-spacing-03)',
              flexShrink: 0,
              paddingTop: 4,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px var(--rmg-spacing-03)',
                backgroundColor: 'rgba(8, 146, 203, 0.12)',
                color: 'var(--rmg-color-blue)',
                borderRadius: 'var(--rmg-radius-xl)',
                fontFamily: 'monospace',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
              }}
            >
              Reference
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 'var(--rmg-text-c2)',
                color: 'var(--rmg-color-text-light)',
                whiteSpace: 'nowrap',
              }}
            >
              {questions.length} questions · {mappings.length} domains mapped
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--rmg-spacing-05)',
          }}
        >
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

        <div
          style={{
            marginTop: 'var(--rmg-spacing-08)',
            backgroundColor: 'var(--rmg-color-surface-white)',
            borderRadius: 'var(--rmg-radius-m)',
            boxShadow: 'var(--rmg-shadow-card)',
            borderLeft: '3px solid var(--rmg-color-grey-2)',
            padding: 'var(--rmg-spacing-05) var(--rmg-spacing-06)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-c1)',
              lineHeight: 'var(--rmg-leading-c1)',
              color: 'var(--rmg-color-text-light)',
            }}
          >
            Robert Parker (CG Director) is retained 1–2 days/week through year
            end. He has final sign-off on KT readiness and will ask these
            questions directly to TCS during the transition review.
          </p>
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
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: 'var(--rmg-spacing-06)',
        scrollMarginTop: 'var(--rmg-spacing-06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--rmg-spacing-04)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: 'var(--rmg-color-text-heading)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontFamily: 'monospace',
            fontSize: 'var(--rmg-text-c2)',
            fontWeight: 700,
            color: 'var(--rmg-color-surface-white)',
            letterSpacing: '0.02em',
          }}
        >
          P{question.number}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b2)',
              lineHeight: 'var(--rmg-leading-b2)',
              color: 'var(--rmg-color-text-body)',
              fontWeight: 500,
            }}
          >
            {question.question}
          </p>

          {domains.length > 0 && (
            <div style={{ marginTop: 'var(--rmg-spacing-04)' }}>
              <div
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 'var(--rmg-text-c2)',
                  color: 'var(--rmg-color-text-light)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 700,
                  marginBottom: 'var(--rmg-spacing-02)',
                }}
              >
                Addressed by
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--rmg-spacing-02)',
                }}
              >
                {domains.map((d) => (
                  <DomainChip key={d.id} domain={d} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DomainChip({ domain }: { domain: DomainRef }) {
  const dotColour = domain.risk_level
    ? RISK_COLOURS[domain.risk_level]
    : 'var(--rmg-color-grey-1)'
  return (
    <Link href={`/domains/${domain.slug}`} style={{ textDecoration: 'none' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--rmg-spacing-02)',
          padding: `var(--rmg-spacing-02) var(--rmg-spacing-03)`,
          backgroundColor: 'var(--rmg-color-surface-light)',
          borderRadius: 'var(--rmg-radius-s)',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c1)',
          color: 'var(--rmg-color-text-body)',
          fontWeight: 500,
          border: '1px solid var(--rmg-color-grey-3)',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: dotColour,
            flexShrink: 0,
          }}
        />
        {domain.name}
      </span>
    </Link>
  )
}
