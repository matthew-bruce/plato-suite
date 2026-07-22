import Link from 'next/link'
import { AppGroupRow } from '@/components/AppGroupRow'
import { ManualStatusToggle } from '@/components/ManualStatusToggle'
import { ChipLegendInfo } from '@/components/ChipLegendInfo'
import { ChipPill } from '@/components/ChipPill'
import { getSupabaseServerComponentClient } from '@plato/schema/server'
import { CHIP_DESCRIPTIONS, type ChipKey } from '@/lib/chipLegend'

export const dynamic = 'force-dynamic'

const KT_START = new Date('2026-04-01T00:00:00Z')
const KT_END   = new Date('2026-07-03T23:59:59Z')

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
  score: 'RED' | 'AMBER' | 'GREEN' | 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'
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
  hasCG: boolean
  hasTCS: boolean
}

type DbDomainSession = {
  id: string
  status: string
  planned_date: string | null
  outcome_score: number | null
  is_playback: boolean | null
}

type SessionPeopleRow = {
  session_id: string
  has_cg: boolean
  has_tcs: boolean
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

  // PEOPLE — ≥1 CG + ≥1 TCS resource identified on every linked session = done; some = progress; none = none
  let people: ChipState = 'none'
  if (linked.length > 0) {
    const allIdentified = linked.every(s => s.hasCG && s.hasTCS)
    const someIdentified = linked.some(s => s.hasCG && s.hasTCS)
    people = allIdentified ? 'done' : someIdentified ? 'progress' : 'none'
  }

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

  // DEMO — all linked playback sessions COMPLETED = done; some = progress; none = none
  const playbackSessions = linked.filter(s => s.is_playback)
  let demo: ChipState = 'none'
  if (playbackSessions.length > 0) {
    const allDone = playbackSessions.every(s => s.status === 'COMPLETED')
    const someDone = playbackSessions.some(s => s.status === 'COMPLETED')
    demo = allDone ? 'done' : someDone ? 'progress' : 'none'
  }

  // DOCS and SIGN-OFF — manually set via ManualStatusToggle, read from tessera_rag_scores
  const docs: ChipState = manualChipState(ragScores, domainId, 'DOCUMENTATION')
  const signoff: ChipState = manualChipState(ragScores, domainId, 'SIGN_OFF')

  return { people, sessions, schedule, kt, demo, docs, signoff }
}

function manualChipState(ragScores: RagScore[], domainId: string, dimension: string): ChipState {
  const score = ragScores.find(r => r.domain_id === domainId && r.dimension === dimension)?.score
  if (score === 'DONE') return 'done'
  if (score === 'IN_PROGRESS') return 'progress'
  return 'none'
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function Home() {
  const supabase = await getSupabaseServerComponentClient()
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
    const [{ data: ds }, { data: sessionPeople }] = await Promise.all([
      supabase
        .from('tessera_kt_sessions')
        .select('id, status, planned_date, outcome_score, is_playback')
        .in('id', linkedSessionIds),
      supabase
        .from('tessera_kt_session_people')
        .select('session_id, has_cg, has_tcs')
        .in('session_id', linkedSessionIds),
    ])

    // Pre-aggregated in tessera_kt_session_people (one row per session), so
    // this is a direct 1:1 map rather than an accumulation across rows.
    const supplierFlagsBySession = new Map<string, { hasCG: boolean; hasTCS: boolean }>(
      ((sessionPeople ?? []) as SessionPeopleRow[]).map((row) => [
        row.session_id,
        { hasCG: row.has_cg, hasTCS: row.has_tcs },
      ]),
    )

    domainSessions = ((ds ?? []) as DbDomainSession[]).map((s) => ({
      ...s,
      hasCG: supplierFlagsBySession.get(s.id)?.hasCG ?? false,
      hasTCS: supplierFlagsBySession.get(s.id)?.hasTCS ?? false,
    }))
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
    <>
      <style>{`
        .pulse-tracks { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
        .pulse-tr { display: grid; grid-template-columns: 72px 1fr 44px 180px; align-items: center; gap: 10px; min-width: 0; }
        .pulse-tr-lbl { font-size: 10px; font-weight: 600; color: #666666; text-align: right; white-space: nowrap; }
        .pulse-tr-bar { height: 10px; background: #EEEEEE; border-radius: 100px; overflow: hidden; min-width: 0; }
        .pulse-tr-pct { font-size: 13px; font-weight: 700; text-align: right; white-space: nowrap; }
        .pulse-tr-detail { font-size: 10px; color: #666666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pulse-stats { display: flex; align-items: center; flex-wrap: wrap; border-top: 1px solid #EEEEEE; padding-top: 12px; }
        .ps-item { padding-right: 24px; margin-bottom: 4px; }
        .ps-div { width: 1px; height: 30px; background: #EEEEEE; margin-right: 24px; flex-shrink: 0; align-self: center; }
        .dom-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .grp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
        .ds-domain-card:hover { opacity: 0.92; }
        @media (max-width: 1200px) {
          .dom-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 900px) {
          .pulse-tr { grid-template-columns: 64px 1fr 40px; }
          .pulse-tr-detail { display: none; }
          .dom-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .pulse-tr { grid-template-columns: 56px 1fr 40px; }
          .pulse-tr-detail { display: none; }
          .pulse-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 0; }
          .ps-div { display: none; }
          .ps-item { padding-right: 0; }
          .dom-grid { grid-template-columns: repeat(2, 1fr); }
          .grp-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 520px) {
          .dom-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2A2A2D', letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0 }}>
            KT Programme Dashboard
          </h1>
          <p style={{ fontSize: 11, color: '#8F9495', marginTop: 4, fontWeight: 400, margin: '4px 0 0' }}>
            eBusiness Platform
            <span style={{ margin: '0 4px', opacity: 0.5 }}>·</span>
            CG → TCS transition
            <span style={{ margin: '0 4px', opacity: 0.5 }}>·</span>
            1 Apr — 3 Jul 2026
          </p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 20px', borderRadius: 100, background: '#DA202A', color: '#fff', fontFamily: 'var(--rmg-font-body)', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>
          Export
        </button>
      </div>

      {/* ── Programme Status Strip ── */}
      <div style={{ margin: '20px 28px 0', background: '#F5F5F5', borderRadius: 12, border: '1px solid #EEEEEE', padding: '16px 22px 14px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap', rowGap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#404044', whiteSpace: 'nowrap' }}>
            Programme Status
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, background: '#E4F2DF', fontSize: 11, fontWeight: 600, color: '#008A00', whiteSpace: 'nowrap' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#008A00', flexShrink: 0 }} />
            On track
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#666666', flexWrap: 'wrap' }}>
            <span>1 Apr 2026</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#2A2A2D', background: '#ffffff', border: '1px solid #EEEEEE', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
              Day {elapsedDays} of {totalDays}
            </span>
            <span>3 Jul 2026</span>
          </div>
        </div>

        {/* Three progress tracks */}
        <div className="pulse-tracks">
          <div className="pulse-tr">
            <div className="pulse-tr-lbl">Timeline</div>
            <div className="pulse-tr-bar">
              <div style={{ height: '100%', borderRadius: 100, width: `${timelinePct}%`, background: '#0892CB' }} />
            </div>
            <div className="pulse-tr-pct" style={{ color: '#0892CB' }}>{timelinePct}%</div>
            <div className="pulse-tr-detail">{elapsedDays} of {totalDays} days elapsed</div>
          </div>
          <div className="pulse-tr">
            <div className="pulse-tr-lbl">Sessions</div>
            <div className="pulse-tr-bar">
              <div style={{ height: '100%', borderRadius: 100, width: `${sessionsPct}%`, background: '#DA202A' }} />
            </div>
            <div className="pulse-tr-pct" style={{ color: '#DA202A' }}>{sessionsPct}%</div>
            <div className="pulse-tr-detail">{completedCount} of {plannedSessionsCount} delivered</div>
          </div>
          <div className="pulse-tr">
            <div className="pulse-tr-lbl">Hours</div>
            <div className="pulse-tr-bar">
              <div style={{ height: '100%', borderRadius: 100, width: `${hoursPct}%`, background: '#F3920D' }} />
            </div>
            <div className="pulse-tr-pct" style={{ color: '#F3920D' }}>{hoursPct}%</div>
            <div className="pulse-tr-detail">{Math.round(hoursDelivered)} of {plannedHours} hrs delivered</div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="pulse-stats">
          <div className="ps-item">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#DA202A' }}>{completedCount}</span>
              <span style={{ fontSize: 10, color: '#666666', whiteSpace: 'nowrap' }}>of {plannedSessionsCount} sessions</span>
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#404044', display: 'block', marginTop: 2 }}>Completed</span>
          </div>
          <div className="ps-div" />
          <div className="ps-item">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#F3920D' }}>{Math.round(hoursDelivered)}</span>
              <span style={{ fontSize: 10, color: '#666666', whiteSpace: 'nowrap' }}>of {plannedHours} hrs</span>
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#404044', display: 'block', marginTop: 2 }}>Hours delivered</span>
          </div>
          <div className="ps-div" />
          <div className="ps-item">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#2A2A2D' }}>{domains.length}</span>
              <span style={{ fontSize: 10, color: '#666666', whiteSpace: 'nowrap' }}>domains</span>
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#404044', display: 'block', marginTop: 2 }}>In programme</span>
          </div>
          <div className="ps-div" />
          <div className="ps-item">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#0892CB' }}>{Math.max(0, totalDays - elapsedDays)}</span>
              <span style={{ fontSize: 10, color: '#666666', whiteSpace: 'nowrap' }}>days</span>
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#404044', display: 'block', marginTop: 2 }}>Remaining</span>
          </div>
        </div>

      </div>

      {/* ── Main stacked content ── */}
      <div style={{ padding: '0 28px 48px' }}>

        {/* Domain Readiness heading */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 32, marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #DA202A' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#2A2A2D' }}>Domain Readiness</span>
            <ChipLegendInfo />
          </div>
          <span style={{ fontSize: 12, fontWeight: 400, color: '#8F9495' }}>{domains.length} domains</span>
        </div>

        {/* Domain grid */}
        <div className="dom-grid">
          {domains.map((domain) => (
            <DomainCard
              key={domain.id}
              domain={domain}
              chipStates={chipStatesByDomain.get(domain.id) ?? { people: 'none', sessions: 'none', schedule: 'none', kt: 'none', demo: 'none', docs: 'none', signoff: 'none' }}
              confidence={confidenceByDomain.get(domain.id) ?? null}
            />
          ))}
        </div>

        {/* Application Group heading */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 32, marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #DA202A' }}>
          <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#2A2A2D' }}>Application Group</span>
          <span style={{ fontSize: 12, fontWeight: 400, color: '#8F9495' }}>{appGroups.length} groups</span>
        </div>

        {/* App groups grid */}
        <div className="grp-grid">
          {appGroups.map((group) => {
            const completed = completedByGroup.get(group.id) ?? 0
            return (
              <AppGroupRow
                key={group.id}
                group={{
                  id: group.id,
                  name: group.group_name,
                  group_number: group.group_number,
                  is_active: group.is_active,
                }}
                completedCount={completed}
                totalCount={group.total_planned_sessions ?? 0}
              />
            )
          })}
        </div>

      </div>
  </>
  )
}

// ── Domain card — chips + confidence badge ─────────────────────────────────────

const DOMAIN_CHIPS: Array<{ label: string; key: string; manualDimension?: 'DOCUMENTATION' | 'SIGN_OFF' }> = [
  { label: 'PEOPLE',    key: 'people'   },
  { label: 'SESSIONS',  key: 'sessions' },
  { label: 'SCHEDULE',  key: 'schedule' },
  { label: 'OUTCOMES',  key: 'kt'       },
  { label: 'DEMO',      key: 'demo'     },
  { label: 'DOCS',      key: 'docs',     manualDimension: 'DOCUMENTATION' },
  { label: 'SIGN-OFF',  key: 'signoff',  manualDimension: 'SIGN_OFF' },
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
          border: '1px solid #E4E4E4',
          borderLeft: `3px solid ${confidence != null ? confidenceColour(confidence) : '#EEEEEE'}`,
          borderRadius: 8,
          padding: '12px 14px',
          position: 'relative',
          cursor: 'pointer',
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Confidence badge — top right */}
        <div style={{ position: 'absolute', top: 12, right: 12, textAlign: 'center' }}>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: confColour,
              lineHeight: 1,
            }}
          >
            {confDisplay}
          </div>
          <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8F9495', marginTop: 3, lineHeight: 1.3 }}>Confidence</div>
          <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8F9495', lineHeight: 1.3 }}>Score</div>
        </div>

        {/* Domain name */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#2A2A2D',
            marginBottom: 6,
            paddingRight: 84,
            lineHeight: 1.3,
          }}
        >
          {domain.name}
        </div>

        {/* Status + count */}
        <div style={{ fontSize: 11, fontWeight: 400, color: statusColour, marginBottom: 12 }}>
          {statusLabel} · {doneCount} / 7
        </div>

        {/* Dimension chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
          {DOMAIN_CHIPS.map(({ label, key, manualDimension }) => {
            const state = chipStates[key] as ChipState
            if (manualDimension) {
              return (
                <ManualStatusToggle
                  key={key}
                  domainId={domain.id}
                  dimension={manualDimension}
                  initialState={state}
                />
              )
            }
            return (
              <ChipPill
                key={key}
                state={state}
                label={label}
                title={CHIP_DESCRIPTIONS[key as ChipKey]}
              />
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
