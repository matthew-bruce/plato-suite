'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import type { AppGroup, KtSession, SessionLead } from '@/app/sessions/page'
import { TRACK_COLOURS, getSupplierColour } from '@plato/ui/tokens'
import { highlightMatch } from '@/lib/highlightMatch'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'progress' | 'calendar'
type ViewMode = 'by-group' | 'all'
type StatusFilter = 'ALL' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type TypeFilter = 'all' | 'kt' | 'playback'

type DetailResource = {
  role: string
  resource_name: string
  supplier_abbreviation: string | null
  supplier_colour: string | null
}

interface SessionsClientProps {
  groups: AppGroup[]
  sessions: KtSession[]
  sessionLeads: SessionLead[]
  supplierMap: Record<string, string>
  metricGroups: number
  metricSessions: number
  metricHours: string | number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusLabel(status: KtSession['status'] | string): string {
  const map: Record<string, string> = {
    SCHEDULED: 'Scheduled',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    IN_PROGRESS: 'In Progress',
    RESCHEDULED: 'In Progress',
  }
  return map[status] ?? status
}

function statusBadgeStyle(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'COMPLETED':
      return { bg: 'var(--rmg-color-tint-green)', fg: 'var(--rmg-color-green-contrast)' }
    case 'CANCELLED':
      return { bg: 'var(--rmg-color-tint-pink)', fg: 'var(--rmg-color-warm-red)' }
    case 'IN_PROGRESS':
    case 'RESCHEDULED':
      return { bg: 'var(--rmg-color-blue)', fg: 'var(--rmg-color-white)' }
    default:
      return { bg: 'var(--rmg-color-grey-3)', fg: 'var(--rmg-color-dark-grey)' }
  }
}

function matchesStatus(s: KtSession, f: StatusFilter): boolean {
  if (f === 'ALL') return true
  if (f === 'IN_PROGRESS') return s.status === 'IN_PROGRESS' || s.status === 'RESCHEDULED'
  return s.status === f
}

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const { bg, fg } = statusBadgeStyle(status)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 'var(--rmg-radius-xl)',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        backgroundColor: bg,
        color: fg,
      }}
    >
      {statusLabel(status)}
    </span>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
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
        fontSize: 12,
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

function SupplierChip({
  abbreviation,
  colour,
  name,
}: {
  abbreviation: string | null
  colour: string | null
  name: string
}) {
  const c = colour ?? 'var(--rmg-color-grey-1)'
  return (
    <span
      title={name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        borderRadius: 'var(--rmg-radius-xl)',
        padding: '2px 8px',
        border: `1.5px solid ${c}`,
        background: `${c}18`,
        color: c,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        fontFamily: 'var(--rmg-font-body)',
      }}
    >
      {abbreviation && (
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            backgroundColor: c,
            color: 'var(--rmg-color-white)',
            fontSize: 8,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {abbreviation.slice(0, 1)}
        </span>
      )}
      {name}
    </span>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function SessionsClient({
  groups,
  sessions,
  sessionLeads,
  supplierMap,
  metricGroups,
  metricSessions,
  metricHours,
}: SessionsClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('progress')
  const [viewMode, setViewMode] = useState<ViewMode>('by-group')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null

  function handleSelectSession(id: string) {
    setSelectedId((prev) => (prev === id ? null : id))
  }

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Build lead lookup for flat list and group session rows
  const leadMap = useMemo(() => {
    const m = new Map<string, SessionLead>()
    for (const l of sessionLeads) m.set(l.session_id, l)
    return m
  }, [sessionLeads])

  return (
    <>
      <style>{`
        .sessions-layout {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 24px;
          align-items: start;
          padding: var(--rmg-spacing-09) var(--rmg-spacing-07);
          box-sizing: border-box;
        }
        @media (max-width: 960px) {
          .sessions-layout { grid-template-columns: 1fr; }
          .sessions-detail-col { order: -1; }
        }
        @media (max-width: 640px) {
          .sessions-layout { padding: var(--rmg-spacing-05) var(--rmg-spacing-04); }
          .sessions-col-group,
          .sessions-col-lead,
          .sessions-col-date,
          .sessions-col-dur { display: none !important; }
        }
      `}</style>

      <div className="sessions-layout">
        {/* ── Left: main content ── */}
        <div style={{ minWidth: 0 }}>
          {/* Page header */}
          <div style={{ marginBottom: 'var(--rmg-spacing-05)' }}>
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
              Sessions
            </h1>
            <p
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 14,
                color: 'var(--rmg-color-text-light)',
                margin: '6px 0 0',
              }}
            >
              {metricGroups} application group{metricGroups === 1 ? '' : 's'} ·{' '}
              {metricSessions} session{metricSessions === 1 ? '' : 's'} · {metricHours} hrs
            </p>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 2,
              borderBottom: '1px solid var(--rmg-color-grey-3)',
              marginBottom: 'var(--rmg-spacing-04)',
            }}
          >
            {(['progress', 'calendar'] as TabId[]).map((t) => {
              const active = activeTab === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTab(t)}
                  style={{
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 14,
                    fontWeight: active ? 700 : 500,
                    color: active ? 'var(--rmg-color-red)' : 'var(--rmg-color-text-body)',
                    padding: '8px 16px',
                    borderBottom: active
                      ? '2px solid var(--rmg-color-red)'
                      : '2px solid transparent',
                    marginBottom: -1,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    outline: 'none',
                    textTransform: 'capitalize',
                  }}
                >
                  {t === 'progress' ? 'Progress' : 'Calendar'}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          {activeTab === 'progress' && (
            <ProgressView
              groups={groups}
              sessions={sessions}
              leadMap={leadMap}
              supplierMap={supplierMap}
              viewMode={viewMode}
              setViewMode={setViewMode}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              selectedId={selectedId}
              onSelectSession={handleSelectSession}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarView
              sessions={sessions}
              calYear={calYear}
              calMonth={calMonth}
              setCalYear={setCalYear}
              setCalMonth={setCalMonth}
              selectedId={selectedId}
              onSelectSession={handleSelectSession}
            />
          )}
        </div>

        {/* ── Right: detail panel ── */}
        <div className="sessions-detail-col" style={{ position: 'sticky', top: 20 }}>
          <DetailPanel
            session={selectedSession}
            groups={groups}
            supplierMap={supplierMap}
          />
        </div>
      </div>
    </>
  )
}

// ── Progress tab ──────────────────────────────────────────────────────────────

interface ProgressViewProps {
  groups: AppGroup[]
  sessions: KtSession[]
  leadMap: Map<string, SessionLead>
  supplierMap: Record<string, string>
  viewMode: ViewMode
  setViewMode: (m: ViewMode) => void
  search: string
  setSearch: (s: string) => void
  statusFilter: StatusFilter
  setStatusFilter: (f: StatusFilter) => void
  typeFilter: TypeFilter
  setTypeFilter: (f: TypeFilter) => void
  expandedGroups: Set<string>
  toggleGroup: (id: string) => void
  selectedId: string | null
  onSelectSession: (id: string) => void
}

function ProgressView({
  groups,
  sessions,
  leadMap,
  supplierMap,
  viewMode,
  setViewMode,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  expandedGroups,
  toggleGroup,
  selectedId,
  onSelectSession,
}: ProgressViewProps) {
  const headerLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--rmg-color-grey-1)',
    fontFamily: 'var(--rmg-font-body)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-03)' }}>
      {/* Filter bar + view toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '10px 20px',
          backgroundColor: 'var(--rmg-color-surface-white)',
          border: '1px solid var(--rmg-color-grey-3)',
          borderRadius: 'var(--rmg-radius-m)',
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--rmg-color-grey-1)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search sessions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 14,
              color: 'var(--rmg-color-text-body)',
              background: 'transparent',
            }}
          />
        </div>

        {/* Divider */}
        <div
          style={{ width: 1, height: 18, backgroundColor: 'var(--rmg-color-grey-2)', flexShrink: 0 }}
        />

        {/* Status filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ ...headerLabelStyle, flexShrink: 0 }}>Status</span>
          {(['ALL', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as StatusFilter[]).map(
            (v) => (
              <FilterPill key={v} active={statusFilter === v} onClick={() => setStatusFilter(v)}>
                {v === 'ALL'
                  ? 'All'
                  : v === 'IN_PROGRESS'
                    ? 'In Progress'
                    : v.charAt(0) + v.slice(1).toLowerCase()}
              </FilterPill>
            ),
          )}
        </div>

        {/* Type filter — only in All Sessions mode */}
        {viewMode === 'all' && (
          <>
            <div
              style={{
                width: 1,
                height: 18,
                backgroundColor: 'var(--rmg-color-grey-2)',
                flexShrink: 0,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ ...headerLabelStyle, flexShrink: 0 }}>Type</span>
              <FilterPill active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
                All
              </FilterPill>
              <FilterPill active={typeFilter === 'kt'} onClick={() => setTypeFilter('kt')}>
                KT Only
              </FilterPill>
              <FilterPill
                active={typeFilter === 'playback'}
                onClick={() => setTypeFilter('playback')}
              >
                Playbacks
              </FilterPill>
            </div>
          </>
        )}

        {/* View mode toggle — right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 0, flexShrink: 0 }}>
          {(['by-group', 'all'] as ViewMode[]).map((mode) => {
            const active = viewMode === mode
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '5px 14px',
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1.5px solid var(--rmg-color-red)',
                  backgroundColor: active ? 'var(--rmg-color-red)' : 'transparent',
                  color: active ? 'var(--rmg-color-white)' : 'var(--rmg-color-red)',
                  borderRadius:
                    mode === 'by-group'
                      ? 'var(--rmg-radius-xs) 0 0 var(--rmg-radius-xs)'
                      : '0 var(--rmg-radius-xs) var(--rmg-radius-xs) 0',
                  borderRight: mode === 'by-group' ? 'none' : '1.5px solid var(--rmg-color-red)',
                  whiteSpace: 'nowrap',
                }}
              >
                {mode === 'by-group' ? 'By Group' : 'All Sessions'}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      {viewMode === 'by-group' ? (
        <ByGroupView
          groups={groups}
          sessions={sessions}
          leadMap={leadMap}
          search={search}
          statusFilter={statusFilter}
          expandedGroups={expandedGroups}
          toggleGroup={toggleGroup}
          selectedId={selectedId}
          onSelectSession={onSelectSession}
        />
      ) : (
        <AllSessionsView
          groups={groups}
          sessions={sessions}
          leadMap={leadMap}
          supplierMap={supplierMap}
          search={search}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          selectedId={selectedId}
          onSelectSession={onSelectSession}
        />
      )}
    </div>
  )
}

// ── By Group view ─────────────────────────────────────────────────────────────

function ByGroupView({
  groups,
  sessions,
  leadMap,
  search,
  statusFilter,
  expandedGroups,
  toggleGroup,
  selectedId,
  onSelectSession,
}: {
  groups: AppGroup[]
  sessions: KtSession[]
  leadMap: Map<string, SessionLead>
  search: string
  statusFilter: StatusFilter
  expandedGroups: Set<string>
  toggleGroup: (id: string) => void
  selectedId: string | null
  onSelectSession: (id: string) => void
}) {
  const q = search.trim().toLowerCase()

  const visibleGroups = useMemo(() => {
    if (!q) return groups
    return groups.filter((g) => {
      if (g.group_name.toLowerCase().includes(q)) return true
      return sessions.some(
        (s) =>
          s.app_group_id === g.id &&
          s.session_name.toLowerCase().includes(q),
      )
    })
  }, [groups, sessions, q])

  if (visibleGroups.length === 0) {
    return (
      <div
        style={{
          marginTop: 60,
          textAlign: 'center',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 14,
          color: 'var(--rmg-color-grey-1)',
        }}
      >
        No groups match the current search.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {visibleGroups.map((g) => (
        <GroupCard
          key={g.id}
          group={g}
          sessions={sessions.filter((s) => s.app_group_id === g.id)}
          leadMap={leadMap}
          search={search}
          statusFilter={statusFilter}
          expanded={expandedGroups.has(g.id)}
          onToggle={() => toggleGroup(g.id)}
          selectedId={selectedId}
          onSelectSession={onSelectSession}
        />
      ))}
    </div>
  )
}

// ── Group card ────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  sessions,
  leadMap,
  search,
  statusFilter,
  expanded,
  onToggle,
  selectedId,
  onSelectSession,
}: {
  group: AppGroup
  sessions: KtSession[]
  leadMap: Map<string, SessionLead>
  search: string
  statusFilter: StatusFilter
  expanded: boolean
  onToggle: () => void
  selectedId: string | null
  onSelectSession: (id: string) => void
}) {
  const [headerHovered, setHeaderHovered] = useState(false)
  const q = search.trim().toLowerCase()

  const activePlanned = sessions.filter((s) => s.status !== 'CANCELLED')
  const completed = sessions.filter((s) => s.status === 'COMPLETED')
  const activePlannedHoursRaw = activePlanned.reduce(
    (sum, s) => sum + (Number(s.duration_hrs) || 0),
    0,
  )
  const activePlannedHours = Number.isInteger(activePlannedHoursRaw)
    ? activePlannedHoursRaw
    : activePlannedHoursRaw.toFixed(1)
  const pct =
    activePlanned.length > 0
      ? Math.round((completed.length / activePlanned.length) * 100)
      : 0

  // Sessions to show when expanded
  const displaySessions = useMemo(() => {
    let result = sessions.filter((s) => matchesStatus(s, statusFilter))
    if (q) {
      result = result.filter((s) => s.session_name.toLowerCase().includes(q))
    }
    return result
  }, [sessions, statusFilter, q])

  const hasNoMatches = q.length > 0 && displaySessions.length === 0

  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        overflow: 'hidden',
        opacity: hasNoMatches ? 0.35 : 1,
        transition: 'opacity 150ms ease',
      }}
    >
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onToggle()
        }}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 20px',
          cursor: 'pointer',
          outline: 'none',
          ...(group.is_active
            ? {
                backgroundColor: headerHovered ? 'var(--rmg-color-grey-4)' : 'var(--rmg-color-white)',
                borderLeft: '3px solid var(--rmg-color-red)',
              }
            : {
                backgroundColor: headerHovered ? '#EBEBEB' : 'var(--rmg-color-grey-4)',
              }),
        }}
      >
        {/* Group number badge */}
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 11,
            fontWeight: 700,
            color: group.is_active ? 'var(--rmg-color-white)' : 'var(--rmg-color-grey-1)',
            backgroundColor: group.is_active ? 'var(--rmg-color-red)' : 'var(--rmg-color-grey-3)',
            borderRadius: 'var(--rmg-radius-xs)',
            padding: '2px 6px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          G{String(group.group_number).padStart(2, '0')}
        </span>

        {/* Inactive badge */}
        {!group.is_active && (
          <span
            style={{
              backgroundColor: 'var(--rmg-color-grey-3)',
              color: 'var(--rmg-color-dark-grey)',
              fontSize: 11,
              borderRadius: 'var(--rmg-radius-xs)',
              padding: '2px 8px',
              fontFamily: 'var(--rmg-font-body)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Inactive
          </span>
        )}

        {/* Name + category */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: group.is_active
                ? 'var(--rmg-color-text-heading)'
                : 'var(--rmg-color-grey-1)',
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
                fontSize: 12,
                color: 'var(--rmg-color-text-light)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {group.category}
            </div>
          )}
        </div>

        {/* Right: stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--rmg-color-text-heading)',
                whiteSpace: 'nowrap',
              }}
            >
              {completed.length}/{activePlanned.length} sessions
            </div>
            <div
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 12,
                color: 'var(--rmg-color-text-light)',
                whiteSpace: 'nowrap',
              }}
            >
              {activePlannedHours} hrs
            </div>
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: 60,
              height: 4,
              borderRadius: 100,
              backgroundColor: 'var(--rmg-color-grey-3)',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                backgroundColor: 'var(--rmg-color-red)',
                borderRadius: 100,
              }}
            />
          </div>

          {/* Chevron */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              color: 'var(--rmg-color-grey-1)',
              fontSize: 10,
              transition: 'transform 200ms ease',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {/* Session list */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--rmg-color-grey-3)' }}>
          {displaySessions.length === 0 ? (
            <div
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 12,
                color: 'var(--rmg-color-grey-1)',
                textAlign: 'center',
                padding: 'var(--rmg-spacing-04) 0',
              }}
            >
              No sessions match the current filters.
            </div>
          ) : (
            displaySessions.map((s, i) => (
              <GroupSessionRow
                key={s.id}
                session={s}
                lead={leadMap.get(s.id) ?? null}
                rowIndex={i}
                selected={selectedId === s.id}
                onSelect={onSelectSession}
                search={search}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Session row inside a group ────────────────────────────────────────────────

function GroupSessionRow({
  session,
  lead,
  rowIndex,
  selected,
  onSelect,
  search,
}: {
  session: KtSession
  lead: SessionLead | null
  rowIndex: number
  selected: boolean
  onSelect: (id: string) => void
  search: string
}) {
  const [hovered, setHovered] = useState(false)
  const zebraBg = rowIndex % 2 === 0 ? 'var(--rmg-color-white)' : 'var(--rmg-color-grey-4)'
  const trackColour = session.track ? TRACK_COLOURS[session.track] : 'var(--rmg-color-grey-3)'

  let bg = zebraBg
  if (selected) bg = 'var(--rmg-color-tint-red)'
  else if (hovered) bg = 'var(--rmg-color-grey-4)'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(session.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(session.id)
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 20px',
        borderBottom: '1px solid var(--rmg-color-grey-3)',
        backgroundColor: bg,
        cursor: 'pointer',
        outline: 'none',
        borderLeft: selected ? '3px solid var(--rmg-color-red)' : '3px solid transparent',
      }}
    >
      {/* Track bar */}
      <div
        style={{
          width: 3,
          alignSelf: 'stretch',
          borderRadius: 100,
          backgroundColor: trackColour,
          flexShrink: 0,
        }}
      />

      {/* Title + type */}
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
          {highlightMatch(session.session_name, search)}
        </div>
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 12,
            color: 'var(--rmg-color-text-light)',
            marginTop: 2,
          }}
        >
          {session.is_playback ? 'Playback' : 'KT Only'}
          {session.duration_hrs != null ? ` · ${session.duration_hrs} hrs` : ''}
        </div>
      </div>

      {/* Lead */}
      {lead && (
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 12,
            color: 'var(--rmg-color-grey-1)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {lead.resource_name}
        </div>
      )}

      {/* Duration */}
      <div
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--rmg-color-text-body)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          minWidth: 32,
          textAlign: 'right',
        }}
      >
        {session.duration_hrs != null ? `${session.duration_hrs}h` : '—'}
      </div>

      {/* Status badge */}
      <StatusBadge status={session.status} />
    </div>
  )
}

// ── All Sessions flat list ────────────────────────────────────────────────────

function AllSessionsView({
  groups,
  sessions,
  leadMap,
  supplierMap,
  search,
  statusFilter,
  typeFilter,
  selectedId,
  onSelectSession,
}: {
  groups: AppGroup[]
  sessions: KtSession[]
  leadMap: Map<string, SessionLead>
  supplierMap: Record<string, string>
  search: string
  statusFilter: StatusFilter
  typeFilter: TypeFilter
  selectedId: string | null
  onSelectSession: (id: string) => void
}) {
  const groupMap = useMemo(
    () => new Map(groups.map((g) => [g.id, g])),
    [groups],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let result = sessions

    if (q) {
      result = result.filter((s) => {
        const group = s.app_group_id ? groupMap.get(s.app_group_id) : undefined
        return (
          s.session_name.toLowerCase().includes(q) ||
          (group?.group_name.toLowerCase().includes(q) ?? false)
        )
      })
    }
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'IN_PROGRESS') {
        result = result.filter(
          (s) => s.status === 'IN_PROGRESS' || s.status === 'RESCHEDULED',
        )
      } else {
        result = result.filter((s) => s.status === statusFilter)
      }
    }
    if (typeFilter === 'kt') result = result.filter((s) => !s.is_playback)
    if (typeFilter === 'playback') result = result.filter((s) => s.is_playback)

    return result
  }, [sessions, search, statusFilter, typeFilter, groupMap])

  const headerCell: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--rmg-color-grey-1)',
    fontFamily: 'var(--rmg-font-body)',
    padding: '10px 12px',
  }

  if (filtered.length === 0) {
    return (
      <div
        style={{
          marginTop: 60,
          textAlign: 'center',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 14,
          color: 'var(--rmg-color-grey-1)',
        }}
      >
        No sessions match the current filters.
      </div>
    )
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 90px 160px 110px 56px 110px',
          backgroundColor: 'var(--rmg-color-grey-4)',
          borderBottom: '1px solid var(--rmg-color-grey-3)',
        }}
      >
        <div style={{ ...headerCell, paddingLeft: 20 }}>Session</div>
        <div className="sessions-col-group" style={headerCell}>
          Group
        </div>
        <div className="sessions-col-lead" style={headerCell}>
          Lead
        </div>
        <div className="sessions-col-date" style={headerCell}>
          Date
        </div>
        <div className="sessions-col-dur" style={{ ...headerCell, textAlign: 'right' }}>
          Dur.
        </div>
        <div style={headerCell}>Status</div>
      </div>

      {/* Rows */}
      {filtered.map((session, idx) => {
        const group = session.app_group_id ? groupMap.get(session.app_group_id) : undefined
        const lead = leadMap.get(session.id) ?? null
        const leadColour = lead?.supplier_colour
          ? getSupplierColour(lead.supplier_abbreviation ?? '', supplierMap) || lead.supplier_colour
          : null

        const selected = selectedId === session.id

        return (
          <FlatSessionRow
            key={session.id}
            session={session}
            group={group}
            lead={lead}
            leadColour={leadColour}
            rowIndex={idx}
            isLast={idx === filtered.length - 1}
            selected={selected}
            onSelect={onSelectSession}
            search={search}
          />
        )
      })}
    </div>
  )
}

function FlatSessionRow({
  session,
  group,
  lead,
  leadColour,
  rowIndex,
  isLast,
  selected,
  onSelect,
  search,
}: {
  session: KtSession
  group: AppGroup | undefined
  lead: SessionLead | null
  leadColour: string | null
  rowIndex: number
  isLast: boolean
  selected: boolean
  onSelect: (id: string) => void
  search: string
}) {
  const [hovered, setHovered] = useState(false)
  const zebraBg = rowIndex % 2 === 0 ? 'var(--rmg-color-white)' : 'var(--rmg-color-grey-4)'

  let bg = zebraBg
  if (selected) bg = 'var(--rmg-color-tint-red)'
  else if (hovered) bg = 'var(--rmg-color-grey-4)'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(session.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(session.id)
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 90px 160px 110px 56px 110px',
        alignItems: 'center',
        borderBottom: isLast ? 'none' : '1px solid var(--rmg-color-grey-3)',
        backgroundColor: bg,
        cursor: 'pointer',
        outline: 'none',
        borderLeft: selected ? '3px solid var(--rmg-color-red)' : '3px solid transparent',
      }}
    >
      {/* Session name + group subtitle */}
      <div style={{ padding: '12px 12px 12px 17px' }}>
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--rmg-color-text-heading)',
            lineHeight: 1.3,
          }}
        >
          {highlightMatch(session.session_name, search)}
        </div>
        {group && (
          <div
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 12,
              color: 'var(--rmg-color-text-light)',
              marginTop: 2,
            }}
          >
            {highlightMatch(group.group_name, search)}
          </div>
        )}
      </div>

      {/* Group badge */}
      <div
        className="sessions-col-group"
        style={{ padding: '12px', display: 'flex', alignItems: 'center' }}
      >
        {group && (
          <span
            style={{
              backgroundColor: 'var(--rmg-color-grey-4)',
              color: 'var(--rmg-color-grey-1)',
              borderRadius: 'var(--rmg-radius-xs)',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 7px',
              fontFamily: 'var(--rmg-font-body)',
              whiteSpace: 'nowrap',
            }}
          >
            G{String(group.group_number).padStart(2, '0')}
          </span>
        )}
      </div>

      {/* Lead chip */}
      <div
        className="sessions-col-lead"
        style={{ padding: '12px', display: 'flex', alignItems: 'center' }}
      >
        {lead && (
          <SupplierChip
            abbreviation={lead.supplier_abbreviation}
            colour={leadColour}
            name={lead.resource_name}
          />
        )}
      </div>

      {/* Date */}
      <div
        className="sessions-col-date"
        style={{
          padding: '12px',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 12,
          color: session.planned_date ? 'var(--rmg-color-text-body)' : 'var(--rmg-color-grey-1)',
          whiteSpace: 'nowrap',
        }}
      >
        {session.planned_date ? formatDateShort(session.planned_date) : '—'}
      </div>

      {/* Duration */}
      <div
        className="sessions-col-dur"
        style={{
          padding: '12px',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--rmg-color-text-body)',
          whiteSpace: 'nowrap',
          textAlign: 'right',
        }}
      >
        {session.duration_hrs != null ? `${session.duration_hrs}h` : '—'}
      </div>

      {/* Status badge */}
      <div style={{ padding: '12px' }}>
        <StatusBadge status={session.status} />
      </div>
    </div>
  )
}

// ── Calendar view ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function CalendarView({
  sessions,
  calYear,
  calMonth,
  setCalYear,
  setCalMonth,
  selectedId,
  onSelectSession,
}: {
  sessions: KtSession[]
  calYear: number
  calMonth: number
  setCalYear: (y: number) => void
  setCalMonth: (m: number) => void
  selectedId: string | null
  onSelectSession: (id: string) => void
}) {
  const today = todayStr()

  function prevMonth() {
    if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11) }
    else setCalMonth(calMonth - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0) }
    else setCalMonth(calMonth + 1)
  }

  // Group sessions by date
  const byDate = useMemo(() => {
    const m = new Map<string, KtSession[]>()
    for (const s of sessions) {
      if (!s.planned_date) continue
      const d = s.planned_date.slice(0, 10)
      if (!m.has(d)) m.set(d, [])
      m.get(d)!.push(s)
    }
    return m
  }, [sessions])

  // Calendar geometry
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDow = ((new Date(calYear, calMonth, 1).getDay() + 6) % 7) // Mon=0
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7

  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        overflow: 'hidden',
      }}
    >
      {/* Month navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--rmg-color-grey-3)',
        }}
      >
        <button
          type="button"
          onClick={prevMonth}
          style={{
            background: 'none',
            border: '1.5px solid var(--rmg-color-grey-2)',
            borderRadius: 'var(--rmg-radius-xs)',
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: 14,
            color: 'var(--rmg-color-text-body)',
            fontFamily: 'var(--rmg-font-body)',
          }}
        >
          ←
        </button>
        <span
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--rmg-color-text-heading)',
          }}
        >
          {MONTH_NAMES[calMonth]} {calYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          style={{
            background: 'none',
            border: '1.5px solid var(--rmg-color-grey-2)',
            borderRadius: 'var(--rmg-radius-xs)',
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: 14,
            color: 'var(--rmg-color-text-body)',
            fontFamily: 'var(--rmg-font-body)',
          }}
        >
          →
        </button>
      </div>

      {/* Day headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid var(--rmg-color-grey-3)',
          backgroundColor: 'var(--rmg-color-grey-4)',
        }}
      >
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            style={{
              textAlign: 'center',
              padding: '8px 4px',
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--rmg-color-grey-1)',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
        }}
      >
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - firstDow + 1
          if (dayNum < 1 || dayNum > daysInMonth) {
            return (
              <div
                key={idx}
                style={{
                  minHeight: 88,
                  borderRight: '1px solid var(--rmg-color-grey-3)',
                  borderBottom: '1px solid var(--rmg-color-grey-3)',
                  backgroundColor: 'var(--rmg-color-grey-4)',
                  opacity: 0.5,
                }}
              />
            )
          }

          const y = String(calYear)
          const mo = String(calMonth + 1).padStart(2, '0')
          const d = String(dayNum).padStart(2, '0')
          const dateStr = `${y}-${mo}-${d}`
          const daySessions = byDate.get(dateStr) ?? []
          const isToday = dateStr === today
          const isPast = dateStr < today
          const hasCompleted = daySessions.some((s) => s.status === 'COMPLETED')

          return (
            <DayCell
              key={idx}
              dayNum={dayNum}
              dateStr={dateStr}
              sessions={daySessions}
              isToday={isToday}
              isPastWithCompleted={isPast && hasCompleted}
              selectedId={selectedId}
              onSelectSession={onSelectSession}
              isLastCol={(idx + 1) % 7 === 0}
              isLastRow={idx >= totalCells - 7}
            />
          )
        })}
      </div>
    </div>
  )
}

function DayCell({
  dayNum,
  sessions,
  isToday,
  isPastWithCompleted,
  selectedId,
  onSelectSession,
  isLastCol,
  isLastRow,
}: {
  dayNum: number
  dateStr: string
  sessions: KtSession[]
  isToday: boolean
  isPastWithCompleted: boolean
  selectedId: string | null
  onSelectSession: (id: string) => void
  isLastCol: boolean
  isLastRow: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const MAX_VISIBLE = 2
  const overflowCount =
    sessions.length > MAX_VISIBLE && !expanded ? sessions.length - MAX_VISIBLE : 0
  const visible = overflowCount > 0 ? sessions.slice(0, MAX_VISIBLE) : sessions

  let cellBg = 'var(--rmg-color-white)'
  if (isToday) cellBg = 'var(--rmg-color-tint-yellow)'
  else if (isPastWithCompleted) cellBg = 'var(--rmg-color-tint-green)'

  return (
    <div
      style={{
        minHeight: 88,
        backgroundColor: cellBg,
        borderRight: isLastCol ? 'none' : '1px solid var(--rmg-color-grey-3)',
        borderBottom: isLastRow ? 'none' : '1px solid var(--rmg-color-grey-3)',
        padding: '6px 4px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* Day number */}
      <span
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 12,
          fontWeight: isToday ? 700 : 400,
          color: isToday ? 'var(--rmg-color-text-heading)' : 'var(--rmg-color-grey-1)',
          alignSelf: 'flex-end',
          marginBottom: 2,
        }}
      >
        {dayNum}
      </span>

      {/* Session pills */}
      {visible.map((s) => {
        const { bg, fg } = statusBadgeStyle(s.status)
        const sel = selectedId === s.id
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelectSession(s.id)}
            title={s.session_name}
            style={{
              display: 'block',
              width: '100%',
              padding: '2px 4px',
              borderRadius: 'var(--rmg-radius-xs)',
              backgroundColor: sel ? 'var(--rmg-color-red)' : bg,
              color: sel ? 'var(--rmg-color-white)' : fg,
              fontSize: 10,
              fontWeight: 600,
              fontFamily: 'var(--rmg-font-body)',
              textAlign: 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            {s.session_name}
          </button>
        )
      })}

      {/* Overflow toggle */}
      {overflowCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            fontSize: 10,
            fontFamily: 'var(--rmg-font-body)',
            color: 'var(--rmg-color-grey-1)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            padding: '1px 4px',
          }}
        >
          +{overflowCount} more
        </button>
      )}
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  session,
  groups,
  supplierMap,
}: {
  session: KtSession | null
  groups: AppGroup[]
  supplierMap: Record<string, string>
}) {
  const [resources, setResources] = useState<DetailResource[]>([])
  const [loading, setLoading] = useState(false)

  const fetchResources = useCallback(async (sessionId: string) => {
    setLoading(true)
    setResources([])
    const { data } = await supabase
      .from('tessera_kt_session_resources')
      .select('role, resources(resource_name, suppliers(supplier_abbreviation, supplier_colour))')
      .eq('session_id', sessionId)

    type RawRow = {
      role: string
      resources:
        | { resource_name: string; suppliers: { supplier_abbreviation: string; supplier_colour: string } | null }
        | { resource_name: string; suppliers: { supplier_abbreviation: string; supplier_colour: string } | null }[]
        | null
    }

    const parsed: DetailResource[] = []
    for (const row of (data ?? []) as RawRow[]) {
      const r = Array.isArray(row.resources) ? row.resources[0] : row.resources
      if (!r) continue
      const sup = Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers
      parsed.push({
        role: row.role,
        resource_name: r.resource_name,
        supplier_abbreviation: sup?.supplier_abbreviation ?? null,
        supplier_colour: sup?.supplier_colour ?? null,
      })
    }
    setResources(parsed)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!session) {
      setResources([])
      return
    }
    void fetchResources(session.id)
  }, [session?.id, fetchResources])

  const panelStyle: React.CSSProperties = {
    backgroundColor: 'var(--rmg-color-surface-white)',
    borderRadius: 'var(--rmg-radius-m)',
    boxShadow: 'var(--rmg-shadow-card)',
    overflow: 'hidden',
  }

  if (!session) {
    return (
      <div
        style={{
          ...panelStyle,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          gap: 12,
          minHeight: 240,
        }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--rmg-color-grey-2)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="9" x2="15" y2="9" />
          <line x1="9" y1="13" x2="13" y2="13" />
        </svg>
        <span
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 13,
            color: 'var(--rmg-color-grey-1)',
            textAlign: 'center',
          }}
        >
          Select a session to view details
        </span>
      </div>
    )
  }

  const group = groups.find((g) => g.id === session.app_group_id)
  const leads = resources.filter((r) => r.role === 'LEAD')
  const participants = resources.filter((r) => r.role === 'PARTICIPANT')

  function ResourceChip({ res }: { res: DetailResource }) {
    const colour =
      res.supplier_colour
        ? getSupplierColour(res.supplier_abbreviation ?? '', supplierMap) || res.supplier_colour
        : 'var(--rmg-color-grey-1)'
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: 'var(--rmg-radius-xl)',
          padding: '3px 10px',
          border: `1.5px solid ${colour}`,
          background: `${colour}18`,
          color: colour,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'var(--rmg-font-body)',
          whiteSpace: 'nowrap',
        }}
      >
        {res.supplier_abbreviation && (
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: colour,
              color: 'var(--rmg-color-white)',
              fontSize: 8,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {res.supplier_abbreviation.slice(0, 1)}
          </span>
        )}
        {res.resource_name}
      </span>
    )
  }

  const sectionLabel: React.CSSProperties = {
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--rmg-color-grey-1)',
    marginBottom: 8,
  }

  const metaValue: React.CSSProperties = {
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 14,
    color: 'var(--rmg-color-text-body)',
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--rmg-color-grey-3)',
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <h2
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: '1.1rem',
              fontWeight: 700,
              color: 'var(--rmg-color-text-heading)',
              margin: '0 0 6px',
              lineHeight: 1.3,
            }}
          >
            {session.session_name}
          </h2>

          {group && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  fontWeight: 700,
                  color: group.is_active ? 'var(--rmg-color-white)' : 'var(--rmg-color-grey-1)',
                  backgroundColor: group.is_active
                    ? 'var(--rmg-color-red)'
                    : 'var(--rmg-color-grey-3)',
                  borderRadius: 'var(--rmg-radius-xs)',
                  padding: '2px 6px',
                }}
              >
                G{String(group.group_number).padStart(2, '0')}
              </span>
              <span
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 13,
                  color: 'var(--rmg-color-text-light)',
                }}
              >
                {group.group_name}
              </span>
            </div>
          )}

          <StatusBadge status={session.status} />
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 280px)',
        }}
      >
        {/* Schedule section */}
        <div>
          <div style={sectionLabel}>Schedule</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 12,
                  color: 'var(--rmg-color-grey-1)',
                  minWidth: 70,
                }}
              >
                Date
              </span>
              <span
                style={{
                  ...metaValue,
                  color: session.planned_date
                    ? 'var(--rmg-color-text-body)'
                    : 'var(--rmg-color-grey-1)',
                  fontStyle: session.planned_date ? 'normal' : 'italic',
                }}
              >
                {session.planned_date
                  ? formatDateLong(session.planned_date)
                  : 'Not yet scheduled'}
              </span>
            </div>
            {session.duration_hrs != null && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span
                  style={{
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 12,
                    color: 'var(--rmg-color-grey-1)',
                    minWidth: 70,
                  }}
                >
                  Duration
                </span>
                <span style={metaValue}>{session.duration_hrs} hrs</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 12,
                  color: 'var(--rmg-color-grey-1)',
                  minWidth: 70,
                }}
              >
                Type
              </span>
              <span style={metaValue}>{session.is_playback ? 'Playback' : 'KT Only'}</span>
            </div>
            {session.was_rescheduled && (
              <span
                style={{
                  display: 'inline-flex',
                  alignSelf: 'flex-start',
                  marginTop: 4,
                  backgroundColor: 'var(--rmg-color-tint-orange)',
                  color: 'var(--rmg-color-orange)',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--rmg-font-body)',
                  borderRadius: 'var(--rmg-radius-xs)',
                  padding: '2px 8px',
                }}
              >
                Rescheduled
              </span>
            )}
          </div>
        </div>

        {/* Outcome section — COMPLETED only */}
        {session.status === 'COMPLETED' && session.outcome_score != null && (
          <div>
            <div style={sectionLabel}>Outcome</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={metaValue}>
                Score: {session.outcome_score} / 5
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor:
                        i < (session.outcome_score ?? 0)
                          ? 'var(--rmg-color-green-contrast)'
                          : 'var(--rmg-color-grey-3)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Cancellation section — CANCELLED only */}
        {session.status === 'CANCELLED' && (
          <div>
            <div style={sectionLabel}>Cancellation</div>
            <div
              style={{
                backgroundColor: 'var(--rmg-color-tint-pink)',
                borderRadius: 'var(--rmg-radius-s)',
                padding: '12px 14px',
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 13,
                color: 'var(--rmg-color-warm-red)',
                lineHeight: 1.5,
              }}
            >
              {session.cancellation_reason ?? 'No reason provided.'}
            </div>
          </div>
        )}

        {/* Leads section */}
        <div>
          <div style={sectionLabel}>Session Leads</div>
          {loading ? (
            <span
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 13,
                color: 'var(--rmg-color-grey-1)',
              }}
            >
              Loading…
            </span>
          ) : leads.length === 0 ? (
            <span
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 13,
                color: 'var(--rmg-color-grey-1)',
                fontStyle: 'italic',
              }}
            >
              No lead assigned
            </span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {leads.map((r, i) => (
                <ResourceChip key={i} res={r} />
              ))}
            </div>
          )}
        </div>

        {/* Participants section */}
        {participants.length > 0 && (
          <div>
            <div style={sectionLabel}>Participants</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {participants.map((r, i) => (
                <ResourceChip key={i} res={r} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
