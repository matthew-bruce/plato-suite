import Link from 'next/link'
import { TesseraShell } from '@/components/TesseraShell'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const KT_START = new Date('2026-04-01T00:00:00Z')
const KT_END   = new Date('2026-07-03T23:59:59Z')
const INDIA_DEPARTURE = new Date('2026-04-26T00:00:00Z')

// ── Types ──────────────────────────────────────────────────────────────────────

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
  is_active: boolean
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
  dimension: string
  score: 'RED' | 'AMBER' | 'GREEN'
}

type DomainLink = {
  domain_id: string
  session_id: string
}

type DomainSession = {
  id: string
  status: string
  planned_date: string | null
  outcome_score: number | null
  is_playback: boolean | null
}

type ChipState = 'done' | 'progress' | 'none'

// ── Chip state derivation ──────────────────────────────────────────────────────

function getChipStates(
  domainId: string,
  ragScores: RagScore[],
  links: DomainLink[],
  domainSessions: DomainSession[],
): Record<string, ChipState> {
  const linkedIds = new Set(links.filter(l => l.domain_id === domainId).map(l => l.session_id))
  const linked = domainSessions.filter(s => linkedIds.has(s.id))

  // PEOPLE — from RAG score
  const peopleRag = ragScores.find(r => r.domain_id === domainId && r.dimension === 'PEOPLE')
  const people: ChipState = peopleRag?.score === 'GREEN' ? 'done' : peopleRag?.score === 'AMBER' ? 'progress' : 'none'

  // SESSIONS — ≥1 KT + ≥1 playback linked = done; any linked = progress; none = none
  let sessions: ChipState = 'none'
  if (linked.length > 0) {
    const hasKt = linked.some(s => !s.is_playback)
    const hasPlayback = linked.some(s => s.is_playback)
    sessions = (hasKt && hasPlayback) ? 'done' : 'progress'
  }

  // SCHEDULE — all have planned_date = done; some = progress; none = none
  let schedule: ChipState = 'none'
  if (linked.length > 0) {
    const allHaveDates = linked.every(s => s.planned_date != null)
    const someHaveDates = linked.some(s => s.planned_date != null)
    schedule = allHaveDates ? 'done' : someHaveDates ? 'progress' : 'none'
  }

  // KT — all sessions complete and/or have outcome_score = done; some = progress; none = none
  let kt: ChipState = 'none'
  if (linked.length > 0) {
    const allQualify = linked.every(s => s.status === 'COMPLETED' || s.outcome_score != null)
    const someQualify = linked.some(s => s.status === 'COMPLETED' || s.outcome_score != null)
    kt = allQualify ? 'done' : someQualify ? 'progress' : 'none'
  }

  // DEMO — binary: any is_playback COMPLETED session = done
  const demoSession = linked.find(s => s.is_playback && s.status === 'COMPLETED')
  const demo: ChipState = demoSession ? 'done' : 'none'

  // DOCS and SIGN-OFF — manually set (not yet built, always none)
  return { people, sessions, schedule, kt, demo, docs: 'none', signoff: 'none' }
}

// ── Group colours ──────────────────────────────────────────────────────────────

const GROUP_COLOURS: Record<number, string> = {
  0:  '#1A2B5B',
  1:  '#DA202A',
  2:  '#E2611A',
  3:  '#7C3AED',
  4:  '#0892CB',
  5:  '#008A00',
  6:  '#9B0A6E',
  7:  '#3ABFB8',
  8:  '#FF8C00',
  9:  '#3D3D3D',
  10: '#8F9495',
  11: '#1976F2',
  12: '#8F9495',
}

// ── RAG colour for app group progress bars ─────────────────────────────────────

function groupRagColour(pct: number): string {
  if (pct === 0) return '#D5D5D5'
  if (pct <= 32) return '#DA202A'
  if (pct <= 65) return '#F3920D'
  return '#008A00'
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function Home() {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)
  const nextWeek = new Date(today)
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7)
  const nextWeekStr = nextWeek.toISOString().slice(0, 10)

  const [sessionsRes, appGroupsRes, domainsRes, ragRes, domainLinksRes] = await Promise.all([
    supabase
      .from('tessera_kt_sessions')
      .select('id, status, duration_hrs, app_group_id, planned_date'),
    supabase
      .from('tessera_app_groups')
      .select(
        'id, group_number, group_name, category, is_active, total_planned_sessions, total_planned_hours',
      )
      .order('group_number'),
    supabase
      .from('tessera_domains')
      .select('id, name, slug, risk_level, display_order')
      .order('display_order'),
    supabase
      .from('tessera_rag_scores')
      .select('domain_id, dimension, score'),
    supabase
      .from('tessera_kt_session_domain_links')
      .select('domain_id, session_id'),
  ])

  const sessions    = (sessionsRes.data    ?? []) as KtSession[]
  const appGroups   = (appGroupsRes.data   ?? []) as AppGroup[]
  const domains     = (domainsRes.data     ?? []) as Domain[]
  const ragScores   = (ragRes.data         ?? []) as RagScore[]
  const domainLinks = (domainLinksRes.data ?? []) as DomainLink[]

  // Fetch sessions needed for domain chip derivation
  const linkedSessionIds = [...new Set(domainLinks.map(l => l.session_id))]
  let domainSessions: DomainSession[] = []
  if (linkedSessionIds.length > 0) {
    const { data: ds } = await supabase
      .from('tessera_kt_sessions')
      .select('id, status, planned_date, outcome_score, is_playback')
      .in('id', linkedSessionIds)
    domainSessions = (ds ?? []) as DomainSession[]
  }

  // ── Stat card calculations ──────────────────────────────────────────────────

  const groupActiveMap: Record<string, boolean> = {}
  for (const g of appGroups) groupActiveMap[g.id] = g.is_active

  const countedSessions = sessions.filter((s) => {
    if (s.status === 'CANCELLED') return false
    const parentActive = s.app_group_id ? (groupActiveMap[s.app_group_id] ?? true) : true
    if (!parentActive && s.status !== 'COMPLETED') return false
    return true
  })

  const plannedSessionsCount = countedSessions.length
  const rawPlannedHours = countedSessions.reduce((sum, s) => sum + (Number(s.duration_hrs) || 0), 0)
  const plannedHours = Number.isInteger(rawPlannedHours) ? rawPlannedHours : rawPlannedHours.toFixed(1)

  const completedSessions = sessions.filter((s) => s.status === 'COMPLETED')
  const completedCount    = completedSessions.length
  const hoursDelivered    = completedSessions.reduce((sum, s) => sum + (s.duration_hrs ?? 0), 0)

  const upcomingCount = sessions.filter(
    (s) =>
      s.planned_date != null &&
      s.planned_date >= todayStr &&
      s.planned_date <= nextWeekStr,
  ).length
  void upcomingCount

  const completedByGroup = new Map<string, number>()
  for (const s of completedSessions) {
    if (s.app_group_id) {
      completedByGroup.set(s.app_group_id, (completedByGroup.get(s.app_group_id) ?? 0) + 1)
    }
  }

  const sessionsPct = plannedSessionsCount > 0
    ? Math.round((completedCount / plannedSessionsCount) * 100)
    : 0
  const hoursPct = Number(plannedHours) > 0
    ? Math.round((Math.round(hoursDelivered) / Number(plannedHours)) * 100)
    : 0

  const totalDays = Math.round(
    (KT_END.getTime() - KT_START.getTime()) / (1000 * 60 * 60 * 24),
  )
  const elapsedDays = Math.max(
    0,
    Math.floor((today.getTime() - KT_START.getTime()) / (1000 * 60 * 60 * 24)),
  )
  const timelinePct = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)))

  const daysToIndia = Math.ceil(
    (INDIA_DEPARTURE.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )

  // ── Domain readiness: confidence badge + chip states ───────────────────────

  const confidenceByDomain = new Map<string, number | null>()
  const chipStatesByDomain  = new Map<string, Record<string, ChipState>>()

  for (const domain of domains) {
    // Confidence: avg outcome_score of COMPLETED sessions linked to this domain
    const domainLinkedIds = domainLinks
      .filter(l => l.domain_id === domain.id)
      .map(l => l.session_id)
    const completedWithScore = domainSessions.filter(
      s => domainLinkedIds.includes(s.id) && s.status === 'COMPLETED' && s.outcome_score != null,
    )
    if (completedWithScore.length === 0) {
      confidenceByDomain.set(domain.id, null)
    } else {
      const avg = completedWithScore.reduce((sum, s) => sum + s.outcome_score!, 0) / completedWithScore.length
      confidenceByDomain.set(domain.id, avg)
    }

    chipStatesByDomain.set(domain.id, getChipStates(domain.id, ragScores, domainLinks, domainSessions))
  }

  return (
    <TesseraShell activeRoute="/">
      <style>{`
        .ds-stat-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 22px;
        }
        .ds-domain-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
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

      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--rmg-color-surface-light)',
        }}
      >
        <div
          style={{
            width: '100%',
            padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
            boxSizing: 'border-box',
          }}
        >
          {/* ── Header ── */}
          <div style={{ marginBottom: 'var(--rmg-spacing-08)' }}>
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
              colour="#DA202A"
              number={String(completedCount)}
              subtext={`of ${plannedSessionsCount} non-cancelled`}
              pct={sessionsPct}
            />
            <StatCard
              label="Hours Delivered"
              colour="#F3920D"
              number={String(Math.round(hoursDelivered))}
              subtext={`of ${plannedHours} planned hours`}
              pct={hoursPct}
            />
            <StatCard
              label="KT Timeline"
              colour="#0892CB"
              number={String(elapsedDays)}
              subtext={`of ${totalDays} days elapsed`}
              pct={timelinePct}
            />
          </div>

          {/* ── Domain Readiness ── */}
          <div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#2A2A2D',
                display: 'inline-block',
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: '2px solid #DA202A',
                marginTop: 22,
              }}
            >
              Domain Readiness
            </span>
          </div>
          <div className="ds-domain-grid">
            {domains.map((d) => (
              <DomainCard
                key={d.id}
                domain={d}
                chipStates={chipStatesByDomain.get(d.id) ?? { people: 'none', sessions: 'none', schedule: 'none', kt: 'none', demo: 'none', docs: 'none', signoff: 'none' }}
                confidence={confidenceByDomain.get(d.id) ?? null}
              />
            ))}
          </div>

          {/* ── Application Group ── */}
          <div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#2A2A2D',
                display: 'inline-block',
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: '2px solid #DA202A',
                marginTop: 22,
              }}
            >
              Application Group
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
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

// ── Countdown chip (unchanged) ─────────────────────────────────────────────────

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

// ── Stat card — circle SVG ring design ────────────────────────────────────────

const CIRC = 138.2 // 2π × r=22

function StatCard({
  label,
  colour,
  number,
  subtext,
  pct,
}: {
  label: string
  colour: string
  number: string
  subtext: string
  pct: number
}) {
  const filled = (pct / 100) * CIRC
  const empty  = CIRC - filled

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 10,
        padding: '18px 18px 14px',
        borderTop: `4px solid ${colour}`,
        position: 'relative',
        minHeight: 116,
      }}
    >
      {/* Circle progress ring */}
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        style={{ position: 'absolute', top: 14, right: 14 }}
      >
        <circle cx="28" cy="28" r="22" fill="none" stroke="#EEEEEE" strokeWidth="6" />
        <circle
          cx="28"
          cy="28"
          r="22"
          fill="none"
          stroke={colour}
          strokeWidth="6"
          strokeDasharray={`${filled} ${empty}`}
          strokeLinecap="round"
          strokeDashoffset="34.5"
        />
        <text
          x="28"
          y="32"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill={colour}
        >
          {pct}%
        </text>
      </svg>

      {/* Label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#8F9495',
          paddingRight: 68,
          marginBottom: 6,
        }}
      >
        {label}
      </div>

      {/* Big number */}
      <div
        style={{
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: colour,
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {number}
      </div>

      {/* Subtext */}
      <div
        style={{
          fontSize: 12,
          color: '#8F9495',
          marginBottom: 12,
        }}
      >
        {subtext}
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 3,
          background: '#EEEEEE',
          borderRadius: 100,
        }}
      >
        {pct > 0 && (
          <div
            style={{
              height: 3,
              borderRadius: 100,
              width: `${pct}%`,
              background: colour,
            }}
          />
        )}
      </div>
    </div>
  )
}

// ── Domain card — chips + confidence badge ─────────────────────────────────────

const CHIP_DONE = { background: '#C1E3C1', color: '#1A6B00' }
const CHIP_PROG = { background: '#BEE0F5', color: '#005F8A' }
const CHIP_NONE = { background: '#EEEEEE', color: '#8F9495' }

const DOMAIN_CHIPS: Array<{ label: string; key: string }> = [
  { label: 'PEOPLE',    key: 'people'   },
  { label: 'SESSIONS',  key: 'sessions' },
  { label: 'SCHEDULE',  key: 'schedule' },
  { label: 'KT',        key: 'kt'       },
  { label: 'DEMO',      key: 'demo'     },
  { label: 'DOCS',      key: 'docs'     },
  { label: 'SIGN-OFF',  key: 'signoff'  },
]

function confidenceColour(score: number | null): string {
  if (score == null) return '#D5D5D5'
  if (score < 2.5)   return '#DA202A'
  if (score < 4.0)   return '#F3920D'
  return '#008A00'
}

function DomainCard({
  domain,
  chipStates,
  confidence,
}: {
  domain: Domain
  chipStates: Record<string, ChipState>
  confidence: number | null
}) {
  const doneCount  = DOMAIN_CHIPS.filter(c => chipStates[c.key] === 'done').length
  const progressPct = (doneCount / 7) * 100
  const barColour   = doneCount === 7 ? '#62A531' : '#0892CB'
  const confColour  = confidenceColour(confidence)
  const confDisplay = confidence == null ? '—' : confidence.toFixed(1)

  const statusColour = doneCount === 0 ? '#8F9495' : doneCount === 7 ? '#62A531' : '#0892CB'
  const statusLabel  = doneCount === 0 ? 'Not started' : doneCount === 7 ? 'Done' : 'In progress'

  return (
    <Link
      href={`/domains/${domain.slug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div
        className="ds-domain-card"
        style={{
          background: 'white',
          borderLeft: '3px solid #EEEEEE',
          borderRadius: 8,
          padding: '12px 14px',
          position: 'relative',
          cursor: 'pointer',
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Confidence badge — top right */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 14,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: confColour }}>
            {confDisplay}
          </span>
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#8F9495',
              letterSpacing: '0.05em',
              marginTop: 2,
            }}
          >
            Conf.
          </span>
        </div>

        {/* Domain name */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#2A2A2D',
            marginBottom: 6,
            paddingRight: 52,
            lineHeight: 1.3,
          }}
        >
          {domain.name}
        </div>

        {/* Status + count */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: statusColour }}>
            {statusLabel}
          </span>
          <span style={{ fontSize: 11, color: '#8F9495' }}>
            {doneCount} / 7
          </span>
        </div>

        {/* Dimension chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
          {DOMAIN_CHIPS.map(({ label, key }) => {
            const state = chipStates[key] as ChipState
            const cs = state === 'done' ? CHIP_DONE : state === 'progress' ? CHIP_PROG : CHIP_NONE
            return (
              <span
                key={key}
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '2px 5px',
                  borderRadius: 3,
                  background: cs.background,
                  color: cs.color,
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            )
          })}
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: '#EEEEEE', borderRadius: 100 }}>
          {progressPct > 0 && (
            <div
              style={{
                width: `${progressPct}%`,
                height: 3,
                borderRadius: 100,
                background: barColour,
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
  const total    = group.total_planned_sessions
  const pct      = total > 0 ? Math.min(100, Math.round((completedCount / total) * 100)) : 0
  const inactive = !group.is_active
  const ragColor = inactive ? '#D5D5D5' : groupRagColour(pct)
  const badgeBg  = GROUP_COLOURS[group.group_number] ?? '#8F9495'

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 'var(--rmg-radius-s)',
        boxShadow: 'var(--rmg-shadow-card)',
        display: 'grid',
        gridTemplateColumns: '26px 1fr 80px 36px',
        gap: 8,
        padding: '8px 12px',
        alignItems: 'center',
        opacity: inactive ? 0.4 : 1,
      }}
    >
      {/* Group badge */}
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          backgroundColor: badgeBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9,
          fontWeight: 700,
          color: '#ffffff',
          flexShrink: 0,
        }}
      >
        {group.group_number}
      </div>

      {/* Group name + progress bar */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#2A2A2D',
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {group.group_name}
        </div>
        <div
          style={{
            height: 3,
            background: '#EEEEEE',
            borderRadius: 100,
          }}
        >
          {!inactive && pct > 0 && (
            <div
              style={{
                width: `${pct}%`,
                height: 3,
                borderRadius: 100,
                background: ragColor,
              }}
            />
          )}
        </div>
      </div>

      {/* Session count */}
      <div
        style={{
          fontSize: 11,
          color: '#8F9495',
          whiteSpace: 'nowrap',
          textAlign: 'right',
        }}
      >
        {inactive ? '—' : `${completedCount} / ${total}`}
      </div>

      {/* Percentage */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: ragColor,
          whiteSpace: 'nowrap',
          textAlign: 'right',
        }}
      >
        {inactive ? '—' : `${pct}%`}
      </div>
    </div>
  )
}
