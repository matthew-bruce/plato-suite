'use client'

import { useState, useMemo } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  TRACK_COLOURS,
  STATUS_COLOURS,
  getSupplierColour,
  type SupplierColourMap,
} from '@plato/ui/tokens'

export type ClientSession = {
  id: string
  session_name: string
  focus_area: string | null
  track: 'A' | 'B' | null
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED' | 'IN_PROGRESS'
  planned_date: string | null
  duration_hrs: number | null
  app_group_id: string | null
}

export type ClientAppGroup = {
  id: string
  group_number: number
  group_name: string
  category: string | null
  supplier_abbreviation: string | null
  total_planned_sessions: number
  total_planned_hours: number | null
}

type TrackFilter = 'A' | 'B' | null
type StatusFilter = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | null

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  RESCHEDULED: 'Rescheduled',
  IN_PROGRESS: 'In Progress',
}

function statusColour(status: string): string {
  if (status === 'COMPLETED') return STATUS_COLOURS.COMPLETED
  if (status === 'CANCELLED') return STATUS_COLOURS.CANCELLED
  if (status === 'IN_PROGRESS' || status === 'RESCHEDULED') return STATUS_COLOURS.IN_PROGRESS
  return STATUS_COLOURS.SCHEDULED
}

export function SessionsClient({
  sessions,
  appGroups,
  supplierMap,
  leadMap,
}: {
  sessions: ClientSession[]
  appGroups: ClientAppGroup[]
  supplierMap: SupplierColourMap
  leadMap: Record<string, string>
}) {
  const [search, setSearch] = useState('')
  const [trackFilter, setTrackFilter] = useState<TrackFilter>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  const filteredSessions = useMemo(() => {
    let result = sessions
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.session_name.toLowerCase().includes(q) ||
          (s.focus_area?.toLowerCase().includes(q) ?? false),
      )
    }
    if (trackFilter !== null) {
      result = result.filter((s) => s.track === trackFilter)
    }
    if (statusFilter !== null) {
      if (statusFilter === 'IN_PROGRESS') {
        result = result.filter(
          (s) => s.status === 'IN_PROGRESS' || s.status === 'RESCHEDULED',
        )
      } else {
        result = result.filter((s) => s.status === statusFilter)
      }
    }
    return result
  }, [sessions, search, trackFilter, statusFilter])

  // Group filtered sessions by app_group_id
  const sessionsByGroup = useMemo(() => {
    const map = new Map<string, ClientSession[]>()
    for (const s of filteredSessions) {
      const key = s.app_group_id ?? '__ungrouped__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return map
  }, [filteredSessions])

  // Completed count per group from ALL sessions (for accordion header progress)
  const completedByGroup = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions) {
      if (s.status === 'COMPLETED' && s.app_group_id) {
        map.set(s.app_group_id, (map.get(s.app_group_id) ?? 0) + 1)
      }
    }
    return map
  }, [sessions])

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const activeGroups = appGroups.filter(
    (g) => (sessionsByGroup.get(g.id)?.length ?? 0) > 0,
  )
  const ungroupedSessions = sessionsByGroup.get('__ungrouped__') ?? []

  return (
    <div>
      <style>{`
        .sessions-toggle { display: none; }
        .sessions-filter-groups {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          flex: 1;
          min-width: 0;
        }
        @media (max-width: 768px) {
          .sessions-toggle { display: inline-flex !important; }
          .sessions-filter-groups {
            display: none;
            flex-basis: 100%;
            margin-top: 8px;
          }
          .sessions-filter-groups.is-open { display: flex; }
        }
      `}</style>

      {/* Filter bar — Section 11 */}
      <div
        style={{
          backgroundColor: 'var(--rmg-color-surface-white)',
          border: '1px solid var(--rmg-color-grey-3)',
          borderRadius: 'var(--rmg-radius-m)',
          padding: '10px 20px',
          marginBottom: 'var(--rmg-spacing-05)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Search — always visible */}
        <input
          type="text"
          placeholder="Search sessions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 160,
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 14,
            color: 'var(--rmg-color-text-body)',
            background: 'transparent',
          }}
        />

        {/* Mobile filter toggle — CSS hides on desktop */}
        <button
          type="button"
          className="sessions-toggle"
          onClick={() => setFiltersOpen((o) => !o)}
          style={{
            display: 'none', // overridden by CSS media query on mobile
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            border: '2px solid var(--rmg-color-grey-2)',
            borderRadius: 'var(--rmg-radius-m)',
            background: 'transparent',
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--rmg-color-text-body)',
            cursor: 'pointer',
          }}
        >
          Filters
          <ChevronDown
            size={12}
            style={{
              transition: 'transform 150ms',
              transform: filtersOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}
          />
        </button>

        {/* Collapsible filter groups */}
        <div className={`sessions-filter-groups${filtersOpen ? ' is-open' : ''}`}>
          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 18,
              backgroundColor: 'var(--rmg-color-grey-2)',
              flexShrink: 0,
            }}
          />

          {/* Track filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'var(--rmg-color-grey-1)',
                flexShrink: 0,
              }}
            >
              Track
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <FilterPill active={trackFilter === null} onClick={() => setTrackFilter(null)}>
                All
              </FilterPill>
              <FilterPill active={trackFilter === 'A'} onClick={() => setTrackFilter('A')}>
                A
              </FilterPill>
              <FilterPill active={trackFilter === 'B'} onClick={() => setTrackFilter('B')}>
                B
              </FilterPill>
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 18,
              backgroundColor: 'var(--rmg-color-grey-2)',
              flexShrink: 0,
            }}
          />

          {/* Status filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'var(--rmg-color-grey-1)',
                flexShrink: 0,
              }}
            >
              Status
            </span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <FilterPill active={statusFilter === null} onClick={() => setStatusFilter(null)}>
                All
              </FilterPill>
              <FilterPill
                active={statusFilter === 'SCHEDULED'}
                onClick={() => setStatusFilter('SCHEDULED')}
              >
                Scheduled
              </FilterPill>
              <FilterPill
                active={statusFilter === 'IN_PROGRESS'}
                onClick={() => setStatusFilter('IN_PROGRESS')}
              >
                In Progress
              </FilterPill>
              <FilterPill
                active={statusFilter === 'COMPLETED'}
                onClick={() => setStatusFilter('COMPLETED')}
              >
                Completed
              </FilterPill>
              <FilterPill
                active={statusFilter === 'CANCELLED'}
                onClick={() => setStatusFilter('CANCELLED')}
              >
                Cancelled
              </FilterPill>
            </div>
          </div>

          {/* Result count */}
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: 'monospace',
              fontSize: 'var(--rmg-text-c2)',
              color: 'var(--rmg-color-text-light)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {filteredSessions.length} result{filteredSessions.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Empty state */}
      {filteredSessions.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            color: 'var(--rmg-color-grey-1)',
            fontSize: 14,
            fontFamily: 'var(--rmg-font-body)',
            padding: 'var(--rmg-spacing-10) 0',
          }}
        >
          No sessions match the current filters.
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--rmg-spacing-03)',
          }}
        >
          {/* App group accordions */}
          {activeGroups.map((group) => {
            const groupSessions = sessionsByGroup.get(group.id) ?? []
            const isOpen = openGroups.has(group.id)
            const supplierCol = getSupplierColour(
              group.supplier_abbreviation ?? '',
              supplierMap,
            )
            const completedCount = completedByGroup.get(group.id) ?? 0

            return (
              <div
                key={group.id}
                style={{
                  backgroundColor: 'var(--rmg-color-surface-white)',
                  borderRadius: 'var(--rmg-radius-m)',
                  boxShadow: 'var(--rmg-shadow-card)',
                  overflow: 'hidden',
                }}
              >
                {/* Accordion header — Section 14 */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 20px',
                    width: '100%',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    borderLeft: `4px solid ${supplierCol}`,
                    textAlign: 'left',
                  }}
                >
                  {/* Group ID chip */}
                  <div
                    style={{
                      fontFamily: 'var(--rmg-font-body)',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--rmg-color-grey-1)',
                      backgroundColor: 'var(--rmg-color-grey-4)',
                      borderRadius: 'var(--rmg-radius-xs)',
                      padding: '2px 7px',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    G{group.group_number}
                  </div>

                  {/* Group name + subtitle */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: 'var(--rmg-font-body)',
                        fontWeight: 700,
                        fontSize: 14,
                        color: 'var(--rmg-color-text-heading)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {group.group_name}
                    </div>
                    {group.category && (
                      <div
                        style={{
                          fontFamily: 'var(--rmg-font-body)',
                          fontSize: 12,
                          color: 'var(--rmg-color-text-light)',
                          marginTop: 2,
                        }}
                      >
                        {group.category}
                      </div>
                    )}
                  </div>

                  {/* Summary stats */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      style={{
                        fontFamily: 'var(--rmg-font-body)',
                        fontWeight: 700,
                        fontSize: 14,
                        color: 'var(--rmg-color-text-heading)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {completedCount}/{group.total_planned_sessions} sessions
                    </div>
                    {group.total_planned_hours != null && (
                      <div
                        style={{
                          fontFamily: 'var(--rmg-font-body)',
                          fontSize: 12,
                          color: 'var(--rmg-color-text-light)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {group.total_planned_hours} hrs
                      </div>
                    )}
                  </div>

                  {/* Chevron */}
                  <ChevronDown
                    size={16}
                    style={{
                      flexShrink: 0,
                      color: 'var(--rmg-color-grey-1)',
                      transition: 'transform 150ms',
                      transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                    }}
                  />
                </button>

                {/* Session rows */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--rmg-color-grey-3)' }}>
                    {groupSessions.map((session, idx) => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        leadName={leadMap[session.id] ?? null}
                        groupName={group.group_name}
                        isLast={idx === groupSessions.length - 1}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Ungrouped sessions (fallback) */}
          {ungroupedSessions.length > 0 && (
            <div
              style={{
                backgroundColor: 'var(--rmg-color-surface-white)',
                borderRadius: 'var(--rmg-radius-m)',
                boxShadow: 'var(--rmg-shadow-card)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 20px',
                  borderLeft: '4px solid var(--rmg-color-grey-2)',
                  fontFamily: 'var(--rmg-font-body)',
                  fontWeight: 700,
                  fontSize: 14,
                  color: 'var(--rmg-color-text-heading)',
                }}
              >
                Ungrouped
              </div>
              <div style={{ borderTop: '1px solid var(--rmg-color-grey-3)' }}>
                {ungroupedSessions.map((session, idx) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    leadName={leadMap[session.id] ?? null}
                    groupName={null}
                    isLast={idx === ungroupedSessions.length - 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Filter pill (Section 3D) ──────────────────────────────────────────────────

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 'var(--rmg-radius-xl)',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 'var(--rmg-text-c2)',
        fontWeight: active ? 600 : 400,
        border: active
          ? '1.5px solid var(--rmg-color-red)'
          : '1.5px solid var(--rmg-color-grey-2)',
        backgroundColor: active ? 'var(--rmg-color-tint-red)' : 'var(--rmg-color-white)',
        color: active ? 'var(--rmg-color-red)' : 'var(--rmg-color-text-body)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// ── Session row (Section 14) ──────────────────────────────────────────────────

function SessionRow({
  session,
  leadName,
  groupName,
  isLast,
}: {
  session: ClientSession
  leadName: string | null
  groupName: string | null
  isLast: boolean
}) {
  const trackCol =
    session.track != null ? TRACK_COLOURS[session.track] : null
  const statusBg = statusColour(session.status)
  const statusText = STATUS_LABEL[session.status] ?? session.status

  const subtitle = [
    groupName,
    session.duration_hrs != null ? `${session.duration_hrs} hrs` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 20px',
        borderBottom: isLast ? 'none' : '1px solid var(--rmg-color-grey-3)',
        cursor: 'pointer',
      }}
    >
      {/* Track indicator bar — 3px wide, full row height, Section 14 */}
      {trackCol !== null && (
        <div
          style={{
            width: 3,
            alignSelf: 'stretch',
            borderRadius: 100,
            backgroundColor: trackCol,
            flexShrink: 0,
          }}
        />
      )}

      {/* Session info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--rmg-color-text-heading)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {session.session_name}
        </div>
        {subtitle && (
          <div
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 12,
              color: 'var(--rmg-color-text-light)',
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* Lead name — plain text, Section 3F */}
      {leadName !== null && (
        <span
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 12,
            color: 'var(--rmg-color-grey-1)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {leadName}
        </span>
      )}

      {/* Duration — plain text, Section 3F */}
      {session.duration_hrs != null && (
        <span
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--rmg-color-text-body)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {session.duration_hrs}h
        </span>
      )}

      {/* Status badge — Section 3C: solid fill, STATUS_COLOURS, white text */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          backgroundColor: statusBg,
          color: 'var(--rmg-color-white)',
          borderRadius: 'var(--rmg-radius-xl)',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {statusText}
      </span>
    </div>
  )
}
