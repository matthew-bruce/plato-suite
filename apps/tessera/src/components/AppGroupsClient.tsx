'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Group, KtSession, ResourceRef, SupplierRef } from '@/app/groups/page'
import { getSupplierColour, TRACK_COLOURS, STATUS_COLOURS } from '@plato/ui/tokens'
import { highlightMatch } from '@/lib/highlightMatch'

// ── Types ────────────────────────────────────────────────────────────

type StatusFilter = 'ALL' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

type GroupDerived = {
  allSessions: KtSession[]
  filteredSessions: KtSession[]
  searchMatches: KtSession[]
  completedCount: number
  hasMatches: boolean
  hasNoMatches: boolean
  leads: Array<{ id: string; name: string; supplier: SupplierRef | null }>
  headerColour: string
}

interface AppGroupsClientProps {
  groups: Group[]
  sessions: KtSession[]
  supplierMap: Record<string, string>
}

// ── Helpers ──────────────────────────────────────────────────────────

function unwrap<T>(x: T | T[] | null | undefined): T | null {
  if (!x) return null
  return Array.isArray(x) ? (x[0] ?? null) : x
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function statusLabel(status: KtSession['status']): string {
  switch (status) {
    case 'SCHEDULED':   return 'Scheduled'
    case 'COMPLETED':   return 'Completed'
    case 'CANCELLED':   return 'Cancelled'
    case 'RESCHEDULED': return 'In Progress'
    case 'IN_PROGRESS': return 'In Progress'
  }
}

function statusColour(status: KtSession['status']): string {
  if (status === 'RESCHEDULED') return STATUS_COLOURS.IN_PROGRESS
  return STATUS_COLOURS[status as keyof typeof STATUS_COLOURS] ?? STATUS_COLOURS.SCHEDULED
}

function matchesStatusFilter(s: KtSession, f: StatusFilter): boolean {
  if (f === 'ALL') return true
  if (f === 'IN_PROGRESS') return s.status === 'IN_PROGRESS' || s.status === 'RESCHEDULED'
  return s.status === f
}

// ── Ghost button ─────────────────────────────────────────────────────

function GhostButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--rmg-color-text-body)',
        background: 'transparent',
        border: '2px solid var(--rmg-color-grey-2)',
        borderRadius: 'var(--rmg-radius-m)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// ── Section 3D filter pill ────────────────────────────────────────────

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '3px 10px',
        borderRadius: 'var(--rmg-radius-xl)',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 'var(--rmg-text-c2)',
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--rmg-color-red)' : 'var(--rmg-color-text-body)',
        backgroundColor: active ? 'var(--rmg-color-tint-red)' : 'var(--rmg-color-surface-white)',
        border: active
          ? '1.5px solid var(--rmg-color-red)'
          : '1.5px solid var(--rmg-color-grey-2)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// ── Lead chip (initials circle) ───────────────────────────────────────

function LeadChip({
  lead,
  offset,
  supplierMap,
}: {
  lead: { id: string; name: string; supplier: SupplierRef | null }
  offset: number
  supplierMap: Record<string, string>
}) {
  const colour = lead.supplier
    ? getSupplierColour(lead.supplier.supplier_abbreviation, supplierMap)
    : '#8F9495'
  return (
    <span
      title={lead.name}
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        backgroundColor: `${colour}26`,
        color: colour,
        border: `1px solid ${colour}`,
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

export function AppGroupsClient({ groups, sessions, supplierMap }: AppGroupsClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedBeyond4, setExpandedBeyond4] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'progress' | 'calendar'>('progress')

  const groupDerived = useMemo(() => {
    const map = new Map<string, GroupDerived>()
    const q = searchQuery.trim().toLowerCase()

    for (const g of groups) {
      const allSessions = sessions.filter((s) => s.app_group_id === g.id)
      const filtered = allSessions.filter((s) => matchesStatusFilter(s, statusFilter))
      const searchMatches = q
        ? filtered.filter(
            (s) =>
              s.session_name.toLowerCase().includes(q) ||
              (s.focus_area?.toLowerCase().includes(q) ?? false),
          )
        : filtered

      const completedCount = filtered.filter((s) => s.status === 'COMPLETED').length

      const leads: GroupDerived['leads'] = []
      for (const row of g.tessera_app_group_resources ?? []) {
        if (row.role !== 'LEAD') continue
        const r: ResourceRef | null = unwrap(row.resources)
        if (!r) continue
        leads.push({ id: r.resource_id, name: r.resource_name, supplier: unwrap(r.suppliers) })
      }

      const firstSupplier = leads[0]?.supplier
      const headerColour = firstSupplier
        ? getSupplierColour(firstSupplier.supplier_abbreviation, supplierMap)
        : 'var(--rmg-color-grey-3)'

      map.set(g.id, {
        allSessions,
        filteredSessions: filtered,
        searchMatches,
        completedCount,
        hasMatches: q.length > 0 && searchMatches.length > 0,
        hasNoMatches: q.length > 0 && searchMatches.length === 0,
        leads,
        headerColour,
      })
    }
    return map
  }, [groups, sessions, statusFilter, searchQuery, supplierMap])

  useEffect(() => {
    if (!searchQuery.trim()) return
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      for (const g of groups) {
        if (groupDerived.get(g.id)?.hasMatches) next.add(g.id)
      }
      return next
    })
  }, [searchQuery, groupDerived, groups])

  const searchStats = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return null
    let totalMatches = 0
    let groupsWithMatches = 0
    let groupsHidden = 0
    for (const g of groups) {
      const d = groupDerived.get(g.id)
      if (!d) continue
      if (d.hasMatches) { groupsWithMatches += 1; totalMatches += d.searchMatches.length }
      else groupsHidden += 1
    }
    return { totalMatches, groupsWithMatches, groupsHidden }
  }, [searchQuery, groupDerived, groups])

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const visibleGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups
    return groups.filter((g) => {
      const d = groupDerived.get(g.id)
      return (
        g.group_name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        (d?.hasMatches ?? false)
      )
    })
  }, [groups, groupDerived, searchQuery])

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .appgroups-content { display: none !important; }
          .appgroups-mobile { display: flex !important; }
        }
      `}</style>

      {/* Mobile guard */}
      <div
        className="appgroups-mobile"
        style={{
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          backgroundColor: 'var(--rmg-color-surface-white)',
          borderRadius: 'var(--rmg-radius-m)',
          boxShadow: 'var(--rmg-shadow-card)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 12,
            color: 'var(--rmg-color-grey-1)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          App Groups is best viewed on a larger screen.
        </p>
      </div>

      {/* Main content */}
      <div
        className="appgroups-content"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-04)' }}
      >
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--rmg-color-grey-3)' }}>
          {(['progress', 'calendar'] as const).map((t) => {
            const active = activeTab === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 'var(--rmg-text-b3)',
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
                  textTransform: 'capitalize',
                }}
              >
                {t === 'progress' ? 'Progress' : 'Calendar'}
              </button>
            )
          })}
        </div>

        {activeTab === 'progress' ? (
          <ProgressTab
            groups={groups}
            visibleGroups={visibleGroups}
            groupDerived={groupDerived}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchFocused={searchFocused}
            setSearchFocused={setSearchFocused}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            expandedGroups={expandedGroups}
            toggleGroup={toggleGroup}
            expandedBeyond4={expandedBeyond4}
            setExpandedBeyond4={setExpandedBeyond4}
            searchStats={searchStats}
            onExpandAll={() => setExpandedGroups(new Set(groups.map((g) => g.id)))}
            onCollapseAll={() => setExpandedGroups(new Set())}
            supplierMap={supplierMap}
          />
        ) : (
          <CalendarEmptyState />
        )}
      </div>
    </>
  )
}

// ── Progress tab ──────────────────────────────────────────────────────

interface ProgressTabProps {
  groups: Group[]
  visibleGroups: Group[]
  groupDerived: Map<string, GroupDerived>
  searchQuery: string
  setSearchQuery: (v: string) => void
  searchFocused: boolean
  setSearchFocused: (v: boolean) => void
  statusFilter: StatusFilter
  setStatusFilter: (v: StatusFilter) => void
  expandedGroups: Set<string>
  toggleGroup: (id: string) => void
  expandedBeyond4: Set<string>
  setExpandedBeyond4: React.Dispatch<React.SetStateAction<Set<string>>>
  searchStats: { totalMatches: number; groupsWithMatches: number; groupsHidden: number } | null
  onExpandAll: () => void
  onCollapseAll: () => void
  supplierMap: Record<string, string>
}

function ProgressTab(p: ProgressTabProps) {
  const searchActive = p.searchQuery.trim().length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-03)' }}>
      {/* Filter bar — Section 11 */}
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
        {/* Search icon + input */}
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke={searchActive ? 'var(--rmg-color-red)' : 'var(--rmg-color-grey-1)'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          placeholder="Search groups or sessions…"
          value={p.searchQuery}
          onChange={(e) => p.setSearchQuery(e.target.value)}
          onFocus={() => p.setSearchFocused(true)}
          onBlur={() => p.setSearchFocused(false)}
          style={{
            flex: 1,
            minWidth: 200,
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 14,
            color: 'var(--rmg-color-text-body)',
            background: 'transparent',
          }}
        />
        {/* Divider */}
        <div style={{ width: 1, height: 18, backgroundColor: 'var(--rmg-color-grey-2)', flexShrink: 0 }} />
        {/* Status pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.07em', color: 'var(--rmg-color-grey-1)',
            fontFamily: 'var(--rmg-font-body)',
          }}>
            Status
          </span>
          {(['ALL', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as StatusFilter[]).map((v) => (
            <FilterPill
              key={v}
              label={v === 'ALL' ? 'All' : v === 'IN_PROGRESS' ? 'In Progress' : v.charAt(0) + v.slice(1).toLowerCase()}
              active={p.statusFilter === v}
              onClick={() => p.setStatusFilter(v)}
            />
          ))}
        </div>
        {/* Result count */}
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'monospace',
          fontSize: 12,
          color: 'var(--rmg-color-grey-1)',
          flexShrink: 0,
        }}>
          {p.visibleGroups.length} group{p.visibleGroups.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Expand / Collapse all */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <GhostButton label="Expand all" onClick={p.onExpandAll} />
        <GhostButton label="Collapse all" onClick={p.onCollapseAll} />
      </div>

      {/* Search stats bar */}
      {searchActive && p.searchStats && (
        <div style={{
          backgroundColor: 'rgba(218,32,42,0.06)',
          border: '0.5px solid rgba(218,32,42,0.20)',
          borderRadius: 'var(--rmg-radius-s)',
          padding: 'var(--rmg-spacing-02) var(--rmg-spacing-03)',
          display: 'flex', alignItems: 'center', gap: 'var(--rmg-spacing-03)',
          flexWrap: 'wrap',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c1)',
        }}>
          <span style={{ color: 'var(--rmg-color-text-body)' }}>
            Searching &ldquo;{p.searchQuery}&rdquo; — {p.searchStats.totalMatches} session
            {p.searchStats.totalMatches === 1 ? '' : 's'} across {p.searchStats.groupsWithMatches} group
            {p.searchStats.groupsWithMatches === 1 ? '' : 's'}
            {p.searchStats.groupsHidden > 0 ? ` · ${p.searchStats.groupsHidden} group${p.searchStats.groupsHidden === 1 ? '' : 's'} hidden` : ''}
          </span>
          <span style={{ marginLeft: 'auto', color: 'var(--rmg-color-grey-1)', fontStyle: 'italic' }}>
            Matches highlighted
          </span>
        </div>
      )}

      {/* Group cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {p.visibleGroups.length === 0 ? (
          <div style={{
            marginTop: 60, textAlign: 'center',
            fontFamily: 'var(--rmg-font-body)', fontSize: 14,
            color: 'var(--rmg-color-grey-1)',
          }}>
            No groups match the current search.
          </div>
        ) : (
          p.visibleGroups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              derived={p.groupDerived.get(g.id)!}
              expanded={p.expandedGroups.has(g.id)}
              onToggle={() => p.toggleGroup(g.id)}
              searchQuery={p.searchQuery}
              beyond4Expanded={p.expandedBeyond4.has(g.id)}
              onToggleBeyond4={() =>
                p.setExpandedBeyond4((prev) => {
                  const next = new Set(prev)
                  next.has(g.id) ? next.delete(g.id) : next.add(g.id)
                  return next
                })
              }
              supplierMap={p.supplierMap}
            />
          ))
        )}
      </div>

      {/* Hidden-groups note */}
      {searchActive && p.searchStats && p.searchStats.groupsHidden > 0 && (
        <div style={{
          textAlign: 'center',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c2)',
          color: 'var(--rmg-color-grey-1)',
          marginTop: 'var(--rmg-spacing-03)',
        }}>
          {p.searchStats.groupsHidden} group{p.searchStats.groupsHidden === 1 ? '' : 's'} hidden · no sessions match &ldquo;{p.searchQuery}&rdquo; ·{' '}
          <button
            type="button"
            onClick={() => p.setSearchQuery('')}
            style={{
              background: 'none', border: 'none',
              color: 'var(--rmg-color-red)', cursor: 'pointer',
              padding: 0, fontFamily: 'inherit', fontSize: 'inherit',
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

// ── Group card ────────────────────────────────────────────────────────

function GroupCard({
  group,
  derived,
  expanded,
  onToggle,
  searchQuery,
  beyond4Expanded,
  onToggleBeyond4,
  supplierMap,
}: {
  group: Group
  derived: GroupDerived
  expanded: boolean
  onToggle: () => void
  searchQuery: string
  beyond4Expanded: boolean
  onToggleBeyond4: () => void
  supplierMap: Record<string, string>
}) {
  const [headerHovered, setHeaderHovered] = useState(false)
  const searchActive = searchQuery.trim().length > 0
  const sourceSessions = searchActive ? derived.searchMatches : derived.filteredSessions
  const overflowCount = sourceSessions.length > 4 && !beyond4Expanded ? sourceSessions.length - 4 : 0
  const visibleSessions = overflowCount > 0 ? sourceSessions.slice(0, 4) : sourceSessions
  const completionPct = group.total_planned_sessions > 0
    ? Math.round((derived.completedCount / group.total_planned_sessions) * 100)
    : 0

  return (
    <div style={{
      backgroundColor: 'var(--rmg-color-surface-white)',
      borderRadius: 'var(--rmg-radius-m)',
      boxShadow: 'var(--rmg-shadow-card)',
      overflow: 'hidden',
      opacity: searchActive && derived.hasNoMatches ? 0.35 : 1,
      transition: 'opacity 150ms ease',
    }}>
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle() }}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 20px',
          cursor: 'pointer',
          borderLeft: `4px solid ${derived.headerColour}`,
          backgroundColor: headerHovered ? 'var(--rmg-color-grey-4)' : 'transparent',
          outline: 'none',
        }}
      >
        {/* Group number chip */}
        <span style={{
          fontFamily: 'monospace',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--rmg-color-grey-1)',
          backgroundColor: 'var(--rmg-color-grey-4)',
          borderRadius: 'var(--rmg-radius-xs)',
          padding: '2px 7px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          G{group.group_number}
        </span>

        {/* Name + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--rmg-color-text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {highlightMatch(group.group_name, searchQuery)}
          </div>
          {group.category && (
            <div style={{ fontSize: 12, color: 'var(--rmg-color-text-light)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {group.category}
            </div>
          )}
        </div>

        {/* Right: stats or search match count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {searchActive && derived.hasMatches ? (
            <span style={{
              backgroundColor: 'rgba(218,32,42,0.10)',
              color: '#DA202A',
              borderRadius: 'var(--rmg-radius-xl)',
              fontSize: 'var(--rmg-text-c2)',
              padding: '2px 10px',
              fontFamily: 'var(--rmg-font-body)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              {derived.searchMatches.length} of {derived.filteredSessions.length} match
            </span>
          ) : !searchActive ? (
            <>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--rmg-font-body)', fontSize: 13, fontWeight: 700, color: 'var(--rmg-color-text-heading)', whiteSpace: 'nowrap' }}>
                  {derived.completedCount}/{group.total_planned_sessions} sessions
                </div>
                {group.total_planned_hours != null && (
                  <div style={{ fontFamily: 'var(--rmg-font-body)', fontSize: 12, color: 'var(--rmg-color-text-light)', whiteSpace: 'nowrap' }}>
                    {group.total_planned_hours} hrs
                  </div>
                )}
              </div>
              <div style={{ width: 60, height: 4, borderRadius: 100, backgroundColor: 'var(--rmg-color-grey-3)', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${completionPct}%`, height: '100%', backgroundColor: 'var(--rmg-color-red)', borderRadius: 100 }} />
              </div>
            </>
          ) : null}

          {/* Lead chips */}
          <div style={{ display: 'flex' }}>
            {derived.leads.map((lead, i) => (
              <LeadChip key={lead.id} lead={lead} offset={i} supplierMap={supplierMap} />
            ))}
          </div>

          {/* Chevron */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 16, color: 'var(--rmg-color-grey-1)', fontSize: 10,
            transition: 'transform 200ms ease',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* Session list */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--rmg-color-grey-3)' }}>
          {visibleSessions.length === 0 ? (
            <div style={{
              fontFamily: 'var(--rmg-font-body)', fontSize: 'var(--rmg-text-c2)',
              color: 'var(--rmg-color-grey-1)', textAlign: 'center',
              padding: 'var(--rmg-spacing-04) 0',
            }}>
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
                display: 'block', width: '100%',
                background: 'none', border: 'none',
                padding: '10px 20px', textAlign: 'left',
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-c2)',
                color: 'var(--rmg-color-grey-1)', cursor: 'pointer',
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

// ── Session row ───────────────────────────────────────────────────────

function SessionRow({
  session,
  searchQuery,
}: {
  session: KtSession
  searchQuery: string
}) {
  const [hovered, setHovered] = useState(false)
  const trackColour = session.track
    ? TRACK_COLOURS[session.track]
    : 'var(--rmg-color-grey-3)'
  const typeLabel = session.is_playback ? 'Playback' : 'KT Only'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 20px',
        borderBottom: '1px solid var(--rmg-color-grey-3)',
        backgroundColor: hovered ? 'var(--rmg-color-grey-4)' : 'transparent',
        cursor: 'pointer',
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
        <div style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--rmg-color-text-heading)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {highlightMatch(session.session_name, searchQuery)}
        </div>
        <div style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 12,
          color: 'var(--rmg-color-text-light)',
          marginTop: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {typeLabel}
          {session.duration_hrs != null ? ` · ${session.duration_hrs} hrs` : ''}
        </div>
      </div>

      {/* Lead name — plain text */}
      {session.lead_name && (
        <div style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 12,
          color: 'var(--rmg-color-grey-1)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {session.lead_name}
        </div>
      )}

      {/* Duration */}
      <div style={{
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--rmg-color-text-body)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        minWidth: 36,
        textAlign: 'right',
      }}>
        {session.duration_hrs != null ? `${session.duration_hrs}h` : '—'}
      </div>

      {/* Status badge — Section 3C solid fill */}
      <span style={{
        borderRadius: 'var(--rmg-radius-xl)',
        padding: '2px 10px',
        backgroundColor: statusColour(session.status),
        color: 'white',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        fontFamily: 'var(--rmg-font-body)',
      }}>
        {statusLabel(session.status)}
      </span>
    </div>
  )
}

// ── Calendar empty state ──────────────────────────────────────────────

function CalendarEmptyState() {
  return (
    <div style={{
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
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
        stroke="var(--rmg-color-grey-1)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <div style={{
        fontFamily: 'var(--rmg-font-display)',
        fontSize: 'var(--rmg-text-h4)',
        lineHeight: 'var(--rmg-leading-h4)',
        color: 'var(--rmg-color-text-heading)',
        fontWeight: 700,
      }}>
        Session calendar
      </div>
      <p style={{
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 'var(--rmg-text-b3)',
        lineHeight: 'var(--rmg-leading-b3)',
        color: 'var(--rmg-color-grey-1)',
        maxWidth: 480, margin: 0,
      }}>
        Session dates are not yet available. TCS provide dates on a rolling
        2–3 week basis — this view will populate as sessions are scheduled.
      </p>
      <span style={{
        display: 'inline-flex', alignItems: 'center',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 'var(--rmg-text-c1)',
        color: 'var(--rmg-color-grey-1)',
        backgroundColor: 'var(--rmg-color-grey-3)',
        borderRadius: 'var(--rmg-radius-xl)',
        padding: '2px 10px',
        fontWeight: 600,
      }}>
        0 of 125 sessions have dates
      </span>
    </div>
  )
}
