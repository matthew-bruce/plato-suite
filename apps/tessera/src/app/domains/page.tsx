import Link from 'next/link'
import { TesseraShell } from '@plato/ui/components/tessera'
import { supabase } from '@/lib/supabase'
import { RiskPill } from '@/components/RiskPill'

export const dynamic = 'force-dynamic'

type Domain = {
  id: string
  name: string
  subtitle: string | null
  description: string | null
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW' | 'SCOPED' | null
  display_order: number
  slug: string
}

type RagScore = {
  domain_id: string
  dimension: string
  score: 'RED' | 'AMBER' | 'GREEN'
}

type ItineraryDay = {
  id: string
  date: string
  day_label: string
}

const TRIP_END = new Date('2026-05-01T23:59:59Z')

export default async function DomainsPage() {
  const [domainsRes, ragRes, itineraryRes] = await Promise.all([
    supabase.from('tessera_domains').select('*').order('display_order'),
    supabase.from('tessera_rag_scores').select('domain_id, dimension, score'),
    supabase.from('tessera_itinerary_days').select('*').order('date'),
  ])

  const domains = (domainsRes.data ?? []) as Domain[]
  const ragScores = (ragRes.data ?? []) as RagScore[]
  const itineraryDays = (itineraryRes.data ?? []) as ItineraryDay[]

  const firstDay = itineraryDays[0]
  const departureDate = firstDay ? new Date(firstDay.date + 'T00:00:00Z') : null

  return (
    <TesseraShell activeRoute="/domains">
      <div
        style={{
          maxWidth: 1280,
          padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
        }}
      >
        <HeaderRow
          departureDate={departureDate}
          itineraryDays={itineraryDays}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 'var(--rmg-spacing-05)',
            marginTop: 'var(--rmg-spacing-08)',
          }}
        >
          {domains.map((domain) => (
            <DomainCard
              key={domain.id}
              domain={domain}
              ragScores={ragScores.filter((r) => r.domain_id === domain.id)}
            />
          ))}
        </div>
      </div>
    </TesseraShell>
  )
}

function HeaderRow({
  departureDate,
  itineraryDays,
}: {
  departureDate: Date | null
  itineraryDays: ItineraryDay[]
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--rmg-spacing-05)',
        flexWrap: 'wrap',
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
          Knowledge Domains
        </h1>
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
          eBusiness Platform — 12 capability areas
        </p>
      </div>
      <CountdownBadge
        departureDate={departureDate}
        itineraryDays={itineraryDays}
      />
    </div>
  )
}

function CountdownBadge({
  departureDate,
  itineraryDays,
}: {
  departureDate: Date | null
  itineraryDays: ItineraryDay[]
}) {
  if (!departureDate) return null
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  let label: string
  let bgColor: string
  let fgColor: string

  if (today < departureDate) {
    const diffMs = departureDate.getTime() - today.getTime()
    const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    label =
      days === 0
        ? 'Departs today'
        : `${days} day${days === 1 ? '' : 's'} to India`
    bgColor = 'rgba(8, 146, 203, 0.12)'
    fgColor = 'var(--rmg-color-blue)'
  } else if (today <= TRIP_END) {
    const todayStr = today.toISOString().slice(0, 10)
    const currentDay =
      itineraryDays.find((d) => d.date === todayStr) ??
      itineraryDays[itineraryDays.length - 1]
    label = currentDay ? currentDay.day_label : 'In India'
    bgColor = 'var(--rmg-color-tint-green)'
    fgColor = 'var(--rmg-color-green-contrast)'
  } else {
    label = 'Trip complete'
    bgColor = 'var(--rmg-color-grey-4)'
    fgColor = 'var(--rmg-color-text-light)'
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `var(--rmg-spacing-02) var(--rmg-spacing-04)`,
        backgroundColor: bgColor,
        color: fgColor,
        borderRadius: 'var(--rmg-radius-xl)',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 'var(--rmg-text-c1)',
        lineHeight: 'var(--rmg-leading-c1)',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function DomainCard({
  domain,
  ragScores,
}: {
  domain: Domain
  ragScores: RagScore[]
}) {
  const assessedCount = ragScores.filter((r) => r.score !== 'RED').length
  const total = 6
  const pct = Math.min(100, (assessedCount / total) * 100)

  let fillColor = 'transparent'
  if (pct > 0) {
    if (pct <= 33) fillColor = 'var(--rmg-color-red)'
    else if (pct <= 66) fillColor = 'var(--rmg-color-orange)'
    else fillColor = 'var(--rmg-color-green-contrast)'
  }

  return (
    <Link
      href={`/domains/${domain.slug}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div
        style={{
          backgroundColor: 'var(--rmg-color-surface-white)',
          borderRadius: 'var(--rmg-radius-m)',
          boxShadow: 'var(--rmg-shadow-card)',
          padding: 'var(--rmg-spacing-06)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 120ms ease, box-shadow 120ms ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--rmg-spacing-03)',
            marginBottom: 'var(--rmg-spacing-02)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 'var(--rmg-text-c2)',
                color: 'var(--rmg-color-text-light)',
                letterSpacing: '0.05em',
              }}
            >
              {String(domain.display_order).padStart(2, '0')}
            </span>
            <h3
              style={{
                fontFamily: 'var(--rmg-font-display)',
                fontSize: 'var(--rmg-text-h7)',
                lineHeight: 'var(--rmg-leading-h7)',
                color: 'var(--rmg-color-text-heading)',
                margin: 0,
                marginTop: 2,
                fontWeight: 700,
              }}
            >
              {domain.name}
            </h3>
          </div>
          {domain.risk_level && <RiskPill risk={domain.risk_level} />}
        </div>
        {domain.subtitle && (
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-c1)',
              lineHeight: 'var(--rmg-leading-c1)',
              color: 'var(--rmg-color-text-light)',
              margin: 0,
              marginTop: 'var(--rmg-spacing-02)',
              flex: 1,
            }}
          >
            {domain.subtitle}
          </p>
        )}

        <div style={{ marginTop: 'var(--rmg-spacing-06)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 'var(--rmg-spacing-02)',
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
              KT Readiness
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 'var(--rmg-text-c2)',
                color: 'var(--rmg-color-text-light)',
              }}
            >
              {assessedCount} / {total} assessed
            </span>
          </div>
          <div
            style={{
              height: 4,
              backgroundColor: 'var(--rmg-color-grey-3)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            {pct > 0 && (
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: fillColor,
                  transition: 'width 200ms ease',
                }}
              />
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
