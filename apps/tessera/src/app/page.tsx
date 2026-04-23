import Link from 'next/link'
import { TesseraShell } from '@plato/ui/components/tessera'
import { supabase } from '@/lib/supabase'
import { RiskPill } from '@/components/RiskPill'

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

const RAG_ORDER = { RED: 3, AMBER: 2, GREEN: 1 } as const

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

  const ragByDomain = new Map<string, 'RED' | 'AMBER' | 'GREEN'>()
  for (const score of ragScores) {
    const current = ragByDomain.get(score.domain_id)
    if (!current || RAG_ORDER[score.score] > RAG_ORDER[current]) {
      ragByDomain.set(score.domain_id, score.score)
    }
  }

  return (
    <TesseraShell activeRoute="/">
      <div
        style={{
          maxWidth: 1280,
          padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 'var(--rmg-spacing-08)' }}>
          <h1
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h2)',
              lineHeight: 'var(--rmg-leading-h2)',
              color: 'var(--rmg-color-text-heading)',
              margin: 0,
            }}
          >
            KT Programme Dashboard
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
            eBusiness Platform — CG → TCS transition · 1 Apr → 3 Jul 2026
          </p>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--rmg-spacing-05)',
            marginBottom: 'var(--rmg-spacing-08)',
          }}
        >
          <StatCard
            label="Sessions"
            value={`${completedCount} of 125 completed`}
            barPct={(completedCount / 125) * 100}
            barColor="var(--rmg-color-green-contrast)"
          />
          <StatCard
            label="Hours"
            value={`${Math.round(hoursDelivered)} of 322 hrs delivered`}
            barPct={(hoursDelivered / 322) * 100}
            barColor="var(--rmg-color-blue)"
          />
          <TimelineCard pct={timelinePct} />
          <CountdownCard daysToIndia={daysToIndia} upcomingCount={upcomingCount} />
        </div>

        {/* Domain Readiness */}
        <SectionHeader
          title="Domain Readiness"
          linkHref="/domains"
          linkLabel="View all domains →"
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--rmg-spacing-04)',
            marginTop: 'var(--rmg-spacing-04)',
            marginBottom: 'var(--rmg-spacing-08)',
          }}
        >
          {domains.map((d) => (
            <DomainCompactCard
              key={d.id}
              domain={d}
              worstRag={ragByDomain.get(d.id) ?? null}
            />
          ))}
        </div>

        {/* App Group Progress */}
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
    </TesseraShell>
  )
}

function StatCard({
  label,
  value,
  barPct,
  barColor,
}: {
  label: string
  value: string
  barPct: number
  barColor: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: 'var(--rmg-spacing-05)',
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
      <div
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-b2)',
          color: 'var(--rmg-color-text-body)',
          fontWeight: 600,
          marginBottom: 'var(--rmg-spacing-03)',
          lineHeight: 'var(--rmg-leading-b2)',
        }}
      >
        {value}
      </div>
      <div
        style={{
          height: 4,
          backgroundColor: 'var(--rmg-color-grey-3)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, barPct)}%`,
            height: '100%',
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  )
}

function TimelineCard({ pct }: { pct: number }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: 'var(--rmg-spacing-05)',
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
        Timeline
      </div>
      <div
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-b2)',
          color: 'var(--rmg-color-text-body)',
          fontWeight: 600,
          marginBottom: 'var(--rmg-spacing-03)',
          lineHeight: 'var(--rmg-leading-b2)',
        }}
      >
        KT Window
      </div>
      <div style={{ position: 'relative', paddingBottom: 'var(--rmg-spacing-03)' }}>
        <div
          style={{
            height: 4,
            backgroundColor: 'var(--rmg-color-grey-3)',
            borderRadius: 2,
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              backgroundColor: 'var(--rmg-color-blue)',
              borderRadius: 2,
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            left: `${pct}%`,
            top: -3,
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: 'var(--rmg-color-blue)',
            transform: 'translateX(-50%)',
            border: '2px solid var(--rmg-color-surface-white)',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'monospace',
          fontSize: 'var(--rmg-text-c2)',
          color: 'var(--rmg-color-text-light)',
        }}
      >
        <span>1 Apr</span>
        <span>3 Jul</span>
      </div>
    </div>
  )
}

function CountdownCard({
  daysToIndia,
  upcomingCount,
}: {
  daysToIndia: number
  upcomingCount: number
}) {
  const label =
    daysToIndia > 0
      ? `${daysToIndia} day${daysToIndia === 1 ? '' : 's'} to India`
      : daysToIndia === 0
        ? 'Departs today'
        : 'India trip in progress'

  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: 'var(--rmg-spacing-05)',
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
          marginBottom: 'var(--rmg-spacing-03)',
        }}
      >
        Countdown
      </div>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: `var(--rmg-spacing-02) var(--rmg-spacing-04)`,
          backgroundColor: 'rgba(8, 146, 203, 0.12)',
          color: 'var(--rmg-color-blue)',
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
      <div
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c2)',
          color: 'var(--rmg-color-text-light)',
          marginTop: 'var(--rmg-spacing-03)',
        }}
      >
        {upcomingCount} session{upcomingCount === 1 ? '' : 's'} this week
      </div>
    </div>
  )
}

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

function DomainCompactCard({
  domain,
  worstRag,
}: {
  domain: Domain
  worstRag: 'RED' | 'AMBER' | 'GREEN' | null
}) {
  const ragColor =
    worstRag === 'RED'
      ? 'var(--rmg-color-red)'
      : worstRag === 'AMBER'
        ? 'var(--rmg-color-orange)'
        : worstRag === 'GREEN'
          ? 'var(--rmg-color-green-contrast)'
          : 'var(--rmg-color-grey-2)'

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
          padding: 'var(--rmg-spacing-04)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--rmg-spacing-02)',
          height: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--rmg-spacing-02)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-c1)',
              lineHeight: 'var(--rmg-leading-c1)',
              color: 'var(--rmg-color-text-heading)',
              fontWeight: 700,
              minWidth: 0,
              flex: 1,
            }}
          >
            {domain.name}
          </span>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: ragColor,
              flexShrink: 0,
              marginTop: 3,
            }}
          />
        </div>
        {domain.risk_level && <RiskPill risk={domain.risk_level} />}
      </div>
    </Link>
  )
}

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
        {group.total_planned_hours != null ? `${group.total_planned_hours} hrs` : '—'}
      </span>
    </div>
  )
}
