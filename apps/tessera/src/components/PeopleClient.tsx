'use client'

import { useMemo, useState } from 'react'
import type {
  Resource,
  SupplierInfo,
  LeadRow,
  SessionRef,
} from '@/app/people/page'

// ── Supplier brand colours (sourced from suppliers table) ──────────
const SUPPLIER_COLOURS: Record<string, string> = {
  CG: '#003C82', // Capgemini cobalt
  TCS: '#9B0A6E', // TCS magenta
  RMG: '#E2001A', // Royal Mail red
  HT: '#FF8C00', // Happy Team orange
  NH: '#1A2B5B', // North Highland navy
  EPAM: '#3D3D3D', // EPAM charcoal
}

// ── resource_function stream colours ──────────────────────────────
const STREAM_COLOURS: Record<string, string> = {
  FACTORY:    '#003C82',
  SERVICE:    '#9B0A6E',
  PROGRAMME:  '#E2001A',
  COMMERCIAL: '#F3920D',
  MIGRATION:  '#3ABFB8',
  CLOUD_OPS:  '#1976F2',
}

type ViewMode = 'list' | 'by-role' | 'by-supplier'
type SortColumn =
  | 'resource_name'
  | 'resource_years_experience'
  | 'resource_job_title'
type SortDirection = 'asc' | 'desc'

interface PeopleClientProps {
  resources: Resource[]
  leadRows: LeadRow[]
}

function getSupplier(s: Resource['suppliers']): SupplierInfo | null {
  if (!s) return null
  return Array.isArray(s) ? (s[0] ?? null) : s
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

// ── Grid templates per view mode ───────────────────────────────────
const GRID: Record<ViewMode, string> = {
  list:          '1fr 160px 80px 100px 52px 52px',
  'by-role':     '1fr 80px 100px 52px 52px',
  'by-supplier': '1fr 160px 100px 52px 52px',
}

function TableHeader({
  viewMode,
  sortColumn,
  sortDirection,
  onSort,
}: {
  viewMode: ViewMode
  sortColumn: SortColumn
  sortDirection: SortDirection
  onSort: (col: SortColumn) => void
}) {
  const colLabel: React.CSSProperties = {
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 'var(--rmg-text-c2)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--rmg-color-text-light)',
    whiteSpace: 'nowrap',
  }

  function SortBtn({ label, col }: { label: string; col: SortColumn }) {
    const active = sortColumn === col
    return (
      <button
        type="button"
        onClick={() => onSort(col)}
        style={{
          ...colLabel,
          color: active ? 'var(--rmg-color-red)' : 'var(--rmg-color-text-light)',
          cursor: 'pointer',
          border: 'none',
          background: 'none',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {label}
        {active ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: GRID[viewMode],
        gap: 'var(--rmg-spacing-04)',
        padding: 'var(--rmg-spacing-03) var(--rmg-spacing-05)',
        borderBottom: '1px solid var(--rmg-color-grey-3)',
        alignItems: 'center',
      }}
    >
      <SortBtn label="Name" col="resource_name" />
      {viewMode !== 'by-role' && <SortBtn label="Role" col="resource_job_title" />}
      {viewMode !== 'by-supplier' && <span style={colLabel}>Supplier</span>}
      <span style={colLabel}>Location</span>
      <SortBtn label="Exp" col="resource_years_experience" />
      <span style={colLabel}>KT</span>
    </div>
  )
}

function ResourceRow({
  resource,
  viewMode,
  selectedResourceId,
  onSelect,
  leadSessionMap,
}: {
  resource: Resource
  viewMode: ViewMode
  selectedResourceId: string | null
  onSelect: (id: string | null) => void
  leadSessionMap: Map<string, SessionRef[]>
}) {
  const supplier = getSupplier(resource.suppliers)
  const colour = supplier
    ? (SUPPLIER_COLOURS[supplier.supplier_abbreviation] ?? '#8F9495')
    : '#8F9495'
  const sessionCount = leadSessionMap.get(resource.resource_id)?.length ?? 0
  const isSelected = selectedResourceId === resource.resource_id

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(isSelected ? null : resource.resource_id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ')
          onSelect(isSelected ? null : resource.resource_id)
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: GRID[viewMode],
        gap: 'var(--rmg-spacing-04)',
        padding: 'var(--rmg-spacing-03) var(--rmg-spacing-05)',
        alignItems: 'center',
        cursor: 'pointer',
        backgroundColor: isSelected ? '#DA202A04' : 'transparent',
        borderLeft: isSelected ? '2px solid #DA202A' : '2px solid transparent',
        borderBottom: '1px solid var(--rmg-color-grey-3)',
      }}
    >
      {/* Name + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rmg-spacing-03)', minWidth: 0 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            backgroundColor: `${colour}26`,
            color: colour,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--rmg-font-body)',
            fontSize: '11px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {getInitials(resource.resource_name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b3)',
              color: 'var(--rmg-color-text-body)',
              fontWeight: isSelected ? 700 : 400,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {resource.resource_name}
          </div>
          {resource.resource_function && (
            <div
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-c2)',
                color: 'var(--rmg-color-text-light)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {resource.resource_function}
            </div>
          )}
        </div>
      </div>

      {/* Role — list + by-supplier views */}
      {viewMode !== 'by-role' && (
        <span
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c2)',
            color: 'var(--rmg-color-text-body)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {resource.resource_job_title ?? '—'}
        </span>
      )}

      {/* Supplier badge — list + by-role views */}
      {viewMode !== 'by-supplier' && (
        supplier ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              alignSelf: 'center',
              padding: '2px 8px',
              borderRadius: 'var(--rmg-radius-xl)',
              border: `1px solid ${colour}`,
              backgroundColor: `${colour}26`,
              color: colour,
              fontFamily: 'monospace',
              fontSize: '10px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {supplier.supplier_abbreviation}
          </span>
        ) : (
          <span style={{ color: 'var(--rmg-color-text-light)', fontSize: 'var(--rmg-text-c2)' }}>—</span>
        )
      )}

      {/* Location */}
      <span
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c2)',
          color: 'var(--rmg-color-text-light)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {resource.resource_location ?? '—'}
      </span>

      {/* Experience */}
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 'var(--rmg-text-c2)',
          color: 'var(--rmg-color-text-body)',
          whiteSpace: 'nowrap',
        }}
      >
        {resource.resource_years_experience != null
          ? `${resource.resource_years_experience}y`
          : '—'}
      </span>

      {/* KT session count */}
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 'var(--rmg-text-c2)',
          color: sessionCount > 0 ? 'var(--rmg-color-red)' : 'var(--rmg-color-text-light)',
          fontWeight: sessionCount > 0 ? 700 : 400,
          whiteSpace: 'nowrap',
        }}
      >
        {sessionCount > 0 ? String(sessionCount) : '—'}
      </span>
    </div>
  )
}

interface SectionProps {
  resources: Resource[]
  collapsedSections: Set<string>
  onToggle: (key: string) => void
  selectedResourceId: string | null
  onSelect: (id: string | null) => void
  leadSessionMap: Map<string, SessionRef[]>
}

function ByRoleSection({
  resources,
  collapsedSections,
  onToggle,
  selectedResourceId,
  onSelect,
  leadSessionMap,
}: SectionProps) {
  const groups = useMemo(() => {
    const map = new Map<string, Resource[]>()
    for (const r of resources) {
      const key = r.resource_job_title ?? 'No Role'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [resources])

  return (
    <>
      {groups.map(([role, members]) => {
        const isCollapsed = collapsedSections.has(role)
        return (
          <div key={role}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onToggle(role)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(role) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--rmg-spacing-03)',
                padding: 'var(--rmg-spacing-02) var(--rmg-spacing-05)',
                cursor: 'pointer',
                borderBottom: '1px solid var(--rmg-color-grey-3)',
                backgroundColor: 'var(--rmg-color-surface-light)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 'var(--rmg-text-c2)',
                  fontWeight: 700,
                  color: 'var(--rmg-color-text-body)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {role}
              </span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 'var(--rmg-text-c2)',
                  color: 'var(--rmg-color-text-light)',
                  marginLeft: 'auto',
                }}
              >
                {members.length}
              </span>
              <span style={{ fontSize: 10, color: 'var(--rmg-color-text-light)' }}>
                {isCollapsed ? '▸' : '▾'}
              </span>
            </div>
            {!isCollapsed &&
              members.map((r) => (
                <ResourceRow
                  key={r.resource_id}
                  resource={r}
                  viewMode="by-role"
                  selectedResourceId={selectedResourceId}
                  onSelect={onSelect}
                  leadSessionMap={leadSessionMap}
                />
              ))}
          </div>
        )
      })}
    </>
  )
}

function BySupplierSection({
  resources,
  collapsedSections,
  onToggle,
  selectedResourceId,
  onSelect,
  leadSessionMap,
}: SectionProps) {
  const groups = useMemo(() => {
    const map = new Map<string, Resource[]>()
    for (const r of resources) {
      const s = getSupplier(r.suppliers)
      const key = s?.supplier_abbreviation ?? 'Unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [resources])

  return (
    <>
      {groups.map(([abbr, members]) => {
        const isCollapsed = collapsedSections.has(abbr)
        const colour = SUPPLIER_COLOURS[abbr] ?? '#8F9495'
        return (
          <div key={abbr} style={{ borderLeft: `4px solid ${colour}` }}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onToggle(abbr)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(abbr) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--rmg-spacing-03)',
                padding: 'var(--rmg-spacing-02) var(--rmg-spacing-05)',
                cursor: 'pointer',
                borderBottom: '1px solid var(--rmg-color-grey-3)',
                backgroundColor: `${colour}0A`,
              }}
            >
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--rmg-radius-xl)',
                  border: `1px solid ${colour}`,
                  backgroundColor: `${colour}26`,
                  color: colour,
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  fontWeight: 700,
                }}
              >
                {abbr}
              </span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 'var(--rmg-text-c2)',
                  color: 'var(--rmg-color-text-light)',
                  marginLeft: 'auto',
                }}
              >
                {members.length}
              </span>
              <span style={{ fontSize: 10, color: 'var(--rmg-color-text-light)' }}>
                {isCollapsed ? '▸' : '▾'}
              </span>
            </div>
            {!isCollapsed &&
              members.map((r) => (
                <ResourceRow
                  key={r.resource_id}
                  resource={r}
                  viewMode="by-supplier"
                  selectedResourceId={selectedResourceId}
                  onSelect={onSelect}
                  leadSessionMap={leadSessionMap}
                />
              ))}
          </div>
        )
      })}
    </>
  )
}

function PersonDetail({
  resource,
  sessions,
}: {
  resource: Resource
  sessions: SessionRef[]
}) {
  const supplier = getSupplier(resource.suppliers)
  const colour = supplier
    ? (SUPPLIER_COLOURS[supplier.supplier_abbreviation] ?? '#8F9495')
    : '#8F9495'

  return (
    <div style={{ padding: 'var(--rmg-spacing-05)' }}>
      {/* Avatar */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          backgroundColor: `${colour}26`,
          color: colour,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: '16px',
          fontWeight: 700,
          marginBottom: 'var(--rmg-spacing-03)',
        }}
      >
        {getInitials(resource.resource_name)}
      </div>

      {/* Name */}
      <div
        style={{
          fontFamily: 'var(--rmg-font-display)',
          fontSize: 'var(--rmg-text-h5)',
          lineHeight: 'var(--rmg-leading-h5)',
          fontWeight: 700,
          color: 'var(--rmg-color-text-heading)',
          marginBottom: 2,
        }}
      >
        {resource.resource_name}
      </div>

      {/* Job title */}
      {resource.resource_job_title && (
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c2)',
            color: 'var(--rmg-color-text-light)',
            marginBottom: 'var(--rmg-spacing-03)',
          }}
        >
          {resource.resource_job_title}
        </div>
      )}

      {/* Supplier badge */}
      {supplier && (
        <div style={{ marginBottom: 'var(--rmg-spacing-03)' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: 'var(--rmg-radius-xl)',
              border: `1px solid ${colour}`,
              backgroundColor: `${colour}26`,
              color: colour,
              fontFamily: 'monospace',
              fontSize: '10px',
              fontWeight: 700,
            }}
          >
            {supplier.supplier_abbreviation}
          </span>
        </div>
      )}

      {/* Location */}
      {resource.resource_location && (
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c2)',
            color: 'var(--rmg-color-text-light)',
            marginBottom: 2,
          }}
        >
          {resource.resource_location}
          {resource.resource_country ? `, ${resource.resource_country}` : ''}
        </div>
      )}

      {/* Experience */}
      {resource.resource_years_experience != null && (
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c2)',
            color: 'var(--rmg-color-text-light)',
            marginBottom: 'var(--rmg-spacing-04)',
          }}
        >
          {resource.resource_years_experience} yrs experience
        </div>
      )}

      {/* Divider */}
      <div
        style={{
          height: 1,
          backgroundColor: 'var(--rmg-color-grey-3)',
          margin: 'var(--rmg-spacing-04) 0',
        }}
      />

      {/* KT Sessions */}
      <div>
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c2)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--rmg-color-text-light)',
            marginBottom: 'var(--rmg-spacing-03)',
          }}
        >
          KT Sessions ({sessions.length})
        </div>
        {sessions.length === 0 ? (
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-c2)',
              color: 'var(--rmg-color-text-light)',
              margin: 0,
            }}
          >
            No sessions as lead.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sessions.map((s) => {
              const ag = s.tessera_app_groups
              const group = Array.isArray(ag) ? (ag[0] ?? null) : ag
              return (
                <div
                  key={s.session_id}
                  style={{
                    padding: 'var(--rmg-spacing-02) var(--rmg-spacing-03)',
                    borderRadius: 'var(--rmg-radius-s)',
                    backgroundColor: 'var(--rmg-color-surface-light)',
                    borderLeft: '2px solid var(--rmg-color-red)',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--rmg-font-body)',
                      fontSize: 'var(--rmg-text-c2)',
                      fontWeight: 600,
                      color: 'var(--rmg-color-text-body)',
                    }}
                  >
                    {s.session_name}
                  </div>
                  {group && (
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        color: 'var(--rmg-color-text-light)',
                        marginTop: 1,
                      }}
                    >
                      G{group.group_number}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function PeopleClient({ resources, leadRows }: PeopleClientProps) {
  // ── State ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [selectedStreams, setSelectedStreams] = useState<string[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortColumn, setSortColumn] = useState<SortColumn>(
    'resource_years_experience',
  )
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
    null,
  )
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  )

  // ── Lead session map: resource_id → SessionRef[] ───────────────────
  const leadSessionMap = useMemo(() => {
    const map = new Map<string, SessionRef[]>()
    for (const row of leadRows) {
      if (!row.tessera_kt_sessions) continue
      const sessions = Array.isArray(row.tessera_kt_sessions)
        ? row.tessera_kt_sessions
        : [row.tessera_kt_sessions]
      map.set(row.resource_id, [
        ...(map.get(row.resource_id) ?? []),
        ...sessions,
      ])
    }
    return map
  }, [leadRows])

  // ── Derived option lists for filter bar ───────────────────────────
  const allSupplierAbbrs = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of resources) {
      const s = getSupplier(r.suppliers)
      if (s && !seen.has(s.supplier_abbreviation))
        seen.set(s.supplier_abbreviation, s.supplier_name)
    }
    return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [resources])

  const allLocations = useMemo(() => {
    const seen = new Set<string>()
    for (const r of resources) if (r.resource_location) seen.add(r.resource_location)
    return [...seen].sort()
  }, [resources])

  const allStreams = useMemo(() => {
    const seen = new Set<string>()
    for (const r of resources) if (r.resource_function) seen.add(r.resource_function)
    return [...seen].sort()
  }, [resources])

  // ── Derived filter/sort: filteredResources ────────────────────────
  const filteredResources = useMemo(() => {
    let result = resources

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((r) => {
        const s = getSupplier(r.suppliers)
        return [
          r.resource_name,
          r.resource_job_title,
          r.resource_function,
          s?.supplier_name,
          r.resource_primary_tech_stack,
          r.resource_secondary_tech_stack,
        ].some((field) => field?.toLowerCase().includes(q) ?? false)
      })
    }

    if (selectedSuppliers.length > 0) {
      result = result.filter((r) => {
        const s = getSupplier(r.suppliers)
        return s != null && selectedSuppliers.includes(s.supplier_abbreviation)
      })
    }

    if (selectedStreams.length > 0) {
      result = result.filter(
        (r) => r.resource_function != null && selectedStreams.includes(r.resource_function),
      )
    }

    if (selectedLocation) {
      result = result.filter((r) => r.resource_location === selectedLocation)
    }

    return [...result].sort((a, b) => {
      if (sortColumn === 'resource_years_experience') {
        const av = a.resource_years_experience ?? -1
        const bv = b.resource_years_experience ?? -1
        return sortDirection === 'asc' ? av - bv : bv - av
      }
      const av =
        (sortColumn === 'resource_name'
          ? a.resource_name
          : a.resource_job_title) ?? ''
      const bv =
        (sortColumn === 'resource_name'
          ? b.resource_name
          : b.resource_job_title) ?? ''
      return sortDirection === 'asc'
        ? av.localeCompare(bv)
        : bv.localeCompare(av)
    })
  }, [
    resources,
    searchQuery,
    selectedSuppliers,
    selectedStreams,
    selectedLocation,
    sortColumn,
    sortDirection,
  ])

  function toggleSection(key: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function handleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(col)
      setSortDirection(col === 'resource_years_experience' ? 'desc' : 'asc')
    }
  }

  // ── Style helpers ──────────────────────────────────────────────────
  function filterPill(active: boolean): React.CSSProperties {
    return {
      display: 'inline-flex',
      alignItems: 'center',
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
      whiteSpace: 'nowrap' as const,
    }
  }

  function viewTab(active: boolean): React.CSSProperties {
    return {
      padding: 'var(--rmg-spacing-02) var(--rmg-spacing-03)',
      borderRadius: 'var(--rmg-radius-s)',
      fontFamily: 'var(--rmg-font-body)',
      fontSize: 'var(--rmg-text-c2)',
      fontWeight: active ? 700 : 400,
      color: active ? 'var(--rmg-color-red)' : 'var(--rmg-color-text-body)',
      backgroundColor: active ? 'var(--rmg-color-tint-red)' : 'transparent',
      cursor: 'pointer',
      border: 'none',
      whiteSpace: 'nowrap' as const,
    }
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

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-04)' }}>
      {/* Filter bar */}
      <div
        style={{
          backgroundColor: 'var(--rmg-color-surface-white)',
          borderRadius: 'var(--rmg-radius-m)',
          boxShadow: 'var(--rmg-shadow-card)',
          padding: 'var(--rmg-spacing-04) var(--rmg-spacing-05)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--rmg-spacing-04)',
          alignItems: 'center',
        }}
      >
        {/* Search */}
        <input
          type="search"
          placeholder="Search by name, role, or function…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 200px',
            minWidth: 160,
            padding: '6px var(--rmg-spacing-03)',
            borderRadius: 'var(--rmg-radius-s)',
            border: '1px solid var(--rmg-color-grey-3)',
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-b3)',
            color: 'var(--rmg-color-text-body)',
            background: 'var(--rmg-color-surface-light)',
            outline: 'none',
          }}
        />

        {/* Supplier pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rmg-spacing-02)', flexWrap: 'wrap' }}>
          <span style={labelStyle}>Supplier</span>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedSuppliers([])}
              style={filterPill(selectedSuppliers.length === 0)}
            >
              All
            </button>
            {allSupplierAbbrs.map(([abbr]) => {
              const colour = SUPPLIER_COLOURS[abbr] ?? '#8F9495'
              const isActive = selectedSuppliers.includes(abbr)
              return (
                <button
                  key={abbr}
                  type="button"
                  onClick={() =>
                    setSelectedSuppliers((prev) =>
                      prev.includes(abbr)
                        ? prev.filter((s) => s !== abbr)
                        : [...prev, abbr],
                    )
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px 10px',
                    borderRadius: 'var(--rmg-radius-xl)',
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 'var(--rmg-text-c2)',
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? '#ffffff' : colour,
                    backgroundColor: isActive ? colour : `${colour}1A`,
                    border: `1px solid ${colour}`,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {abbr}
                </button>
              )
            })}
          </div>
        </div>

        {/* Stream / function pills */}
        {allStreams.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rmg-spacing-02)', flexWrap: 'wrap' }}>
            <span style={labelStyle}>Function</span>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setSelectedStreams([])}
                style={filterPill(selectedStreams.length === 0)}
              >
                All
              </button>
              {allStreams.map((fn) => {
                const colour = STREAM_COLOURS[fn] ?? '#8F9495'
                const isActive = selectedStreams.includes(fn)
                return (
                  <button
                    key={fn}
                    type="button"
                    onClick={() =>
                      setSelectedStreams((prev) =>
                        prev.includes(fn)
                          ? prev.filter((s) => s !== fn)
                          : [...prev, fn],
                      )
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '3px 10px',
                      borderRadius: 'var(--rmg-radius-xl)',
                      fontFamily: 'var(--rmg-font-body)',
                      fontSize: 'var(--rmg-text-c2)',
                      fontWeight: isActive ? 700 : 400,
                      color: isActive ? '#ffffff' : colour,
                      backgroundColor: isActive ? colour : `${colour}1A`,
                      border: `1px solid ${colour}`,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fn}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Location pills */}
        {allLocations.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rmg-spacing-02)', flexWrap: 'wrap' }}>
            <span style={labelStyle}>Location</span>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setSelectedLocation(null)}
                style={filterPill(!selectedLocation)}
              >
                All
              </button>
              {allLocations.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() =>
                    setSelectedLocation(loc === selectedLocation ? null : loc)
                  }
                  style={filterPill(selectedLocation === loc)}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Count + view mode toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--rmg-spacing-03)' }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 'var(--rmg-text-c2)',
              color: 'var(--rmg-color-text-light)',
              flexShrink: 0,
            }}
          >
            {filteredResources.length} result{filteredResources.length === 1 ? '' : 's'}
          </span>
          <div
            style={{
              display: 'flex',
              gap: 2,
              backgroundColor: 'var(--rmg-color-surface-light)',
              borderRadius: 'var(--rmg-radius-s)',
              padding: 2,
            }}
          >
            {(['list', 'by-role', 'by-supplier'] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                style={viewTab(viewMode === m)}
              >
                {m === 'list' ? 'List' : m === 'by-role' ? 'By Role' : 'By Supplier'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table + detail panel */}
      <div style={{ display: 'flex', gap: 'var(--rmg-spacing-05)', alignItems: 'flex-start' }}>
        {/* Table */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: 'var(--rmg-color-surface-white)',
            borderRadius: 'var(--rmg-radius-m)',
            boxShadow: 'var(--rmg-shadow-card)',
            overflow: 'hidden',
          }}
        >
          <TableHeader
            viewMode={viewMode}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          {viewMode === 'list' &&
            filteredResources.map((r) => (
              <ResourceRow
                key={r.resource_id}
                resource={r}
                viewMode="list"
                selectedResourceId={selectedResourceId}
                onSelect={setSelectedResourceId}
                leadSessionMap={leadSessionMap}
              />
            ))}
          {viewMode === 'by-role' && (
            <ByRoleSection
              resources={filteredResources}
              collapsedSections={collapsedSections}
              onToggle={toggleSection}
              selectedResourceId={selectedResourceId}
              onSelect={setSelectedResourceId}
              leadSessionMap={leadSessionMap}
            />
          )}
          {viewMode === 'by-supplier' && (
            <BySupplierSection
              resources={filteredResources}
              collapsedSections={collapsedSections}
              onToggle={toggleSection}
              selectedResourceId={selectedResourceId}
              onSelect={setSelectedResourceId}
              leadSessionMap={leadSessionMap}
            />
          )}
          {filteredResources.length === 0 && (
            <div
              style={{
                padding: 'var(--rmg-spacing-07)',
                textAlign: 'center',
                color: 'var(--rmg-color-text-light)',
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-b3)',
              }}
            >
              No results match the current filters.
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div
          style={{
            width: 220,
            flexShrink: 0,
            backgroundColor: 'var(--rmg-color-surface-white)',
            borderRadius: 'var(--rmg-radius-m)',
            boxShadow: 'var(--rmg-shadow-card)',
            position: 'sticky',
            top: 'var(--rmg-spacing-07)',
            overflow: 'hidden',
          }}
        >
          {selectedResourceId ? (
            <PersonDetail
              resource={
                resources.find((r) => r.resource_id === selectedResourceId)!
              }
              sessions={leadSessionMap.get(selectedResourceId) ?? []}
            />
          ) : (
            <div
              style={{
                padding: 'var(--rmg-spacing-06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 120,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 'var(--rmg-text-c2)',
                  color: 'var(--rmg-color-text-light)',
                  textAlign: 'center',
                  margin: 0,
                }}
              >
                Select a person to see details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
