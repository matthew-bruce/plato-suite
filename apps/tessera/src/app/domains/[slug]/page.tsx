import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { TesseraShell } from '@plato/ui/components/tessera'
import { supabase } from '@/lib/supabase'
import { RiskPill, type RiskLevel } from '@/components/RiskPill'
import {
  DomainTrackPanel,
  type TrackContent,
  type ParkerQuestion,
} from '@/components/DomainTrackPanel'

export const dynamic = 'force-dynamic'

type Domain = {
  id: string
  name: string
  subtitle: string | null
  description: string | null
  risk_level: RiskLevel | null
  display_order: number
  slug: string
}

type RagScore = {
  domain_id: string
  dimension:
    | 'PEOPLE'
    | 'SESSIONS'
    | 'DEMO'
    | 'DOCUMENTATION'
    | 'PEER_REVIEW'
    | 'MILESTONE'
  score: 'RED' | 'AMBER' | 'GREEN'
  evidence: string | null
  updated_at: string
  updated_by: string | null
}

const DIMENSIONS: Array<{
  key: RagScore['dimension']
  label: string
}> = [
  { key: 'PEOPLE', label: 'People' },
  { key: 'SESSIONS', label: 'Sessions' },
  { key: 'DEMO', label: 'Demo' },
  { key: 'DOCUMENTATION', label: 'Documentation' },
  { key: 'PEER_REVIEW', label: 'Peer Review' },
  { key: 'MILESTONE', label: 'Milestone' },
]

const BASELINE_EVIDENCE = 'Initial baseline — not yet assessed.'

export default async function DomainDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data: domain } = await supabase
    .from('tessera_domains')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!domain) notFound()

  const domainTyped = domain as Domain

  const [trackRes, ragRes, parkerMappingRes, allDomainsRes] = await Promise.all(
    [
      supabase
        .from('tessera_domain_track_content')
        .select('id, track, field_type, content')
        .eq('domain_id', domainTyped.id)
        .order('track'),
      supabase.from('tessera_rag_scores').select('*').eq('domain_id', domainTyped.id),
      supabase
        .from('tessera_domain_parker_mapping')
        .select('tessera_parker_questions(number, question)')
        .eq('domain_id', domainTyped.id),
      supabase
        .from('tessera_domains')
        .select('id, name, slug, display_order')
        .order('display_order'),
    ],
  )

  const trackContent = (trackRes.data ?? []) as TrackContent[]
  const ragScores = (ragRes.data ?? []) as RagScore[]

  type ParkerJoinRow = {
    tessera_parker_questions:
      | ParkerQuestion
      | ParkerQuestion[]
      | null
  }
  const parkerQuestions: ParkerQuestion[] = ((parkerMappingRes.data ??
    []) as ParkerJoinRow[])
    .flatMap((row) => {
      const q = row.tessera_parker_questions
      if (!q) return []
      return Array.isArray(q) ? q : [q]
    })
    .sort((a, b) => a.number - b.number)

  const allDomains = (allDomainsRes.data ?? []) as Array<{
    id: string
    name: string
    slug: string
    display_order: number
  }>

  const currentIdx = allDomains.findIndex((d) => d.id === domainTyped.id)
  const prevDomain = currentIdx > 0 ? allDomains[currentIdx - 1] : null
  const nextDomain =
    currentIdx >= 0 && currentIdx < allDomains.length - 1
      ? allDomains[currentIdx + 1]
      : null

  const trackA = trackContent.filter((t) => t.track === 'A')
  const trackB = trackContent.filter((t) => t.track === 'B')

  return (
    <TesseraShell activeRoute="/domains">
      <div
        style={{
          maxWidth: 1280,
          padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--rmg-spacing-02)',
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c1)',
            color: 'var(--rmg-color-text-light)',
            textDecoration: 'none',
            marginBottom: 'var(--rmg-spacing-05)',
          }}
        >
          ← All domains
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--rmg-spacing-05)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--rmg-spacing-04)',
                flexWrap: 'wrap',
              }}
            >
              <h1
                style={{
                  fontFamily: 'var(--rmg-font-display)',
                  fontSize: 'var(--rmg-text-h2)',
                  lineHeight: 'var(--rmg-leading-h2)',
                  color: 'var(--rmg-color-text-heading)',
                  margin: 0,
                }}
              >
                {domainTyped.name}
              </h1>
              {domainTyped.risk_level && <RiskPill risk={domainTyped.risk_level} />}
            </div>
            {domainTyped.subtitle && (
              <p
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 'var(--rmg-text-b3)',
                  lineHeight: 'var(--rmg-leading-b3)',
                  color: 'var(--rmg-color-text-light)',
                  margin: 0,
                  marginTop: 'var(--rmg-spacing-02)',
                }}
              >
                {domainTyped.subtitle}
              </p>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--rmg-spacing-03)',
            }}
          >
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 'var(--rmg-text-c1)',
                color: 'var(--rmg-color-text-light)',
              }}
            >
              Domain {domainTyped.display_order} / {allDomains.length}
            </span>
            <NavArrow
              direction="prev"
              href={prevDomain ? `/domains/${prevDomain.slug}` : null}
            />
            <NavArrow
              direction="next"
              href={nextDomain ? `/domains/${nextDomain.slug}` : null}
            />
          </div>
        </div>

        {domainTyped.description && (
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b3)',
              lineHeight: 'var(--rmg-leading-b3)',
              color: 'var(--rmg-color-text-body)',
              margin: 0,
              marginTop: 'var(--rmg-spacing-05)',
              maxWidth: 800,
            }}
          >
            {domainTyped.description}
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--rmg-spacing-06)',
            marginTop: 'var(--rmg-spacing-08)',
          }}
        >
          <DomainTrackPanel
            track="A"
            trackContent={trackA}
            parkerQuestions={parkerQuestions}
          />
          <DomainTrackPanel
            track="B"
            trackContent={trackB}
            parkerQuestions={parkerQuestions}
          />
        </div>

        <ReadinessScorecard ragScores={ragScores} />

        <DomainFooterNav
          prevDomain={prevDomain}
          nextDomain={nextDomain}
        />
      </div>
    </TesseraShell>
  )
}

function NavArrow({
  direction,
  href,
}: {
  direction: 'prev' | 'next'
  href: string | null
}) {
  const disabled = !href
  const Icon = direction === 'prev' ? ArrowLeft : ArrowRight
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 'var(--rmg-radius-s)',
    backgroundColor: 'var(--rmg-color-surface-white)',
    border: '1px solid var(--rmg-color-grey-3)',
    color: disabled ? 'var(--rmg-color-grey-1)' : 'var(--rmg-color-text-body)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    textDecoration: 'none',
  }
  if (disabled) {
    return (
      <span style={style} aria-disabled="true">
        <Icon size={16} />
      </span>
    )
  }
  return (
    <Link href={href} style={style}>
      <Icon size={16} />
    </Link>
  )
}

function ReadinessScorecard({ ragScores }: { ragScores: RagScore[] }) {
  const byDimension = new Map(ragScores.map((s) => [s.dimension, s]))
  return (
    <div
      style={{
        marginTop: 'var(--rmg-spacing-08)',
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: 'var(--rmg-spacing-06)',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--rmg-font-display)',
          fontSize: 'var(--rmg-text-h6)',
          lineHeight: 'var(--rmg-leading-h6)',
          color: 'var(--rmg-color-text-heading)',
          margin: 0,
          marginBottom: 'var(--rmg-spacing-05)',
        }}
      >
        KT Readiness
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 'var(--rmg-spacing-04)',
        }}
      >
        {DIMENSIONS.map(({ key, label }) => {
          const score = byDimension.get(key)
          const status = statusFor(score?.score)
          return (
            <div
              key={key}
              style={{
                padding: 'var(--rmg-spacing-04)',
                backgroundColor: 'var(--rmg-color-surface-light)',
                borderRadius: 'var(--rmg-radius-s)',
              }}
            >
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
                {label}
              </div>
              <StatusPill status={status} />
              {score?.evidence &&
                score.evidence.trim() !== BASELINE_EVIDENCE && (
                  <p
                    style={{
                      margin: 0,
                      marginTop: 'var(--rmg-spacing-02)',
                      fontFamily: 'var(--rmg-font-body)',
                      fontSize: 'var(--rmg-text-c2)',
                      color: 'var(--rmg-color-text-light)',
                      lineHeight: 'var(--rmg-leading-c2)',
                    }}
                  >
                    {score.evidence}
                  </p>
                )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

type ReadinessStatus = 'Not started' | 'In progress' | 'Complete'

function statusFor(score?: 'RED' | 'AMBER' | 'GREEN'): ReadinessStatus {
  if (score === 'GREEN') return 'Complete'
  if (score === 'AMBER') return 'In progress'
  return 'Not started'
}

function StatusPill({ status }: { status: ReadinessStatus }) {
  const { bg, fg } = statusColours(status)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px var(--rmg-spacing-03)',
        backgroundColor: bg,
        color: fg,
        borderRadius: 'var(--rmg-radius-xl)',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 'var(--rmg-text-c2)',
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  )
}

function statusColours(status: ReadinessStatus): { bg: string; fg: string } {
  switch (status) {
    case 'Complete':
      return {
        bg: 'var(--rmg-color-tint-green)',
        fg: 'var(--rmg-color-green-contrast)',
      }
    case 'In progress':
      return {
        bg: 'rgba(243, 146, 13, 0.12)',
        fg: 'var(--rmg-color-orange)',
      }
    case 'Not started':
      return {
        bg: 'var(--rmg-color-grey-3)',
        fg: 'var(--rmg-color-text-light)',
      }
  }
}

function DomainFooterNav({
  prevDomain,
  nextDomain,
}: {
  prevDomain: { name: string; slug: string } | null
  nextDomain: { name: string; slug: string } | null
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 'var(--rmg-spacing-04)',
        marginTop: 'var(--rmg-spacing-08)',
        paddingTop: 'var(--rmg-spacing-06)',
        borderTop: '1px solid var(--rmg-color-grey-3)',
      }}
    >
      {prevDomain ? (
        <Link
          href={`/domains/${prevDomain.slug}`}
          style={{
            textDecoration: 'none',
            color: 'var(--rmg-color-text-body)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-c2)',
              color: 'var(--rmg-color-text-light)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 700,
            }}
          >
            ← Previous
          </span>
          <span
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-b2)',
              fontWeight: 700,
              marginTop: 2,
            }}
          >
            {prevDomain.name}
          </span>
        </Link>
      ) : (
        <span
          aria-disabled
          style={{ color: 'var(--rmg-color-grey-1)', fontSize: 'var(--rmg-text-c2)' }}
        >
          ← Previous
        </span>
      )}
      {nextDomain ? (
        <Link
          href={`/domains/${nextDomain.slug}`}
          style={{
            textDecoration: 'none',
            color: 'var(--rmg-color-text-body)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-c2)',
              color: 'var(--rmg-color-text-light)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 700,
            }}
          >
            Next →
          </span>
          <span
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-b2)',
              fontWeight: 700,
              marginTop: 2,
            }}
          >
            {nextDomain.name}
          </span>
        </Link>
      ) : (
        <span
          aria-disabled
          style={{ color: 'var(--rmg-color-grey-1)', fontSize: 'var(--rmg-text-c2)' }}
        >
          Next →
        </span>
      )}
    </div>
  )
}
