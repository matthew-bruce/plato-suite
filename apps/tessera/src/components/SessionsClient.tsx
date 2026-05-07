'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { AppGroup, KtSession, SessionLead } from '@/app/sessions/page'
import { TRACK_COLOURS, getSupplierColour } from '@plato/ui/tokens'
import { highlightMatch } from '@/lib/highlightMatch'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'list' | 'calendar'
type ViewMode = 'by-group' | 'all'
type StatusFilter = 'ALL' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type TypeFilter = 'all' | 'kt' | 'playback'

type DetailResource = {
  role: string
  resource_id: string | null
  resource_name: string
  resource_function: string | null
  supplier_abbreviation: string | null
  supplier_colour: string | null
}

interface SessionsClientProps {
  groups: AppGroup[]
  sessions: KtSession[]
  sessionLeads: SessionLead[]
  supplierMap: Record<string, string>
  sessionPeopleCounts: Record<string, number>
  metricGroups: number
  metricSessions: number
  metricHours: string | number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusLabel(status: KtSession['status'] | string, plannedDate?: string | null): string {
  if (status === 'SCHEDULED' && !plannedDate) return 'Planned'
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

function ordinalSuffix(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return 'th'
  switch (n % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

function formatDateFull(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' })
  const month = date.toLocaleDateString('en-GB', { month: 'long' })
  return `${weekday}, ${d}${ordinalSuffix(d)} ${month}`
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

function StatusChip({ status, plannedDate }: { status: string; plannedDate?: string | null }) {
  let bg: string
  let fg: string
  switch (status) {
    case 'COMPLETED':
      bg = 'var(--rmg-color-tint-green)'; fg = '#1A6B00'; break
    case 'CANCELLED':
      bg = 'var(--rmg-color-tint-pink)'; fg = 'var(--rmg-color-warm-red)'; break
    case 'IN_PROGRESS':
    case 'RESCHEDULED':
      bg = '#BEE0F5'; fg = '#005F8A'; break
    default:
      bg = 'var(--rmg-color-grey-3)'; fg = 'var(--rmg-color-dark-grey)'
  }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 7px',
      borderRadius: 3,
      fontFamily: 'var(--rmg-font-body)',
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
      whiteSpace: 'nowrap',
      backgroundColor: bg,
      color: fg,
    }}>
      {statusLabel(status, plannedDate)}
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

// Outlined pill chip — used in AllSessionsView flat table lead column
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

// Compact solid lead chip — used inline inside group session rows
function LeadChip({ lead }: { lead: SessionLead }) {
  const c = lead.supplier_colour ?? 'var(--rmg-color-grey-2)'
  return (
    <span
      title={lead.resource_name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        borderRadius: 'var(--rmg-radius-xl)',
        padding: '1px 7px',
        backgroundColor: c,
        color: 'var(--rmg-color-white)',
        fontSize: 10,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        fontFamily: 'var(--rmg-font-body)',
        flexShrink: 0,
      }}
    >
      {lead.resource_name}
    </span>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function SessionsClient({
  groups,
  sessions,
  sessionLeads,
  supplierMap,
  sessionPeopleCounts,
  metricGroups,
  metricSessions,
  metricHours,
}: SessionsClientProps) {
  const searchParams = useSearchParams()
  const groupParam = searchParams.get('group')

  const [activeTab, setActiveTab] = useState<TabId>('list')
  const [viewMode, setViewMode] = useState<ViewMode>('by-group')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() =>
    groupParam ? new Set([groupParam]) : new Set()
  )
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null

  useEffect(() => {
    if (!groupParam) return
    const timer = setTimeout(() => {
      const el = document.getElementById(`group-${groupParam}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => clearTimeout(timer)
  }, [groupParam])

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

  const leadMap = useMemo(() => {
    const m = new Map<string, SessionLead>()
    for (const l of sessionLeads) m.set(l.session_id, l)
    return m
  }, [sessionLeads])

  return (
    <>
      <style>{`
        .sess-main { display: flex; flex: 1; overflow: hidden; }
        .sess-list { flex: 6; overflow-y: auto; overflow-x: hidden; padding: 16px 0 24px 28px; min-width: 0; }
        .sess-panel { flex: 4; overflow: hidden; display: flex; flex-direction: column; }
        @media (max-width: 900px) {
          .sess-panel { display: none; }
          .sess-list { padding-left: 20px; }
        }
        @media (max-width: 700px) {
          .sess-list { padding-left: 16px; }
        }
      `}</style>

      {/* Page header */}
      <div style={{ padding: '24px 28px 0', flexShrink: 0 }}>
        <h1 style={{
          fontFamily: 'var(--rmg-font-display)',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          color: 'var(--rmg-color-text-heading)',
          margin: 0,
        }}>
          Sessions
        </h1>
        <p style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 11,
          color: 'var(--rmg-color-grey-1)',
          margin: '4px 0 0',
          fontWeight: 400,
        }}>
          {metricGroups} application group{metricGroups === 1 ? '' : 's'}
          <span style={{ margin: '0 4px', opacity: 0.5 }}>·</span>
          {metricSessions} session{metricSessions === 1 ? '' : 's'}
          <span style={{ margin: '0 4px', opacity: 0.5 }}>·</span>
          {metricHours} hrs
        </p>
      </div>

      {/* Controls strip — dark top tier + grey bottom tier */}
      <div style={{
        margin: '16px 28px 0',
        border: '1px solid #E4E4E4',
        borderRadius: 10,
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Top tier — dark */}
        <div style={{
          background: '#2A2A2D',
          padding: '7px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap' as const,
          rowGap: 6,
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 140, maxWidth: 280 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="#8F9495" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search sessions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                height: 32,
                padding: '0 10px 0 30px',
                border: '1px solid #D5D5D5',
                borderRadius: 4,
                background: '#ffffff',
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 12,
                color: '#2A2A2D',
                outline: 'none',
              }}
            />
          </div>

          {/* Status filter pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
            {(['ALL', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as StatusFilter[]).map((v) => {
              const active = statusFilter === v
              const label = v === 'ALL' ? 'All' : v === 'IN_PROGRESS' ? 'In Progress' : v === 'SCHEDULED' ? 'Scheduled' : v.charAt(0) + v.slice(1).toLowerCase()
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setStatusFilter(v)}
                  style={{
                    height: 26,
                    padding: '0 11px',
                    borderRadius: 100,
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    border: `1.5px solid ${active ? '#ffffff' : 'rgba(255,255,255,0.25)'}`,
                    background: active ? '#ffffff' : 'transparent',
                    color: active ? '#2A2A2D' : 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* List / Calendar view toggle */}
          <div style={{
            display: 'flex',
            marginLeft: 'auto',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            padding: 2,
            flexShrink: 0,
          }}>
            {(['list', 'calendar'] as TabId[]).map((t) => {
              const active = activeTab === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTab(t)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 9px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    color: active ? '#2A2A2D' : 'rgba(255,255,255,0.65)',
                    cursor: 'pointer',
                    border: 'none',
                    background: active ? '#ffffff' : 'transparent',
                    fontFamily: 'var(--rmg-font-body)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t === 'list' ? 'List' : 'Calendar'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Bottom tier — grey, By Group / All Sessions tabs */}
        <div style={{
          background: '#F5F5F5',
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          borderTop: '1px solid #E4E4E4',
        }}>
          {([['by-group', 'By Group', metricGroups], ['all', 'All Sessions', metricSessions]] as [ViewMode, string, number][]).map(([mode, label, count]) => {
            const active = viewMode === mode
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px 9px 0',
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#DA202A' : '#8F9495',
                  cursor: 'pointer',
                  border: 'none',
                  background: 'transparent',
                  fontFamily: 'var(--rmg-font-body)',
                  borderBottom: `2px solid ${active ? '#DA202A' : 'transparent'}`,
                  whiteSpace: 'nowrap',
                  marginRight: 6,
                }}
              >
                {label}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 100,
                  fontSize: 10,
                  fontWeight: 700,
                  background: active ? '#F8E7E7' : '#EEEEEE',
                  color: active ? '#DA202A' : '#8F9495',
                }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main area */}
      <div className="sess-main">

        {/* Session list */}
        <div className="sess-list">
          {activeTab === 'list' && viewMode === 'by-group' && (
            <ByGroupView
              groups={groups}
              sessions={sessions}
              leadMap={leadMap}
              sessionPeopleCounts={sessionPeopleCounts}
              search={search}
              statusFilter={statusFilter}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              selectedId={selectedId}
              onSelectSession={handleSelectSession}
            />
          )}
          {activeTab === 'list' && viewMode === 'all' && (
            <AllSessionsView
              groups={groups}
              sessions={sessions}
              leadMap={leadMap}
              supplierMap={supplierMap}
              sessionPeopleCounts={sessionPeopleCounts}
              search={search}
              statusFilter={statusFilter}
              typeFilter={typeFilter}
              selectedId={selectedId}
              onSelectSession={handleSelectSession}
            />
          )}
          {activeTab === 'calendar' && (
            <CalendarView
              sessions={sessions}
              groups={groups}
              calYear={calYear}
              calMonth={calMonth}
              setCalYear={setCalYear}
              setCalMonth={setCalMonth}
              selectedId={selectedId}
              onSelectSession={handleSelectSession}
            />
          )}
        </div>

        {/* Detail panel */}
        <div className="sess-panel">
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
  sessionPeopleCounts: Record<string, number>
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
  sessionPeopleCounts,
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
  const [searchFocused, setSearchFocused] = useState(false)

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
      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {/* Search — FormField-style border with focus state */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            minWidth: 160,
            height: 36,
            padding: '0 10px',
            border: searchFocused
              ? '2px solid var(--rmg-color-blue)'
              : '1px solid var(--rmg-color-grey-3)',
            borderRadius: 'var(--rmg-radius-s)',
            backgroundColor: 'var(--rmg-color-white)',
            boxSizing: 'border-box',
          }}
        >
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
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
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

        {/* Status filter pills */}
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
        )}

        {/* View mode toggle — lightweight segmented control */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexShrink: 0 }}>
          {(['by-group', 'all'] as ViewMode[]).map((mode) => {
            const active = viewMode === mode
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '3px 12px',
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: active ? 'var(--rmg-color-dark-grey)' : 'var(--rmg-color-grey-3)',
                  backgroundColor: active ? 'var(--rmg-color-dark-grey)' : 'var(--rmg-color-white)',
                  color: active ? 'var(--rmg-color-white)' : 'var(--rmg-color-dark-grey)',
                  borderRadius: 'var(--rmg-radius-xl)',
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
          sessionPeopleCounts={sessionPeopleCounts}
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
          sessionPeopleCounts={sessionPeopleCounts}
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
  sessionPeopleCounts,
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
  sessionPeopleCounts: Record<string, number>
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
          sessionPeopleCounts={sessionPeopleCounts}
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
  sessionPeopleCounts,
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
  sessionPeopleCounts: Record<string, number>
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
        backgroundColor: '#ffffff',
        border: '1px solid #E4E4E4',
        borderRadius: 8,
        overflow: 'hidden',
        opacity: hasNoMatches ? 0.35 : 1,
        transition: 'opacity 150ms ease',
        marginBottom: 4,
        marginRight: 28,
      }}
    >
      {/* Header */}
      <div
        id={`group-${group.id}`}
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
          gap: 10,
          padding: '10px 12px',
          cursor: 'pointer',
          outline: 'none',
          backgroundColor: headerHovered ? '#FAFAFA' : '#ffffff',
          transition: 'background 0.1s',
          userSelect: 'none' as const,
        }}
      >
        {/* Group number badge */}
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontWeight: 700,
            color: '#ffffff',
            flexShrink: 0,
            backgroundColor: group.is_active ? '#DA202A' : '#D5D5D5',
            fontFamily: 'monospace',
          }}
        >
          {group.group_number}
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
              fontWeight: 600,
              fontSize: 13,
              color: group.is_active
                ? 'var(--rmg-color-dark-grey)'
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
                fontSize: 10,
                fontWeight: 400,
                color: '#8F9495',
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
                fontSize: 11,
                fontWeight: 600,
                color: '#8F9495',
                whiteSpace: 'nowrap',
              }}
            >
              {completed.length}/{activePlanned.length} sessions
            </div>
            <div
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 11,
                color: '#8F9495',
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
            {pct > 0 && (
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: '#DA202A',
                  borderRadius: 100,
                }}
              />
            )}
          </div>

          {/* Chevron */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8F9495" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* Session list */}
      {expanded && (
        <div style={{ borderTop: '1px solid #EEEEEE' }}>
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
                peopleCount={sessionPeopleCounts[s.id] ?? 0}
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
  peopleCount,
  rowIndex,
  selected,
  onSelect,
  search,
}: {
  session: KtSession
  lead: SessionLead | null
  peopleCount: number
  rowIndex: number
  selected: boolean
  onSelect: (id: string) => void
  search: string
}) {
  const [hovered, setHovered] = useState(false)

  let bg = '#ffffff'
  if (selected) bg = '#F8E7E7'
  else if (hovered) bg = '#FAFAFA'

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
        gap: 10,
        padding: '8px 12px',
        borderBottom: '1px solid #F8F8F8',
        backgroundColor: bg,
        cursor: 'pointer',
        outline: 'none',
        borderLeft: selected ? '2px solid #DA202A' : '2px solid transparent',
      }}
    >
      {/* Title + type */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--rmg-color-dark-grey)',
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
            fontSize: 10,
            color: '#8F9495',
            marginTop: 2,
          }}
        >
          {session.is_playback ? 'Playback' : 'KT Only'}
          {session.duration_hrs != null ? ` · ${session.duration_hrs} hrs` : ''}
        </div>
      </div>

      {/* Date */}
      <div
        style={{
          width: 140,
          flexShrink: 0,
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 11,
          color: '#8F9495',
          whiteSpace: 'nowrap',
        }}
      >
        {session.planned_date ? formatDateFull(session.planned_date) : '—'}
      </div>

      {/* People count */}
      <div
        style={{
          width: 30,
          flexShrink: 0,
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 11,
          color: '#8F9495',
          whiteSpace: 'nowrap',
          textAlign: 'right',
        }}
      >
        {peopleCount > 0 ? peopleCount : '—'}
      </div>

      {/* Duration */}
      <div
        style={{
          width: 28,
          flexShrink: 0,
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 11,
          color: '#8F9495',
          whiteSpace: 'nowrap',
          textAlign: 'right',
        }}
      >
        {session.duration_hrs != null ? `${session.duration_hrs}h` : '—'}
      </div>

      {/* Status chip */}
      <div style={{ width: 84, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <StatusChip status={session.status} plannedDate={session.planned_date} />
      </div>
    </div>
  )
}

// ── All Sessions flat list ────────────────────────────────────────────────────

function AllSessionsView({
  groups,
  sessions,
  leadMap,
  supplierMap,
  sessionPeopleCounts,
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
  sessionPeopleCounts: Record<string, number>
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
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--rmg-color-grey-4)',
          borderBottom: '1px solid var(--rmg-color-grey-3)',
        }}
      >
        <div style={{ ...headerCell, flex: 1, minWidth: 0, paddingLeft: 20 }}>Session</div>
        <div className="sessions-col-group" style={{ ...headerCell, width: 90, flexShrink: 0 }}>
          Group
        </div>
        <div className="sessions-col-lead" style={{ ...headerCell, width: 140, flexShrink: 0 }}>
          Lead
        </div>
        <div className="sessions-col-date" style={{ ...headerCell, width: 90, flexShrink: 0 }}>
          Date
        </div>
        <div className="sessions-col-people" style={{ ...headerCell, width: 60, flexShrink: 0, textAlign: 'right' }}>
          People
        </div>
        <div className="sessions-col-dur" style={{ ...headerCell, width: 60, flexShrink: 0, textAlign: 'right' }}>
          Dur.
        </div>
        <div style={{ ...headerCell, width: 100, flexShrink: 0 }}>Status</div>
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
            peopleCount={sessionPeopleCounts[session.id] ?? 0}
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
  peopleCount,
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
  peopleCount: number
  rowIndex: number
  isLast: boolean
  selected: boolean
  onSelect: (id: string) => void
  search: string
}) {
  const [hovered, setHovered] = useState(false)

  let bg = '#ffffff'
  if (selected) bg = 'var(--rmg-color-tint-red)'
  else if (hovered) bg = '#FAFAFA'

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
        width: '100%',
        borderBottom: isLast ? 'none' : '1px solid var(--rmg-color-grey-3)',
        backgroundColor: bg,
        cursor: 'pointer',
        outline: 'none',
        borderLeft: selected ? '2px solid #DA202A' : '2px solid transparent',
      }}
    >
      {/* Session name + group subtitle */}
      <div style={{ flex: 1, minWidth: 0, padding: '12px 12px 12px 17px' }}>
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--rmg-color-dark-grey)',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {highlightMatch(session.session_name, search)}
        </div>
        {group && (
          <div
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 12,
              color: 'var(--rmg-color-grey-1)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {highlightMatch(group.group_name, search)}
          </div>
        )}
      </div>

      {/* Group badge */}
      <div
        className="sessions-col-group"
        style={{ width: 90, flexShrink: 0, padding: '12px', display: 'flex', alignItems: 'center' }}
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
        style={{ width: 140, flexShrink: 0, padding: '12px', display: 'flex', alignItems: 'center' }}
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
          width: 90,
          flexShrink: 0,
          padding: '12px',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 12,
          color: session.planned_date ? 'var(--rmg-color-text-body)' : 'var(--rmg-color-grey-1)',
          whiteSpace: 'nowrap',
        }}
      >
        {session.planned_date ? formatDateFull(session.planned_date) : '—'}
      </div>

      {/* People count */}
      <div
        className="sessions-col-people"
        style={{
          width: 60,
          flexShrink: 0,
          padding: '12px',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 12,
          color: peopleCount > 0 ? 'var(--rmg-color-text-body)' : 'var(--rmg-color-grey-1)',
          whiteSpace: 'nowrap',
          textAlign: 'right',
        }}
      >
        {peopleCount > 0 ? peopleCount : '—'}
      </div>

      {/* Duration */}
      <div
        className="sessions-col-dur"
        style={{
          width: 60,
          flexShrink: 0,
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

      {/* Status chip */}
      <div style={{ width: 100, flexShrink: 0, padding: '12px', display: 'flex', alignItems: 'center' }}>
        <StatusChip status={session.status} plannedDate={session.planned_date} />
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

// App group colours — specified by programme, intentional Tessera hardcoded exceptions
const GROUP_COLOURS: Record<number, string> = {
  0: '#1A2B5B',
  1: '#DA202A',
  2: '#E2611A',
  3: '#7C3AED',
  4: '#0892CB',
  5: '#008A00',
  6: '#9B0A6E',
  7: '#3ABFB8',
  8: '#FF8C00',
  9: '#3D3D3D',
  10: '#8F9495',
  11: '#1976F2',
  12: '#8F9495',
}

type GroupInfo = { groupNum: number; label: string; color: string }

function CalendarView({
  sessions,
  groups,
  calYear,
  calMonth,
  setCalYear,
  setCalMonth,
  selectedId,
  onSelectSession,
}: {
  sessions: KtSession[]
  groups: AppGroup[]
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

  const groupInfoMap = useMemo(() => {
    const m = new Map<string, GroupInfo>()
    for (const g of groups) {
      m.set(g.id, {
        groupNum: g.group_number,
        label: `G${String(g.group_number).padStart(2, '0')}`,
        color: GROUP_COLOURS[g.group_number] ?? '#8F9495',
      })
    }
    return m
  }, [groups])

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

  const mo = String(calMonth + 1).padStart(2, '0')
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7

  type GridCell =
    | { kind: 'empty'; idx: number }
    | { kind: 'day'; dayNum: number; dateStr: string; idx: number }

  const cells: GridCell[] = []
  for (let i = 0; i < firstDow; i++) cells.push({ kind: 'empty', idx: i })
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${mo}-${String(d).padStart(2, '0')}`
    cells.push({ kind: 'day', dayNum: d, dateStr, idx: firstDow + d - 1 })
  }
  const trailingCount = (7 - (cells.length % 7)) % 7
  for (let i = 0; i < trailingCount; i++) {
    cells.push({ kind: 'empty', idx: cells.length })
  }
  const totalCells = cells.length

  return (
    <div style={{ border: '1px solid var(--rmg-color-grey-3)', borderRadius: 8, overflow: 'hidden' }}>
      {/* Month navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid var(--rmg-color-grey-3)',
        backgroundColor: 'var(--rmg-color-surface-white)',
      }}>
        <button type="button" onClick={prevMonth} aria-label="Previous month" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '4px 8px', color: 'var(--rmg-color-text-body)',
          fontSize: 18, lineHeight: 1, fontFamily: 'var(--rmg-font-body)',
        }}>‹</button>
        <span style={{ fontFamily: 'var(--rmg-font-body)', fontSize: 16, fontWeight: 500, color: 'var(--rmg-color-text-heading)' }}>
          {MONTH_NAMES[calMonth]} {calYear}
        </span>
        <button type="button" onClick={nextMonth} aria-label="Next month" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '4px 8px', color: 'var(--rmg-color-text-body)',
          fontSize: 18, lineHeight: 1, fontFamily: 'var(--rmg-font-body)',
        }}>›</button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--rmg-color-grey-3)', backgroundColor: 'var(--rmg-color-grey-4)' }}>
        {DAY_NAMES.map((d) => (
          <div key={d} style={{ textAlign: 'center', padding: '6px 4px', fontFamily: 'var(--rmg-font-body)', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--rmg-color-grey-1)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((cell, position) => {
          const isLastCol = (position + 1) % 7 === 0
          const isLastRow = position >= totalCells - 7

          if (cell.kind === 'empty') {
            return (
              <div key={`empty-${cell.idx}`} style={{
                minHeight: 100,
                borderRight: isLastCol ? 'none' : '1px solid var(--rmg-color-grey-3)',
                borderBottom: isLastRow ? 'none' : '1px solid var(--rmg-color-grey-3)',
                backgroundColor: 'var(--rmg-color-grey-4)',
              }} />
            )
          }

          const { dayNum, dateStr } = cell
          const daySessions = byDate.get(dateStr) ?? []
          const isToday = dateStr === today

          return (
            <DayCell
              key={dateStr}
              dayNum={dayNum}
              sessions={daySessions}
              isToday={isToday}
              groupInfoMap={groupInfoMap}
              selectedId={selectedId}
              onSelectSession={onSelectSession}
              isLastCol={isLastCol}
              isLastRow={isLastRow}
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
  groupInfoMap,
  selectedId,
  onSelectSession,
  isLastCol,
  isLastRow,
}: {
  dayNum: number
  sessions: KtSession[]
  isToday: boolean
  groupInfoMap: Map<string, GroupInfo>
  selectedId: string | null
  onSelectSession: (id: string) => void
  isLastCol: boolean
  isLastRow: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const OVERFLOW_THRESHOLD = 3
  const MAX_COLLAPSED = 2
  const isOverflowing = sessions.length > OVERFLOW_THRESHOLD && !expanded
  const visible = isOverflowing ? sessions.slice(0, MAX_COLLAPSED) : sessions
  const overflowCount = isOverflowing ? sessions.length - MAX_COLLAPSED : 0

  const cellBg = isToday ? 'var(--rmg-color-tint-yellow)' : 'var(--rmg-color-surface-white)'

  return (
    <div style={{
      minHeight: 100,
      backgroundColor: cellBg,
      borderRight: isLastCol ? 'none' : '1px solid var(--rmg-color-grey-3)',
      borderBottom: isLastRow ? 'none' : '1px solid var(--rmg-color-grey-3)',
      padding: '4px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Day number — top-right */}
      <span style={{
        fontFamily: 'var(--rmg-font-body)', fontSize: 12, fontWeight: 500,
        color: isToday ? 'var(--rmg-color-text-heading)' : 'var(--rmg-color-grey-1)',
        alignSelf: 'flex-end', padding: '1px 2px 2px 0', lineHeight: 1,
      }}>
        {dayNum}
      </span>

      {/* Session pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {visible.map((s) => {
          const info = s.app_group_id ? groupInfoMap.get(s.app_group_id) : undefined
          const pillColor = info?.color ?? '#8F9495'
          const label = info?.label ?? '—'
          const sel = selectedId === s.id
          const isCancelled = s.status === 'CANCELLED'
          const isCompleted = s.status === 'COMPLETED'

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectSession(s.id)}
              title={s.session_name}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                width: '100%', height: 20, padding: '0 6px',
                borderRadius: 3, backgroundColor: pillColor,
                color: 'white', fontSize: 11, fontWeight: 500,
                fontFamily: 'var(--rmg-font-body)', cursor: 'pointer',
                border: 'none',
                boxShadow: sel ? 'inset 0 0 0 2px white' : 'none',
                opacity: isCancelled ? 0.45 : 1,
                flexShrink: 0, overflow: 'hidden',
              }}
            >
              {isCompleted && (
                <span style={{ fontSize: 9, flexShrink: 0, opacity: 0.9 }}>✓</span>
              )}
              <span style={{
                fontSize: 9, fontWeight: 600,
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: 2, padding: '0 3px',
                flexShrink: 0, lineHeight: '14px',
              }}>
                {label}
              </span>
              <span style={{
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', textAlign: 'left',
                textDecoration: isCancelled ? 'line-through' : 'none',
              }}>
                {s.session_name}
              </span>
            </button>
          )
        })}

        {overflowCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            style={{
              fontSize: 11, fontFamily: 'var(--rmg-font-body)',
              color: 'var(--rmg-color-grey-1)', background: 'none',
              border: 'none', cursor: 'pointer',
              textAlign: 'left', padding: '0 4px', lineHeight: '16px',
            }}
          >
            +{overflowCount} more
          </button>
        )}
      </div>
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
  const router = useRouter()
  const [hoveredResourceId, setHoveredResourceId] = useState<string | null>(null)

  const fetchResources = useCallback(async (sessionId: string) => {
    setLoading(true)
    setResources([])
    const { data } = await supabase
      .from('tessera_kt_session_resources')
      .select('role, resources(resource_id, resource_name, resource_function, suppliers(supplier_abbreviation, supplier_colour))')
      .eq('session_id', sessionId)

    type RawRow = {
      role: string
      resources:
        | { resource_id: string; resource_name: string; resource_function: string | null; suppliers: { supplier_abbreviation: string; supplier_colour: string }[] | null }
        | { resource_id: string; resource_name: string; resource_function: string | null; suppliers: { supplier_abbreviation: string; supplier_colour: string }[] | null }[]
        | null
    }

    const parsed: DetailResource[] = []
    for (const row of (data ?? []) as RawRow[]) {
      const r = Array.isArray(row.resources) ? row.resources[0] : row.resources
      if (!r) continue
      const sup = Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers
      parsed.push({
        role: row.role,
        resource_id: r.resource_id,
        resource_name: r.resource_name,
        resource_function: r.resource_function ?? null,
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

  const functionGroups = useMemo(() => {
    const grouped: Record<string, DetailResource[]> = {}
    for (const p of resources) {
      if (p.role !== 'PARTICIPANT') continue
      const key = p.resource_function ?? 'Other'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(p)
    }
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  }, [resources])

  const panelStyle: React.CSSProperties = {
    margin: '16px 28px 16px 0',
    border: '1px solid #E4E4E4',
    borderRadius: 8,
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 4px 56px 0 rgba(0,0,0,0.07)',
    flex: 1,
  }

  if (!session) {
    return (
      <div style={{
        ...panelStyle,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 32,
        textAlign: 'center' as const,
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D5D5D5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <path d="M16 2v4M8 2v4M3 10h18"/>
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>
        </svg>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#8F9495' }}>No session selected</div>
        <div style={{ fontSize: 11, color: '#D5D5D5', lineHeight: 1.5 }}>Select a session from the list to view its details</div>
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
        onClick={() => { if (res.resource_id) router.push(`/people?resource=${res.resource_id}`) }}
        onMouseEnter={() => { if (res.resource_id) setHoveredResourceId(res.resource_id) }}
        onMouseLeave={() => setHoveredResourceId(null)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: 100,
          fontSize: 10,
          fontWeight: 600,
          color: '#ffffff',
          whiteSpace: 'nowrap',
          backgroundColor: colour,
          fontFamily: 'var(--rmg-font-body)',
          cursor: res.resource_id ? 'pointer' : 'default',
          opacity: res.resource_id != null && hoveredResourceId === res.resource_id ? 0.82 : 1,
        }}
      >
        {res.resource_name}
      </span>
    )
  }

  const sectionLabel: React.CSSProperties = {
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#8F9495',
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
          padding: '16px 20px 14px',
          borderBottom: '1px solid #EEEEEE',
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--rmg-color-text-heading)',
            margin: '0 0 8px',
            lineHeight: 1.35,
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
                fontSize: 10,
                fontWeight: 700,
                color: group.is_active ? '#ffffff' : 'var(--rmg-color-grey-1)',
                backgroundColor: group.is_active
                  ? '#DA202A'
                  : 'var(--rmg-color-grey-3)',
                borderRadius: 100,
                padding: '2px 8px',
              }}
            >
              {group.group_number}
            </span>
            <span
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 12,
                color: '#8F9495',
              }}
            >
              {group.group_name}
            </span>
          </div>
        )}

        <StatusChip status={session.status} plannedDate={session.planned_date} />
      </div>

      {/* Body */}
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          overflowY: 'auto',
          flex: 1,
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
                  : 'No date set'}
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

        {/* Participants section — grouped by resource_function */}
        {participants.length > 0 && (
          <div>
            <div style={sectionLabel}>Participants</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {functionGroups.map(([fn, people]) => (
                <div key={fn}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const,
                    letterSpacing: '0.09em', color: '#404044',
                    display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7,
                  }}>
                    <span>{fn}</span>
                    <span style={{ color: '#8F9495', fontWeight: 500, letterSpacing: 0, textTransform: 'none' as const, fontSize: 10 }}>
                      · {people.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {people.map((r, i) => <ResourceChip key={i} res={r} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
