'use client'

import { useEffect, useMemo, useState } from 'react'
import type {
  Group,
  KtSession,
  ResourceRef,
  SupplierRef,
} from '@/app/groups/page'

// ── Supplier brand colours ──────────────────────────────────────────
const SUPPLIER_COLOURS: Record<string, string> = {
  CG: '#003C82', TCS: '#9B0A6E', RMG: '#E2001A',
  HT: '#FF8C00', NH: '#1A2B5B', EPAM: '#3D3D3D',
  TAAS: '#7C3AED', LT: '#3ABFB8', HCL: '#1976F2',
}

// ── Team badge styles ──────────────────────────────────────────────
const TEAM_STYLES: Record<string, { bg: string; text: string }> = {
  SERVICE: { bg: '#E6F1FB', text: '#185FA5' },
  SHARED:  { bg: '#F5E8F2', text: '#9B0A6E' },
}

// ── Group 12 amber accent ──────────────────────────────────────────
const G12_AMBER = {
  bg: '#FAEEDA',
  fg: '#854F0B',
  border: '#BA7517',
  headerBg: 'rgba(186,117,23,0.04)',
}

// ── Red alpha variants (literal rgba per spec) ─────────────────────
const RED_BAR_BG = 'rgba(218,32,42,0.06)'
const RED_BAR_BORDER = 'rgba(218,32,42,0.20)'
const RED_MATCH_BG = 'rgba(218,32,42,0.10)'
const RED_CARD_BORDER = 'rgba(218,32,42,0.30)'
const RED_HIGHLIGHT = 'rgba(218,32,42,0.12)'
const RED_SOLID = '#DA202A'

// ── Playback badge colours (match session status spec) ─────────────
const PLAYBACK_BG = '#E6F1FB'
const PLAYBACK_FG = '#185FA5'

type TeamFilter = 'ALL' | 'SERVICE' | 'SHARED'
type StatusFilter = 'ALL' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
type TabKey = 'progress' | 'calendar'

type GroupDerived = {
  allSessions: KtSession[]
  filteredSessions: KtSession[]
  searchMatches: KtSession[]
  completedCount: number
  totalCount: number
  hasMatches: boolean
  hasNoMatches: boolean
  leads: Array<{ id: string; name: string; supplier: SupplierRef | null }>
}

interface AppGroupsClientProps {
  groups: Group[]
  sessions: KtSession[]
}

function unwrap<T>(x: T | T[] | null | undefined): T | null {
  if (!x) return null
  return Array.isArray(x) ? (x[0] ?? null) : x
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function supplierColour(s: SupplierRef | null): string {
  if (!s) return '#8F9495'
  return (
    SUPPLIER_COLOURS[s.supplier_abbreviation] ??
    s.supplier_colour ??
    '#8F9495'
  )
}

function highlightText(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (!q) return text
  const lower = text.toLowerCase()
  const needle = q.toLowerCase()
  const idx = lower.indexOf(needle)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          backgroundColor: RED_HIGHLIGHT,
          color: RED_SOLID,
          borderRadius: 2,
          padding: '0 2px',
        }}
      >
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}

export function AppGroupsClient({ groups, sessions }: AppGroupsClientProps) {
  // ── State ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchFocused, setSearchFocused] = useState<boolean>(false)
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedBeyond4, setExpandedBeyond4] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<TabKey>('progress')

  // ── Derived per-group data ──────────────────────────────────────
  const groupDerived = useMemo(() => {
    const map = new Map<string, GroupDerived>()
    const q = searchQuery.trim().toLowerCase()

    for (const g of groups) {
      const allSessions = sessions.filter((s) => s.app_group_id === g.id)

      let filtered = allSessions
      if (teamFilter !== 'ALL') {
        filtered = filtered.filter((s) => s.team === teamFilter)
      }
      if (statusFilter !== 'ALL') {
        filtered = filtered.filter((s) => s.status === statusFilter)
      }

      let searchMatches = filtered
      if (q) {
        searchMatches = filtered.filter(
          (s) =>
            s.session_name.toLowerCase().includes(q) ||
            (s.focus_area?.toLowerCase().includes(q) ?? false),
        )
      }

      const completedCount = filtered.filter((s) => s.status === 'COMPLETED').length

      const leads: GroupDerived['leads'] = []
      for (const row of g.tessera_app_group_resources ?? []) {
        if (row.role !== 'LEAD') continue
        const r: ResourceRef | null = unwrap(row.resources)
        if (!r) continue
        const s = unwrap(r.suppliers)
        leads.push({ id: r.resource_id, name: r.resource_name, supplier: s })
      }

      map.set(g.id, {
        allSessions,
        filteredSessions: filtered,
        searchMatches,
        completedCount,
        totalCount: filtered.length,
        hasMatches: q.length > 0 && searchMatches.length > 0,
        hasNoMatches: q.length > 0 && searchMatches.length === 0,
        leads,
      })
    }
    return map
  }, [groups, sessions, teamFilter, statusFilter, searchQuery])

  // ── Auto-expand groups whose sessions match the search ──────────
  useEffect(() => {
    if (!searchQuery.trim()) return
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      for (const g of groups) {
        const d = groupDerived.get(g.id)
        if (d?.hasMatches) next.add(g.id)
      }
      return next
    })
  }, [searchQuery, groupDerived, groups])

  // ── Aggregate search stats (for the result bar) ─────────────────
  const searchStats = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return null
    let totalMatches = 0
    let groupsWithMatches = 0
    let groupsHidden = 0
    for (const g of groups) {
      const d = groupDerived.get(g.id)
      if (!d) continue
      if (d.hasMatches) {
        groupsWithMatches += 1
        totalMatches += d.searchMatches.length
      } else {
        groupsHidden += 1
      }
    }
    return { totalMatches, groupsWithMatches, groupsHidden }
  }, [searchQuery, groupDerived, groups])

  // ── Expand / collapse handlers ──────────────────────────────────
  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allExpanded = groups.length > 0 && groups.every((g) => expandedGroups.has(g.id))

  function toggleExpandAll() {
    if (allExpanded) {
      setExpandedGroups(new Set())
    } else {
      setExpandedGroups(new Set(groups.map((g) => g.id)))
    }
  }

  function toggleBeyond4(id: string) {
    setExpandedBeyond4((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-05)' }}>
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--rmg-spacing-02)',
          borderBottom: '1px solid var(--rmg-color-grey-3)',
        }}
      >
        {(
          [
            { key: 'progress' as const, label: 'Progress' },
            { key: 'calendar' as const, label: 'Calendar' },
          ]
        ).map((t) => {
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-b3)',
                lineHeight: 'var(--rmg-leading-b3)',
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--rmg-color-red)' : 'var(--rmg-color-text-body)',
                padding: 'var(--rmg-spacing-02) var(--rmg-spacing-04)',
                borderBottom: active ? '2px solid var(--rmg-color-red)' : '2px solid transparent',
                marginBottom: -1,
                background: 'none',
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'progress' ? (
        <ProgressTab
          groups={groups}
          groupDerived={groupDerived}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchFocused={searchFocused}
          setSearchFocused={setSearchFocused}
          teamFilter={teamFilter}
          setTeamFilter={setTeamFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          expandedGroups={expandedGroups}
          toggleGroup={toggleGroup}
          allExpanded={allExpanded}
          toggleExpandAll={toggleExpandAll}
          expandedBeyond4={expandedBeyond4}
          toggleBeyond4={toggleBeyond4}
          searchStats={searchStats}
        />
      ) : (
        <CalendarEmptyState />
      )}
    </div>
  )
}

// ── Progress tab ────────────────────────────────────────────────────

interface ProgressTabProps {
  groups: Group[]
  groupDerived: Map<string, GroupDerived>
  searchQuery: string
  setSearchQuery: (v: string) => void
  searchFocused: boolean
  setSearchFocused: (v: boolean) => void
  teamFilter: TeamFilter
  setTeamFilter: (v: TeamFilter) => void
  statusFilter: StatusFilter
  setStatusFilter: (v: StatusFilter) => void
  expandedGroups: Set<string>
  toggleGroup: (id: string) => void
  allExpanded: boolean
  toggleExpandAll: () => void
  expandedBeyond4: Set<string>
  toggleBeyond4: (id: string) => void
  searchStats:
    | { totalMatches: number; groupsWithMatches: number; groupsHidden: number }
    | null
}

function ProgressTab(p: ProgressTabProps) {
  const searchActive = p.searchQuery.trim().length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-04)' }}>
      {/* Controls row */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--rmg-spacing-04)',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <SearchBox
          value={p.searchQuery}
          onChange={p.setSearchQuery}
          focused={p.searchFocused}
          setFocused={p.setSearchFocused}
        />

        <FilterPillGroup
          label="Team"
          value={p.teamFilter}
          onChange={(v) => p.setTeamFilter(v as TeamFilter)}
          options={[
            { v: 'ALL', label: 'All' },
            { v: 'SERVICE', label: 'Service' },
            { v: 'SHARED', label: 'Shared' },
          ]}
        />

        <FilterPillGroup
          label="Status"
          value={p.statusFilter}
          onChange={(v) => p.setStatusFilter(v as StatusFilter)}
          options={[
            { v: 'ALL', label: 'All' },
            { v: 'SCHEDULED', label: 'Scheduled' },
            { v: 'COMPLETED', label: 'Completed' },
            { v: 'CANCELLED', label: 'Cancelled' },
          ]}
        />

        <button
          type="button"
          onClick={p.toggleExpandAll}
          style={{
            marginLeft: 'auto',
            padding: 'var(--rmg-spacing-02) var(--rmg-spacing-03)',
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c1)',
            lineHeight: 'var(--rmg-leading-c1)',
            color: 'var(--rmg-color-text-body)',
            background: 'none',
            border: '0.5px solid var(--rmg-color-grey-2)',
            borderRadius: 'var(--rmg-radius-s)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontWeight: 500,
          }}
        >
          {p.allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {/* Search result bar */}
      {searchActive && p.searchStats && (
        <div
          style={{
            backgroundColor: RED_BAR_BG,
            border: `0.5px solid ${RED_BAR_BORDER}`,
            borderRadius: 'var(--rmg-radius-s)',
            padding: 'var(--rmg-spacing-02) var(--rmg-spacing-03)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--rmg-spacing-03)',
            flexWrap: 'wrap',
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c1)',
            lineHeight: 'var(--rmg-leading-c1)',
          }}
        >
          <span style={{ color: 'var(--rmg-color-text-body)' }}>
            Searching &ldquo;{p.searchQuery}&rdquo; — {p.searchStats.totalMatches} session
            {p.searchStats.totalMatches === 1 ? '' : 's'} across{' '}
            {p.searchStats.groupsWithMatches} group
            {p.searchStats.groupsWithMatches === 1 ? '' : 's'}
            {p.searchStats.groupsHidden > 0
              ? ` · ${p.searchStats.groupsHidden} group${
                  p.searchStats.groupsHidden === 1 ? '' : 's'
                } hidden`
              : ''}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              color: 'var(--rmg-color-grey-1)',
              fontStyle: 'italic',
            }}
          >
            Matches highlighted
          </span>
        </div>
      )}

      {/* Group cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-03)' }}>
        {p.groups.map((g) => (
          <GroupCard
            key={g.id}
            group={g}
            derived={p.groupDerived.get(g.id)!}
            expanded={p.expandedGroups.has(g.id)}
            onToggle={() => p.toggleGroup(g.id)}
            searchQuery={p.searchQuery}
            beyond4Expanded={p.expandedBeyond4.has(g.id)}
            onToggleBeyond4={() => p.toggleBeyond4(g.id)}
          />
        ))}
      </div>

      {/* Bottom note when groups are hidden */}
      {searchActive && p.searchStats && p.searchStats.groupsHidden > 0 && (
        <div
          style={{
            textAlign: 'center',
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c2)',
            color: 'var(--rmg-color-grey-1)',
            marginTop: 'var(--rmg-spacing-03)',
          }}
        >
          {p.searchStats.groupsHidden} group
          {p.searchStats.groupsHidden === 1 ? '' : 's'} hidden · no sessions match
          &ldquo;{p.searchQuery}&rdquo; ·{' '}
          <button
            type="button"
            onClick={() => p.setSearchQuery('')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--rmg-color-red)',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
              fontSize: 'inherit',
              textDecoration: 'underline',
            }}
          >
            clear search
          </button>{' '}
          to show all
        </div>
      )}
    </div>
  )
}

// ── Search box ──────────────────────────────────────────────────────

function SearchBox({
  value,
  onChange,
  focused,
  setFocused,
}: {
  value: string
  onChange: (v: string) => void
  focused: boolean
  setFocused: (v: boolean) => void
}) {
  const active = value.trim().length > 0 || focused
  const iconColour = value.trim().length > 0 ? 'var(--rmg-color-red)' : 'var(--rmg-color-grey-1)'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--rmg-spacing-02)',
        padding: 'var(--rmg-spacing-02) var(--rmg-spacing-03)',
        border: `0.5px solid ${active ? 'var(--rmg-color-red)' : 'var(--rmg-color-grey-2)'}`,
        borderRadius: 'var(--rmg-radius-s)',
        minWidth: 200,
        backgroundColor: 'var(--rmg-color-surface-white)',
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={iconColour}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="search"
        placeholder="Search sessions…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'none',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c1)',
          lineHeight: 'var(--rmg-leading-c1)',
          color: 'var(--rmg-color-text-body)',
        }}
      />
      {value.trim().length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--rmg-color-grey-1)',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ── Filter pill group ──────────────────────────────────────────────

function FilterPillGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ v: string; label: string }>
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--rmg-spacing-02)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c2)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--rmg-color-text-light)',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', gap: 3 }}>
        {options.map((opt) => {
          const active = opt.v === value
          return (
            <button
              key={opt.v}
              type="button"
              onClick={() => onChange(opt.v)}
              style={{
                padding: '3px 10px',
                borderRadius: 'var(--rmg-radius-xl)',
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-c2)',
                fontWeight: active ? 700 : 400,
                color: active ? 'var(--rmg-color-red)' : 'var(--rmg-color-text-body)',
                backgroundColor: active
                  ? 'var(--rmg-color-tint-red)'
                  : 'var(--rmg-color-grey-3)',
                cursor: 'pointer',
                border: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Group card ──────────────────────────────────────────────────────

function GroupCard({
  group,
  derived,
  expanded,
  onToggle,
  searchQuery,
  beyond4Expanded,
  onToggleBeyond4,
}: {
  group: Group
  derived: GroupDerived
  expanded: boolean
  onToggle: () => void
  searchQuery: string
  beyond4Expanded: boolean
  onToggleBeyond4: () => void
}) {
  const searchActive = searchQuery.trim().length > 0
  const isG12 = group.group_number === 12

  // Card border colour: G12 amber > search match red > default grey
  const cardBorderColour = isG12
    ? G12_AMBER.bg
    : searchActive && derived.hasMatches
    ? RED_CARD_BORDER
    : 'var(--rmg-color-grey-2)'

  const opacity = searchActive && derived.hasNoMatches ? 0.35 : 1

  // Sessions to display
  const sourceSessions = searchActive ? derived.searchMatches : derived.filteredSessions
  const overflowCount = sourceSessions.length > 4 && !beyond4Expanded ? sourceSessions.length - 4 : 0
  const visibleSessions = overflowCount > 0 ? sourceSessions.slice(0, 4) : sourceSessions

  const completionPct =
    group.total_planned_sessions > 0
      ? Math.round((derived.completedCount / group.total_planned_sessions) * 100)
      : 0

  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        border: `0.5px solid ${cardBorderColour}`,
        borderRadius: 'var(--rmg-radius-m)',
        opacity,
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
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--rmg-spacing-03)',
          padding: 'var(--rmg-spacing-03) var(--rmg-spacing-04)',
          cursor: 'pointer',
          backgroundColor: isG12 ? G12_AMBER.headerBg : 'transparent',
          borderRadius: 'var(--rmg-radius-m)',
        }}
      >
        <GroupNumberBadge n={group.group_number} isG12={isG12} />

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--rmg-spacing-03)', flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b3)',
              lineHeight: 'var(--rmg-leading-b3)',
              fontWeight: 500,
              color: 'var(--rmg-color-text-body)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {group.group_name}
          </span>
          {group.category && (
            <span
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-c2)',
                lineHeight: 'var(--rmg-leading-c2)',
                color: isG12 ? G12_AMBER.border : 'var(--rmg-color-grey-1)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {group.category}
              {isG12 ? ' · Infrastructure workstream' : ''}
            </span>
          )}
        </div>

        {/* Right meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rmg-spacing-04)', flexShrink: 0 }}>
          {searchActive && derived.hasMatches ? (
            <span
              style={{
                backgroundColor: RED_MATCH_BG,
                color: RED_SOLID,
                borderRadius: 'var(--rmg-radius-xl)',
                fontSize: 'var(--rmg-text-c2)',
                lineHeight: 'var(--rmg-leading-c2)',
                padding: '2px 10px',
                fontFamily: 'var(--rmg-font-body)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {derived.searchMatches.length} of {derived.filteredSessions.length} match
            </span>
          ) : !searchActive ? (
            <>
              <span
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 'var(--rmg-text-c2)',
                  color: 'var(--rmg-color-grey-1)',
                  whiteSpace: 'nowrap',
                }}
              >
                {group.total_planned_sessions} session
                {group.total_planned_sessions === 1 ? '' : 's'}
              </span>
              {group.total_planned_hours != null && (
                <span
                  style={{
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 'var(--rmg-text-c2)',
                    color: 'var(--rmg-color-grey-1)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {group.total_planned_hours} hrs
                </span>
              )}
              <div
                style={{
                  width: 60,
                  height: 4,
                  borderRadius: 100,
                  backgroundColor: 'var(--rmg-color-grey-3)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${completionPct}%`,
                    height: '100%',
                    backgroundColor: 'var(--rmg-color-red)',
                    borderRadius: 100,
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 'var(--rmg-text-c2)',
                  color: 'var(--rmg-color-grey-1)',
                  whiteSpace: 'nowrap',
                  minWidth: 28,
                  textAlign: 'right',
                }}
              >
                {completionPct}%
              </span>
            </>
          ) : null}

          {/* Lead chips — always shown */}
          <div style={{ display: 'flex', gap: -6 }}>
            {derived.leads.map((lead, i) => (
              <LeadChip key={lead.id} lead={lead} isG12={isG12} offset={i} />
            ))}
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
              transition: 'transform 150ms ease',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            ▶
          </span>
        </div>
      </div>

      {/* Expanded: session list */}
      {expanded && (
        <div
          style={{
            borderTop: '0.5px solid var(--rmg-color-grey-2)',
            padding: 'var(--rmg-spacing-02) var(--rmg-spacing-04) var(--rmg-spacing-03)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--rmg-spacing-02)',
          }}
        >
          {visibleSessions.length === 0 ? (
            <div
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-c2)',
                color: 'var(--rmg-color-grey-1)',
                textAlign: 'center',
                padding: 'var(--rmg-spacing-03) 0',
              }}
            >
              No sessions match the current filters.
            </div>
          ) : (
            visibleSessions.map((s) => (
              <SessionRow key={s.id} session={s} searchQuery={searchQuery} />
            ))
          )}

          {overflowCount > 0 && (
            <button
              type="button"
              onClick={onToggleBeyond4}
              style={{
                background: 'none',
                border: 'none',
                padding: 'var(--rmg-spacing-02) 0',
                textAlign: 'left',
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-c2)',
                color: 'var(--rmg-color-grey-1)',
                cursor: 'pointer',
              }}
            >
              + {overflowCount} more session{overflowCount === 1 ? '' : 's'} →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Group number badge ─────────────────────────────────────────────

function GroupNumberBadge({ n, isG12 }: { n: number; isG12: boolean }) {
  const base: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: 'var(--rmg-text-c2)',
    lineHeight: 1,
    borderRadius: 'var(--rmg-radius-xs)',
    padding: '2px 6px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }
  if (isG12) {
    return (
      <span
        style={{
          ...base,
          backgroundColor: G12_AMBER.bg,
          color: G12_AMBER.fg,
          border: `0.5px solid ${G12_AMBER.border}`,
        }}
      >
        GROUP {n}
      </span>
    )
  }
  return (
    <span
      style={{
        ...base,
        backgroundColor: 'var(--rmg-color-grey-4)',
        color: 'var(--rmg-color-text-body)',
        border: '0.5px solid var(--rmg-color-grey-2)',
      }}
    >
      GROUP {n}
    </span>
  )
}

// ── Lead chip (initials circle) ────────────────────────────────────

function LeadChip({
  lead,
  isG12,
  offset,
}: {
  lead: { id: string; name: string; supplier: SupplierRef | null }
  isG12: boolean
  offset: number
}) {
  const colour = supplierColour(lead.supplier)
  const bg = isG12 ? G12_AMBER.bg : `${colour}26`
  const text = isG12 ? G12_AMBER.fg : colour
  const border = isG12 ? G12_AMBER.border : colour
  return (
    <span
      title={lead.name}
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        backgroundColor: bg,
        color: text,
        border: `1px solid ${border}`,
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 9,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: offset === 0 ? 0 : -6,
        flexShrink: 0,
      }}
    >
      {getInitials(lead.name)}
    </span>
  )
}

// ── Session row ────────────────────────────────────────────────────

function SessionRow({
  session,
  searchQuery,
}: {
  session: KtSession
  searchQuery: string
}) {
  const teamStyle = TEAM_STYLES[session.team] ?? TEAM_STYLES.SHARED
  const isCompleted = session.status === 'COMPLETED'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--rmg-spacing-03)',
        padding: 'var(--rmg-spacing-02) 0',
      }}
    >
      {/* 3px left accent bar */}
      <div
        style={{
          width: 3,
          height: 28,
          borderRadius: 2,
          backgroundColor: teamStyle.text,
          flexShrink: 0,
        }}
      />

      {/* Name + focus area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c1)',
            lineHeight: 'var(--rmg-leading-c1)',
            fontWeight: 500,
            color: 'var(--rmg-color-text-body)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {highlightText(session.session_name, searchQuery)}
        </div>
        {session.focus_area && (
          <div
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-c2)',
              lineHeight: 'var(--rmg-leading-c2)',
              color: 'var(--rmg-color-grey-1)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {highlightText(session.focus_area, searchQuery)}
          </div>
        )}
      </div>

      {/* Team badge */}
      <span
        style={{
          backgroundColor: teamStyle.bg,
          color: teamStyle.text,
          borderRadius: 'var(--rmg-radius-xl)',
          padding: '2px 8px',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c2)',
          lineHeight: 'var(--rmg-leading-c2)',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {session.team === 'SERVICE' ? 'Service' : 'Shared'}
      </span>

      {/* Playback badge */}
      {session.is_playback && (
        <span
          style={{
            backgroundColor: PLAYBACK_BG,
            color: PLAYBACK_FG,
            borderRadius: 'var(--rmg-radius-xl)',
            padding: '2px 8px',
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c2)',
            lineHeight: 'var(--rmg-leading-c2)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          PLAYBACK
        </span>
      )}

      {/* Status badge */}
      <span
        style={{
          backgroundColor: isCompleted ? 'var(--rmg-color-tint-green)' : 'var(--rmg-color-grey-4)',
          color: isCompleted ? 'var(--rmg-color-green-contrast)' : 'var(--rmg-color-grey-1)',
          borderRadius: 'var(--rmg-radius-xl)',
          padding: '2px 8px',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c2)',
          lineHeight: 'var(--rmg-leading-c2)',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {statusLabel(session.status)}
      </span>

      {/* Duration */}
      <span
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c2)',
          lineHeight: 'var(--rmg-leading-c2)',
          color: 'var(--rmg-color-grey-1)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          minWidth: 40,
          textAlign: 'right',
        }}
      >
        {session.duration_hrs != null ? `${session.duration_hrs} hrs` : '—'}
      </span>
    </div>
  )
}

function statusLabel(status: KtSession['status']): string {
  switch (status) {
    case 'SCHEDULED':
      return 'Scheduled'
    case 'COMPLETED':
      return 'Completed'
    case 'CANCELLED':
      return 'Cancelled'
    case 'RESCHEDULED':
      return 'Rescheduled'
  }
}

function CalendarEmptyState() {
  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        border: '0.5px solid var(--rmg-color-grey-2)',
        borderRadius: 'var(--rmg-radius-m)',
        padding: 'var(--rmg-spacing-10) var(--rmg-spacing-07)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 'var(--rmg-spacing-04)',
      }}
    >
      {/* Calendar icon */}
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--rmg-color-grey-1)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>

      <div
        style={{
          fontFamily: 'var(--rmg-font-display)',
          fontSize: 'var(--rmg-text-h4)',
          lineHeight: 'var(--rmg-leading-h4)',
          color: 'var(--rmg-color-text-heading)',
          fontWeight: 700,
        }}
      >
        Session calendar
      </div>

      <p
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-b3)',
          lineHeight: 'var(--rmg-leading-b3)',
          color: 'var(--rmg-color-grey-1)',
          maxWidth: 480,
          margin: 0,
        }}
      >
        Session dates are not yet available. TCS provide dates on a rolling
        2–3 week basis — this view will populate as sessions are scheduled.
      </p>

      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c1)',
          lineHeight: 'var(--rmg-leading-c1)',
          color: 'var(--rmg-color-grey-1)',
          backgroundColor: 'var(--rmg-color-grey-3)',
          borderRadius: 'var(--rmg-radius-xl)',
          padding: '2px 10px',
          fontWeight: 600,
        }}
      >
        0 of 125 sessions have dates
      </span>
    </div>
  )
}
