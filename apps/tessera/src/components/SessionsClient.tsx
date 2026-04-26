'use client'

import { useState, useMemo } from 'react'
import type { ReactNode } from 'react'
import { TRACK_COLOURS, STATUS_COLOURS } from '@plato/ui/tokens'
import { highlightMatch } from '@/lib/highlightMatch'

// ── Types ────────────────────────────────────────────────────────────────────

export type FlatSession = {
  id: string
  session_name: string
  track: 'A' | 'B' | null
  is_playback: boolean
  status: string
  duration_hrs: number | null
  group_number: number | null
  group_name: string | null
  lead_name: string | null
  group_sort_order: number | null
  session_sort_order: number | null
}

type SortKey = 'session' | 'group' | 'duration'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | null
type TypeFilter = 'all' | 'kt' | 'playback'

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveStatusColour(s: string): string {
  if (s === 'RESCHEDULED') return STATUS_COLOURS.IN_PROGRESS
  const key = s as keyof typeof STATUS_COLOURS
  return STATUS_COLOURS[key] ?? STATUS_COLOURS.SCHEDULED
}

function resolveStatusLabel(s: string): string {
  const labels: Record<string, string> = {
    SCHEDULED: 'Scheduled',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    IN_PROGRESS: 'In Progress',
    RESCHEDULED: 'Rescheduled',
  }
  return labels[s] ?? s
}

// ── Main component ────────────────────────────────────────────────────────────

export function SessionsClient({ sessions }: { sessions: FlatSession[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filtersOpen, setFiltersOpen] = useState(false)

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    let result = sessions

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.session_name.toLowerCase().includes(q) ||
          (s.group_name?.toLowerCase().includes(q) ?? false),
      )
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

    if (typeFilter === 'kt') result = result.filter((s) => !s.is_playback)
    if (typeFilter === 'playback') result = result.filter((s) => s.is_playback)

    const sorted = [...result]
    if (sortKey === 'session') {
      sorted.sort((a, b) => {
        const cmp = a.session_name.localeCompare(b.session_name)
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else if (sortKey === 'group') {
      sorted.sort((a, b) => {
        const an = a.group_number ?? 999
        const bn = b.group_number ?? 999
        const cmp = an - bn
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else if (sortKey === 'duration') {
      sorted.sort((a, b) => {
        const ad = a.duration_hrs ?? 0
        const bd = b.duration_hrs ?? 0
        const cmp = ad - bd
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else {
      sorted.sort((a, b) => {
        const ag = a.group_sort_order ?? 999
        const bg = b.group_sort_order ?? 999
        if (ag !== bg) return ag - bg
        const as_ = a.session_sort_order ?? 999
        const bs_ = b.session_sort_order ?? 999
        if (as_ !== bs_) return as_ - bs_
        return a.session_name.localeCompare(b.session_name)
      })
    }
    return sorted
  }, [sessions, search, statusFilter, typeFilter, sortKey, sortDir])

  const headerLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--rmg-color-grey-1)',
    fontFamily: 'var(--rmg-font-body)',
  }

  return (
    <div>
      <style>{`
        .sessions-filter-toggle { display: none; }
        .sessions-filter-groups {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          flex: 1;
        }
        @media (max-width: 768px) {
          .sessions-filter-toggle { display: inline-flex !important; }
          .sessions-filter-groups {
            display: none;
            flex-basis: 100%;
            flex-direction: column;
            align-items: flex-start;
            margin-top: 8px;
            gap: 10px;
          }
          .sessions-filter-groups.is-open { display: flex; }
          .session-col-group,
          .session-col-lead,
          .session-col-duration {
            display: none !important;
          }
        }
      `}</style>

      {/* ── Filter bar — Section 11 ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '10px 20px',
          backgroundColor: 'var(--rmg-color-surface-white)',
          border: '1px solid var(--rmg-color-grey-3)',
          borderRadius: 'var(--rmg-radius-m)',
          marginBottom: 'var(--rmg-spacing-04)',
          flexWrap: 'wrap',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            style={{ color: 'var(--rmg-color-grey-1)', flexShrink: 0 }}
          >
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M10 10L13.5 13.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
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

        {/* Mobile toggle */}
        <button
          type="button"
          className="sessions-filter-toggle"
          onClick={() => setFiltersOpen((o) => !o)}
          style={{
            display: 'none',
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
          Filters {filtersOpen ? '↑' : '↓'}
        </button>

        {/* Collapsible filter groups */}
        <div className={`sessions-filter-groups${filtersOpen ? ' is-open' : ''}`}>
          <Divider />

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ ...headerLabelStyle, flexShrink: 0 }}>Status</span>
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

          <Divider />

          {/* Type */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ ...headerLabelStyle, flexShrink: 0 }}>Type</span>
            <div style={{ display: 'flex', gap: 4 }}>
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
          </div>

          {/* Result count */}
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              color: 'var(--rmg-color-grey-1)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              fontFamily: 'var(--rmg-font-body)',
            }}
          >
            {filtered.length} result{filtered.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <EmptyState hasQuery={search.trim().length > 0} />
      ) : (
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
              gridTemplateColumns: '3px 1fr 200px 140px 60px 110px',
              alignItems: 'center',
              backgroundColor: 'var(--rmg-color-grey-4)',
              borderBottom: '1px solid var(--rmg-color-grey-3)',
            }}
          >
            <div />
            <div style={{ padding: '10px 0 10px 16px' }}>
              <SortButton
                label="Session"
                sortKey="session"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                labelStyle={headerLabelStyle}
              />
            </div>
            <div className="session-col-group" style={{ padding: '10px 16px' }}>
              <SortButton
                label="Group"
                sortKey="group"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                labelStyle={headerLabelStyle}
              />
            </div>
            <div
              className="session-col-lead"
              style={{ padding: '10px 16px', ...headerLabelStyle }}
            >
              Lead
            </div>
            <div
              className="session-col-duration"
              style={{ padding: '10px 8px', display: 'flex', justifyContent: 'flex-end' }}
            >
              <SortButton
                label="Dur."
                sortKey="duration"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                labelStyle={headerLabelStyle}
              />
            </div>
            <div style={{ padding: '10px 20px 10px 12px', ...headerLabelStyle }}>Status</div>
          </div>

          {/* Session rows */}
          {filtered.map((session, idx) => (
            <SessionRow
              key={session.id}
              session={session}
              query={search.trim()}
              isLast={idx === filtered.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Filter pill — Section 3D ──────────────────────────────────────────────────

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

// ── Sort button ───────────────────────────────────────────────────────────────

function SortButton({
  label,
  sortKey: key,
  currentKey,
  currentDir,
  onSort,
  labelStyle,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey | null
  currentDir: SortDir
  onSort: (k: SortKey) => void
  labelStyle: React.CSSProperties
}) {
  const isActive = currentKey === key
  return (
    <button
      type="button"
      onClick={() => onSort(key)}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        color: isActive ? 'var(--rmg-color-red)' : 'var(--rmg-color-grey-1)',
        ...labelStyle,
      }}
    >
      {label}
      {isActive && <span>{currentDir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  )
}

// ── Session row ───────────────────────────────────────────────────────────────

function SessionRow({
  session,
  query,
  isLast,
}: {
  session: FlatSession
  query: string
  isLast: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const trackColour =
    session.track != null ? TRACK_COLOURS[session.track] : 'transparent'
  const badgeBg = resolveStatusColour(session.status)
  const badgeText = resolveStatusLabel(session.status)

  const nameNode: ReactNode = highlightMatch(session.session_name, query)
  const groupNode: ReactNode | null = session.group_name
    ? highlightMatch(session.group_name, query)
    : null

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '3px 1fr 200px 140px 60px 110px',
        alignItems: 'stretch',
        borderBottom: isLast ? 'none' : '1px solid var(--rmg-color-grey-3)',
        backgroundColor: hovered ? 'var(--rmg-color-grey-4)' : 'transparent',
        cursor: 'pointer',
      }}
    >
      {/* Col 1: Track colour bar */}
      <div style={{ backgroundColor: trackColour, borderRadius: 100 }} />

      {/* Col 2: Session title + group subtitle */}
      <div
        style={{
          padding: '14px 0 14px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--rmg-color-text-heading)',
            lineHeight: 1.3,
          }}
        >
          {nameNode}
        </div>
        {groupNode !== null && (
          <div
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 12,
              color: 'var(--rmg-color-text-light)',
              marginTop: 2,
            }}
          >
            {groupNode}
          </div>
        )}
      </div>

      {/* Col 3: Group chip + name */}
      <div
        className="session-col-group"
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          overflow: 'hidden',
        }}
      >
        {session.group_number !== null && (
          <span
            style={{
              backgroundColor: 'var(--rmg-color-grey-4)',
              color: 'var(--rmg-color-grey-1)',
              borderRadius: 'var(--rmg-radius-xs)',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 7px',
              flexShrink: 0,
              fontFamily: 'var(--rmg-font-body)',
            }}
          >
            G{session.group_number}
          </span>
        )}
        {session.group_name && (
          <span
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 12,
              color: 'var(--rmg-color-text-light)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {session.group_name}
          </span>
        )}
      </div>

      {/* Col 4: Lead — plain text, Section 3F */}
      <div
        className="session-col-lead"
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 12,
          color: 'var(--rmg-color-grey-1)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {session.lead_name}
      </div>

      {/* Col 5: Duration — plain text, Section 3F */}
      <div
        className="session-col-duration"
        style={{
          padding: '14px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--rmg-color-text-body)',
          whiteSpace: 'nowrap',
        }}
      >
        {session.duration_hrs != null ? `${session.duration_hrs} hrs` : '—'}
      </div>

      {/* Col 6: Status badge — Section 3C solid fill */}
      <div
        style={{
          padding: '14px 20px 14px 12px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 10px',
            backgroundColor: badgeBg,
            color: '#ffffff',
            borderRadius: 'var(--rmg-radius-xl)',
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {badgeText}
        </span>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 60,
        gap: 12,
      }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        style={{ color: 'var(--rmg-color-grey-2)' }}
      >
        <circle cx="13" cy="13" r="9" stroke="currentColor" strokeWidth="2" />
        <path
          d="M20 20L28 28"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 14,
          color: 'var(--rmg-color-grey-1)',
          textAlign: 'center',
        }}
      >
        No sessions match the current filters
      </div>
      {hasQuery && (
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 12,
            color: 'var(--rmg-color-grey-2)',
          }}
        >
          Try a different search term
        </div>
      )}
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 18,
        backgroundColor: 'var(--rmg-color-grey-2)',
        flexShrink: 0,
      }}
    />
  )
}
