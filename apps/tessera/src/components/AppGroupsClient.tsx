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

  void expandedBeyond4
  void toggleBeyond4
  void highlightText
  void getInitials
  void supplierColour
  void TEAM_STYLES
  void PLAYBACK_BG
  void PLAYBACK_FG
  void RED_BAR_BG
  void RED_BAR_BORDER
  void RED_MATCH_BG
  void RED_CARD_BORDER
  void G12_AMBER
  void searchStats
  void allExpanded
  void toggleGroup
  void toggleExpandAll
  void setSearchFocused
  void searchFocused

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
        <div>Progress tab coming next…</div>
      ) : (
        <CalendarEmptyState />
      )}
    </div>
  )
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
