import Link from 'next/link'
import { TesseraShell } from '@plato/ui/components/tessera'
import { supabase } from '@/lib/supabase'
import { RISK_COLOURS } from '@plato/ui/tokens'

export const dynamic = 'force-dynamic'

const KT_START = new Date('2026-04-01T00:00:00Z')
const KT_END = new Date('2026-07-03T23:59:59Z')
const INDIA_DEPARTURE = new Date('2026-04-26T00:00:00Z')

type KtSession = {
  id: string
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED'
  duration_hrs: number | null
  app_group_id: string | null
  planned_date: string | null
}

type AppGroup = {
  id: string
  group_number: number
  group_name: string
  category: string | null
  total_planned_sessions: number
  total_planned_hours: number | null
}

type Domain = {
  id: string
  name: string
  slug: string
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW' | 'SCOPED' | null
  display_order: number
}

type RagScore = {
  domain_id: string
  score: 'RED' | 'AMBER' | 'GREEN'
}

export default async function Home() {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)
  const nextWeek = new Date(today)
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7)
  const nextWeekStr = nextWeek.toISOString().slice(0, 10)

  const [sessionsRes, appGroupsRes, domainsRes, ragRes] = await Promise.all([
    supabase
      .from('tessera_kt_sessions')
      .select('id, status, duration_hrs, app_group_id, planned_date'),
    supabase
      .from('tessera_app_groups')
      .select(
        'id, group_number, group_name, category, total_planned_sessions, total_planned_hours',
      )
      .order('group_number'),
    supabase
      .from('tessera_domains')
      .select('id, name, slug, risk_level, display_order')
      .order('display_order'),
    supabase.from('tessera_rag_scores').select('domain_id, score'),
  ])

  const sessions = (sessionsRes.data ?? []) as KtSession[]
  const appGroups = (appGroupsRes.data ?? []) as AppGroup[]
  const domains = (domainsRes.data ?? []) as Domain[]
  const ragScores = (ragRes.data ?? []) as RagScore[]

  const completedSessions = sessions.filter((s) => s.status === 'COMPLETED')
  const completedCount = completedSessions.length
  const hoursDelivered = completedSessions.reduce(
    (sum, s) => sum + (s.duration_hrs ?? 0),
    0,
  )
  const upcomingCount = sessions.filter(
    (s) =>
      s.planned_date != null &&
      s.planned_date >= todayStr &&
      s.planned_date <= nextWeekStr,
  ).length

  const completedByGroup = new Map<string, number>()
  for (const s of completedSessions) {
    if (s.app_group_id) {
      completedByGroup.set(
        s.app_group_id,
        (completedByGroup.get(s.app_group_id) ?? 0) + 1,
      )
    }
  }

  const timelinePct = Math.min(
    100,
    Math.max(
      0,
      ((today.getTime() - KT_START.getTime()) /
        (KT_END.getTime() - KT_START.getTime())) *
        100,
    ),
  )

  const daysToIndia = Math.ceil(
    (INDIA_DEPARTURE.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )

  // Count GREEN rag scores per domain (readiness out of 6 sub-areas)
  const readinessByDomain = new Map<string, number>()
  for (const score of ragScores) {
    if (score.score === 'GREEN') {
      readinessByDomain.set(
        score.domain_id,
        (readinessByDomain.get(score.domain_id) ?? 0) + 1,
      )
    }
  }

  return (
    <TesseraShell activeRoute="/">
      <style>{`
        .ds-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--rmg-spacing-05);
          margin-bottom: var(--rmg-spacing-08);
        }
        .ds-domain-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--rmg-spacing-04);
          margin-top: var(--rmg-spacing-04);
          margin-bottom: var(--rmg-spacing-08);
        }
        @media (max-width: 768px) {
          .ds-stat-grid   { grid-template-columns: repeat(2, 1fr); }
          .ds-domain-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 375px) {
          .ds-stat-grid   { grid-template-columns: 1fr; }
          .ds-domain-grid { grid-template-columns: 1fr; }
        }
        .ds-domain-card:hover { opacity: 0.92; }
      `}</style>

      {/* Page shell — surface-light + PLATO watermark */}
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--rmg-color-surface-light)',
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='240'%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='104' font-weight='700' fill='%232A2A2D' opacity='0.03' letter-spacing='0.12em'%3EPLATO%3C/text%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
          }}
        >
          {/* ── Header ── */}
          <div style={{ marginBottom: 'var(--rmg-spacing-08)' }}>
            {/* Eyebrow */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 'var(--rmg-spacing-02)',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'var(--rmg-color-green-contrast)',
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--rmg-color-grey-1)',
                }}
              >
                Pre-departure state (current)
              </span>
            </div>

            {/* Title row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--rmg-spacing-05)',
                flexWrap: 'wrap',
                marginBottom: 'var(--rmg-spacing-02)',
              }}
            >
              <h1
                style={{
                  fontFamily: 'var(--rmg-font-display)',
                  fontSize: '2rem',
                  fontWeight: 700,
                  color: 'var(--rmg-color-text-heading)',
                  letterSpacing: '-0.03em',
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                KT Programme Dashboard
              </h1>
              <CountdownChip daysToIndia={daysToIndia} />
            </div>

            {/* Subtitle */}
            <p
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 14,
                color: 'var(--rmg-color-text-light)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              eBusiness Platform · CG → TCS transition · 1 Apr → 3 Jul 2026
            </p>
          </div>

          {/* ── Stat cards ── */}
          <div className="ds-stat-grid">
            <StatCard
              label="Sessions Completed"
              number={String(completedCount)}
              subLabel="of 125 planned"
            />
            <StatCard
              label="Hours Delivered"
              number={String(Math.round(hoursDelivered))}
              subLabel="of 322 planned"
            />
            <StatCard
              label="KT Timeline"
              number={`${Math.round(timelinePct)}%`}
              subLabel="1 Apr → 3 Jul 2026"
            />
            <BrandMomentCard daysToIndia={daysToIndia} />
          </div>

          {/* ── Domain Readiness ── */}
          <SectionHeader
            title="Domain Readiness"
            linkHref="/domains"
            linkLabel="View all domains →"
          />
          <div className="ds-domain-grid">
            {domains.map((d) => (
              <DomainCard
                key={d.id}
                domain={d}
                readinessCount={readinessByDomain.get(d.id) ?? 0}
              />
            ))}
          </div>

          {/* ── App Group Progress ── */}
          <SectionHeader
            title="Application Group Progress"
            linkHref="/sessions"
            linkLabel="View all sessions →"
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--rmg-spacing-03)',
              marginTop: 'var(--rmg-spacing-04)',
            }}
          >
            {appGroups.map((g) => (
              <AppGroupRow
                key={g.id}
                group={g}
                completedCount={completedByGroup.get(g.id) ?? 0}
              />
            ))}
          </div>
        </div>
      </div>
    </TesseraShell>
  )
}

// ── Countdown chip (header, Section 8) ────────────────────────────────────────

function CountdownChip({ daysToIndia }: { daysToIndia: number }) {
  const label =
    daysToIndia > 0
      ? `${daysToIndia} DAY${daysToIndia === 1 ? '' : 'S'} TO DEPARTURE`
      : daysToIndia === 0
        ? 'DEPARTS TODAY'
        : 'IN INDIA'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '8px 20px',
        backgroundColor: 'var(--rmg-color-red)',
        color: 'var(--rmg-color-yellow)',
        borderRadius: 'var(--rmg-radius-m)',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 12,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

// ── Standard stat card (Section 10) ───────────────────────────────────────────

function StatCard({
  label,
  number,
  subLabel,
}: {
  label: string
  number: string
  subLabel: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: '20px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'var(--rmg-color-grey-1)',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--rmg-font-display)',
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--rmg-color-text-heading)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          marginBottom: 4,
        }}
      >
        {number}
      </div>
      <div
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 12,
          color: 'var(--rmg-color-grey-1)',
          marginBottom: 16,
        }}
      >
        {subLabel}
      </div>
      {/* Bottom accent bar — grey-3 default (no coloured accent unless data warrants) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: 'var(--rmg-color-grey-3)',
        }}
      />
    </div>
  )
}

// ── Brand-moment departure card (Section 10) ──────────────────────────────────

function BrandMomentCard({ daysToIndia }: { daysToIndia: number }) {
  const number =
    daysToIndia > 0 ? String(daysToIndia) : daysToIndia === 0 ? '0' : '✓'
  const label =
    daysToIndia > 0
      ? `Day${daysToIndia === 1 ? '' : 's'} to Departure`
      : daysToIndia === 0
        ? 'Departs Today'
        : 'In India'

  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-red)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: '20px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'rgba(253,218,36,0.75)', // --rmg-color-yellow at 75% opacity
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--rmg-font-display)',
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--rmg-color-yellow)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          marginBottom: 4,
        }}
      >
        {number}
      </div>
      <div
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 12,
          color: 'rgba(255,255,255,0.8)', // white at 80% opacity
          marginBottom: 16,
        }}
      >
        Sunday 26 April · Heathrow
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: 'var(--rmg-color-grey-3)',
        }}
      />
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  linkHref,
  linkLabel,
}: {
  title: string
  linkHref: string
  linkLabel: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--rmg-font-display)',
          fontSize: 'var(--rmg-text-h5)',
          lineHeight: 'var(--rmg-leading-h5)',
          color: 'var(--rmg-color-text-heading)',
          margin: 0,
          fontWeight: 700,
        }}
      >
        {title}
      </h2>
      <Link
        href={linkHref}
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c1)',
          color: 'var(--rmg-color-blue)',
          textDecoration: 'none',
        }}
      >
        {linkLabel}
      </Link>
    </div>
  )
}

// ── Domain card (Section 9) ────────────────────────────────────────────────────

function DomainCard({
  domain,
  readinessCount,
}: {
  domain: Domain
  readinessCount: number
}) {
  const riskColour =
    domain.risk_level != null
      ? RISK_COLOURS[domain.risk_level]
      : 'var(--rmg-color-grey-2)'
  const readinessPct = Math.min(100, (readinessCount / 6) * 100)

  return (
    <Link
      href={`/domains/${domain.slug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div
        className="ds-domain-card"
        style={{
          backgroundColor: 'var(--rmg-color-surface-white)',
          borderRadius: 'var(--rmg-radius-s)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          padding: 16,
          cursor: 'pointer',
          borderLeft: `4px solid ${riskColour}`,
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Domain name */}
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--rmg-color-text-heading)',
            marginBottom: 8,
            lineHeight: 1.3,
          }}
        >
          {domain.name}
        </div>

        {/* Badge row: risk badge left, readiness fraction right */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
            gap: 8,
          }}
        >
          {domain.risk_level != null ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                backgroundColor: riskColour,
                color: 'var(--rmg-color-white)',
                borderRadius: 'var(--rmg-radius-xs)',
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                whiteSpace: 'nowrap',
              }}
            >
              {domain.risk_level}
            </span>
          ) : (
            <span />
          )}
          <span
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 11,
              color: 'var(--rmg-color-grey-1)',
              whiteSpace: 'nowrap',
            }}
          >
            {readinessCount}/6
          </span>
        </div>

        {/* Readiness progress bar */}
        <div
          style={{
            height: 4,
            backgroundColor: 'var(--rmg-color-grey-3)',
            borderRadius: 100,
            overflow: 'hidden',
          }}
        >
          {readinessPct > 0 && (
            <div
              style={{
                width: `${readinessPct}%`,
                height: '100%',
                backgroundColor: riskColour,
              }}
            />
          )}
        </div>
      </div>
    </Link>
  )
}

// ── App group row ──────────────────────────────────────────────────────────────

function AppGroupRow({
  group,
  completedCount,
}: {
  group: AppGroup
  completedCount: number
}) {
  const total = group.total_planned_sessions
  const pct = total > 0 ? Math.min(100, (completedCount / total) * 100) : 0

  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-s)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: 'var(--rmg-spacing-04) var(--rmg-spacing-05)',
        display: 'grid',
        gridTemplateColumns: '220px 1fr 72px',
        gap: 'var(--rmg-spacing-05)',
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 'var(--rmg-text-c2)',
            color: 'var(--rmg-color-text-light)',
            marginRight: 'var(--rmg-spacing-02)',
          }}
        >
          G{group.group_number}
        </span>
        <span
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c1)',
            color: 'var(--rmg-color-text-body)',
            fontWeight: 600,
          }}
        >
          {group.group_name}
        </span>
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 'var(--rmg-text-c2)',
              color: 'var(--rmg-color-text-light)',
            }}
          >
            {completedCount} / {total} sessions
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
                backgroundColor: 'var(--rmg-color-green-contrast)',
              }}
            />
          )}
        </div>
      </div>

      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 'var(--rmg-text-c2)',
          color: 'var(--rmg-color-text-light)',
          whiteSpace: 'nowrap',
          textAlign: 'right',
        }}
      >
        {group.total_planned_hours != null
          ? `${group.total_planned_hours} hrs`
          : '—'}
      </span>
    </div>
  )
}
