import { TesseraShell } from '@plato/ui/components/tessera'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type KtSession = {
  id: string
  session_name: string
  focus_area: string | null
  team: 'SERVICE' | 'SHARED'
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED'
  is_playback: boolean
  planned_date: string | null
  duration_hrs: number | null
  app_group_id: string | null
  tessera_app_groups: { group_number: number; group_name: string }[]
}

type AppGroup = {
  id: string
  group_number: number
  group_name: string
}

const TEAM_COLOR: Record<string, string> = {
  SERVICE: '#4a9eff',
  SHARED: '#9b59b6',
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  SCHEDULED: {
    bg: 'var(--rmg-color-grey-3)',
    fg: 'var(--rmg-color-text-light)',
    label: 'Scheduled',
  },
  COMPLETED: {
    bg: 'var(--rmg-color-tint-green)',
    fg: 'var(--rmg-color-green-contrast)',
    label: 'Completed',
  },
  CANCELLED: {
    bg: 'var(--rmg-color-tint-red)',
    fg: 'var(--rmg-color-red)',
    label: 'Cancelled',
  },
  RESCHEDULED: {
    bg: 'rgba(243, 146, 13, 0.12)',
    fg: 'var(--rmg-color-orange)',
    label: 'Rescheduled',
  },
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    group?: string
    team?: string
    status?: string
    playback?: string
  }>
}) {
  const filters = await searchParams
  const groupFilter = filters.group
  const teamFilter = filters.team
  const statusFilter = filters.status
  const playbackFilter = filters.playback

  const [sessionsRes, appGroupsRes, leadRes] = await Promise.all([
    supabase
      .from('tessera_kt_sessions')
      .select(
        'id, session_name, focus_area, team, status, is_playback, planned_date, duration_hrs, app_group_id, tessera_app_groups(group_number, group_name)',
      )
      .order('planned_date', { ascending: true }),
    supabase
      .from('tessera_app_groups')
      .select('id, group_number, group_name')
      .order('group_number'),
    supabase
      .from('tessera_kt_session_resources')
      .select('session_id, resources(resource_name)')
      .eq('role', 'LEAD'),
  ])

  const allSessions = (sessionsRes.data ?? []) as KtSession[]
  const appGroups = (appGroupsRes.data ?? []) as AppGroup[]

  type LeadRow = {
    session_id: string
    resources: { resource_name: string } | { resource_name: string }[] | null
  }
  const leadMap = new Map<string, string>()
  for (const row of (leadRes.data ?? []) as LeadRow[]) {
    const r = row.resources
    if (!r) continue
    const name = Array.isArray(r) ? r[0]?.resource_name : r.resource_name
    if (name) leadMap.set(row.session_id, name)
  }

  let sessions = allSessions
  if (groupFilter) {
    const gn = parseInt(groupFilter, 10)
    sessions = sessions.filter((s) => s.tessera_app_groups[0]?.group_number === gn)
  }
  if (teamFilter === 'SERVICE' || teamFilter === 'SHARED') {
    sessions = sessions.filter((s) => s.team === teamFilter)
  }
  if (
    statusFilter &&
    ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'].includes(statusFilter)
  ) {
    sessions = sessions.filter((s) => s.status === statusFilter)
  }
  if (playbackFilter === '1') {
    sessions = sessions.filter((s) => s.is_playback)
  } else if (playbackFilter === '0') {
    sessions = sessions.filter((s) => !s.is_playback)
  }

  function filterUrl(patch: Record<string, string | null>): string {
    const current: Record<string, string> = {}
    if (groupFilter) current.group = groupFilter
    if (teamFilter) current.team = teamFilter
    if (statusFilter) current.status = statusFilter
    if (playbackFilter) current.playback = playbackFilter
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) {
        delete current[k]
      } else {
        current[k] = v
      }
    }
    const params = new URLSearchParams(current)
    const s = params.toString()
    return s ? `/sessions?${s}` : '/sessions'
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 'var(--rmg-text-c2)',
    color: 'var(--rmg-color-text-light)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    flexShrink: 0,
  }

  return (
    <TesseraShell activeRoute="/sessions">
      <div
        style={{
          maxWidth: 1280,
          padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
        }}
      >
        <div style={{ marginBottom: 'var(--rmg-spacing-06)' }}>
          <h1
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h2)',
              lineHeight: 'var(--rmg-leading-h2)',
              color: 'var(--rmg-color-text-heading)',
              margin: 0,
            }}
          >
            KT Sessions
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
            125 sessions planned across 13 application groups · 1 Apr → 3 Jul 2026
          </p>
        </div>

        {/* Filter bar */}
        <div
          style={{
            backgroundColor: 'var(--rmg-color-surface-white)',
            borderRadius: 'var(--rmg-radius-m)',
            boxShadow: 'var(--rmg-shadow-card)',
            padding: 'var(--rmg-spacing-04) var(--rmg-spacing-05)',
            marginBottom: 'var(--rmg-spacing-05)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--rmg-spacing-04)',
            alignItems: 'center',
          }}
        >
          {/* Group */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--rmg-spacing-02)',
              flexWrap: 'wrap',
            }}
          >
            <span style={labelStyle}>Group</span>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <a href={filterUrl({ group: null })} style={pillStyle(!groupFilter)}>
                All
              </a>
              {appGroups.map((g) => (
                <a
                  key={g.id}
                  href={filterUrl({ group: String(g.group_number) })}
                  style={pillStyle(groupFilter === String(g.group_number))}
                >
                  G{g.group_number}
                </a>
              ))}
            </div>
          </div>

          {/* Team */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--rmg-spacing-02)' }}
          >
            <span style={labelStyle}>Team</span>
            <div style={{ display: 'flex', gap: 3 }}>
              <a href={filterUrl({ team: null })} style={pillStyle(!teamFilter)}>
                All
              </a>
              <a
                href={filterUrl({ team: 'SERVICE' })}
                style={pillStyle(teamFilter === 'SERVICE')}
              >
                Service
              </a>
              <a
                href={filterUrl({ team: 'SHARED' })}
                style={pillStyle(teamFilter === 'SHARED')}
              >
                Shared
              </a>
            </div>
          </div>

          {/* Status */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--rmg-spacing-02)' }}
          >
            <span style={labelStyle}>Status</span>
            <div style={{ display: 'flex', gap: 3 }}>
              <a href={filterUrl({ status: null })} style={pillStyle(!statusFilter)}>
                All
              </a>
              <a
                href={filterUrl({ status: 'SCHEDULED' })}
                style={pillStyle(statusFilter === 'SCHEDULED')}
              >
                Scheduled
              </a>
              <a
                href={filterUrl({ status: 'COMPLETED' })}
                style={pillStyle(statusFilter === 'COMPLETED')}
              >
                Completed
              </a>
              <a
                href={filterUrl({ status: 'CANCELLED' })}
                style={pillStyle(statusFilter === 'CANCELLED')}
              >
                Cancelled
              </a>
            </div>
          </div>

          {/* Playback */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--rmg-spacing-02)' }}
          >
            <span style={labelStyle}>Type</span>
            <div style={{ display: 'flex', gap: 3 }}>
              <a href={filterUrl({ playback: null })} style={pillStyle(!playbackFilter)}>
                All
              </a>
              <a
                href={filterUrl({ playback: '0' })}
                style={pillStyle(playbackFilter === '0')}
              >
                KT Only
              </a>
              <a
                href={filterUrl({ playback: '1' })}
                style={pillStyle(playbackFilter === '1')}
              >
                Playbacks
              </a>
            </div>
          </div>

          <span
            style={{
              marginLeft: 'auto',
              fontFamily: 'monospace',
              fontSize: 'var(--rmg-text-c2)',
              color: 'var(--rmg-color-text-light)',
              flexShrink: 0,
            }}
          >
            {sessions.length} result{sessions.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Session list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sessions.map((session) => {
            const lead = leadMap.get(session.id) ?? null
            const group = session.tessera_app_groups[0] ?? null
            const statusStyle =
              STATUS_STYLE[session.status] ?? STATUS_STYLE.SCHEDULED
            const borderColor = TEAM_COLOR[session.team] ?? 'var(--rmg-color-grey-3)'

            return (
              <div
                key={session.id}
                style={{
                  backgroundColor: 'var(--rmg-color-surface-white)',
                  borderRadius: 'var(--rmg-radius-s)',
                  boxShadow: 'var(--rmg-shadow-card)',
                  borderLeft: `4px solid ${borderColor}`,
                  padding: 'var(--rmg-spacing-04) var(--rmg-spacing-05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--rmg-spacing-04)',
                }}
              >
                {group && (
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'var(--rmg-color-text-light)',
                      backgroundColor: 'var(--rmg-color-grey-3)',
                      borderRadius: 'var(--rmg-radius-s)',
                      padding: '2px 6px',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    G{group.group_number}
                  </span>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--rmg-spacing-02)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--rmg-font-body)',
                        fontSize: 'var(--rmg-text-c1)',
                        fontWeight: 700,
                        color: 'var(--rmg-color-text-body)',
                      }}
                    >
                      {session.session_name}
                    </span>
                    {session.is_playback && (
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '9px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: 'var(--rmg-color-blue)',
                          backgroundColor: 'rgba(8, 146, 203, 0.12)',
                          borderRadius: 'var(--rmg-radius-s)',
                          padding: '1px 5px',
                          flexShrink: 0,
                        }}
                      >
                        Playback
                      </span>
                    )}
                  </div>
                  {session.focus_area && (
                    <div
                      style={{
                        fontFamily: 'var(--rmg-font-body)',
                        fontSize: 'var(--rmg-text-c2)',
                        color: 'var(--rmg-color-text-light)',
                        marginTop: 2,
                      }}
                    >
                      {session.focus_area}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--rmg-spacing-04)',
                    flexShrink: 0,
                  }}
                >
                  {lead && (
                    <span
                      style={{
                        fontFamily: 'var(--rmg-font-body)',
                        fontSize: 'var(--rmg-text-c2)',
                        color: 'var(--rmg-color-text-light)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {lead}
                    </span>
                  )}
                  {session.duration_hrs != null && (
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 'var(--rmg-text-c2)',
                        color: 'var(--rmg-color-text-light)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {session.duration_hrs} hrs
                    </span>
                  )}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px var(--rmg-spacing-03)',
                      backgroundColor: statusStyle.bg,
                      color: statusStyle.fg,
                      borderRadius: 'var(--rmg-radius-xl)',
                      fontFamily: 'monospace',
                      fontSize: '10px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {statusStyle.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </TesseraShell>
  )
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: 'var(--rmg-radius-xl)',
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 'var(--rmg-text-c2)',
    fontWeight: active ? 700 : 400,
    color: active ? 'var(--rmg-color-red)' : 'var(--rmg-color-text-body)',
    backgroundColor: active ? 'var(--rmg-color-tint-red)' : 'var(--rmg-color-grey-3)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  }
}
