'use client'

import { useMemo, useState } from 'react'
import type { Resource, SessionRef, SupplierInfo } from '@/app/people/page'
import { getSupplierColour, buildSupplierMap, TRACK_COLOURS } from '@plato/ui/tokens'
import { highlightMatch } from '@/lib/highlightMatch'

interface PeopleClientProps {
  resources: Resource[]
  leadSessionsByResource: Record<string, SessionRef[]>
  suppliers: SupplierInfo[]
}

type SortKey = 'name' | 'role' | 'exp' | 'sessions' | null
type SortDir = 'asc' | 'desc'

function getSupplier(s: Resource['suppliers']): SupplierInfo | null {
  if (!s) return null
  return Array.isArray(s) ? (s[0] ?? null) : s
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

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
    backgroundColor: active ? 'var(--rmg-color-tint-red)' : 'transparent',
    border: active
      ? '1px solid var(--rmg-color-red)'
      : '1px solid var(--rmg-color-grey-3)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  }
}

const GRID_COLS = '1fr 150px 80px 50px 36px'

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--rmg-font-body)',
  fontSize: 'var(--rmg-text-c2)',
  color: 'var(--rmg-color-text-light)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  flexShrink: 0,
}

function SortButton({
  label,
  sortKey: key,
  activeSortKey,
  sortDir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  activeSortKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = activeSortKey === key
  return (
    <button
      type="button"
      onClick={() => onSort(key)}
      style={{
        ...labelStyle,
        color: active ? 'var(--rmg-color-red)' : 'var(--rmg-color-text-light)',
        cursor: 'pointer',
        border: 'none',
        background: 'none',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
      }}
    >
      {label}
      {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  )
}

function PersonRow({
  resource,
  isSelected,
  onSelect,
  sessions,
  search,
  colourMap,
}: {
  resource: Resource
  isSelected: boolean
  onSelect: (id: string | null) => void
  sessions: SessionRef[]
  search: string
  colourMap: Record<string, string>
}) {
  const [hovered, setHovered] = useState(false)
  const supplier = getSupplier(resource.suppliers)
  const colour = getSupplierColour(supplier?.supplier_abbreviation ?? '', colourMap)
  const sessionCount = sessions.length

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(isSelected ? null : resource.resource_id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ')
          onSelect(isSelected ? null : resource.resource_id)
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: GRID_COLS,
        gap: 'var(--rmg-spacing-04)',
        padding: 'var(--rmg-spacing-03) var(--rmg-spacing-05)',
        alignItems: 'center',
        cursor: 'pointer',
        backgroundColor: isSelected
          ? 'var(--rmg-color-tint-red)'
          : hovered
            ? 'var(--rmg-color-surface-light)'
            : 'transparent',
        borderLeft: isSelected
          ? '2px solid var(--rmg-color-red)'
          : '2px solid transparent',
        borderBottom: '1px solid var(--rmg-color-grey-3)',
        outline: 'none',
      }}
    >
      {/* Name + avatar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--rmg-spacing-03)',
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            backgroundColor: colour,
            color: '#ffffff',
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
              fontWeight: isSelected ? 600 : 400,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {highlightMatch(resource.resource_name, search)}
          </div>
        </div>
      </div>

      {/* Role */}
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
        {resource.resource_job_title
          ? highlightMatch(resource.resource_job_title, search)
          : '—'}
      </span>

      {/* Supplier pill */}
      {supplier ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            alignSelf: 'center',
            padding: '2px 8px',
            borderRadius: 'var(--rmg-radius-xl)',
            border: `1px solid ${colour}`,
            backgroundColor: `${colour}18`,
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
        <span
          style={{
            color: 'var(--rmg-color-text-light)',
            fontSize: 'var(--rmg-text-c2)',
          }}
        >
          —
        </span>
      )}

      {/* Exp */}
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

      {/* KT */}
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 'var(--rmg-text-c2)',
          color:
            sessionCount > 0
              ? 'var(--rmg-color-red)'
              : 'var(--rmg-color-text-light)',
          fontWeight: sessionCount > 0 ? 700 : 400,
          whiteSpace: 'nowrap',
        }}
      >
        {sessionCount > 0 ? String(sessionCount) : '—'}
      </span>
    </div>
  )
}

function PersonDetail({
  resource,
  sessions,
  colourMap,
}: {
  resource: Resource
  sessions: SessionRef[]
  colourMap: Record<string, string>
}) {
  const supplier = getSupplier(resource.suppliers)
  const colour = getSupplierColour(supplier?.supplier_abbreviation ?? '', colourMap)

  return (
    <div style={{ padding: 'var(--rmg-spacing-05)', overflowY: 'auto' }}>
      {/* Avatar */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          backgroundColor: colour,
          color: '#ffffff',
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
            marginBottom: 'var(--rmg-spacing-02)',
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
              backgroundColor: `${colour}18`,
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sessions.map((s) => {
              const trackColour = s.track
                ? TRACK_COLOURS[s.track]
                : 'var(--rmg-color-grey-3)'
              return (
                <div
                  key={s.id}
                  style={{
                    padding: '6px var(--rmg-spacing-03)',
                    borderRadius: 'var(--rmg-radius-s)',
                    backgroundColor: 'var(--rmg-color-surface-light)',
                    borderLeft: `3px solid ${trackColour}`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--rmg-font-body)',
                      fontSize: 'var(--rmg-text-c2)',
                      fontWeight: 600,
                      color: 'var(--rmg-color-text-body)',
                      lineHeight: 1.3,
                    }}
                  >
                    {s.session_name}
                  </div>
                  {(s.group_name || s.duration_hrs) && (
                    <div
                      style={{
                        fontFamily: 'var(--rmg-font-body)',
                        fontSize: 11,
                        color: 'var(--rmg-color-text-light)',
                        marginTop: 1,
                      }}
                    >
                      {s.group_name ?? ''}
                      {s.group_name && s.duration_hrs ? ` · ${s.duration_hrs}h` : ''}
                      {!s.group_name && s.duration_hrs ? `${s.duration_hrs}h` : ''}
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

export function PeopleClient({
  resources,
  leadSessionsByResource,
  suppliers,
}: PeopleClientProps) {
  const [search, setSearch] = useState('')
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const colourMap = useMemo(() => buildSupplierMap(suppliers), [suppliers])
  const supplierOrder = useMemo(
    () =>
      Object.fromEntries(
        suppliers.map((s, i) => [s.supplier_abbreviation, i]),
      ),
    [suppliers],
  )

  const allLocations = useMemo(() => {
    const seen = new Set<string>()
    for (const r of resources) if (r.resource_location) seen.add(r.resource_location)
    return [...seen].sort()
  }, [resources])

  const filtered = useMemo(() => {
    let result = resources

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((r) =>
        [r.resource_name, r.resource_job_title].some(
          (f) => f?.toLowerCase().includes(q) ?? false,
        ),
      )
    }

    if (selectedSuppliers.length > 0) {
      result = result.filter((r) => {
        const s = getSupplier(r.suppliers)
        return s != null && selectedSuppliers.includes(s.supplier_abbreviation)
      })
    }

    if (selectedLocation) {
      result = result.filter((r) => r.resource_location === selectedLocation)
    }

    return [...result].sort((a, b) => {
      if (sortKey === 'name') {
        const cmp = a.resource_name.localeCompare(b.resource_name)
        return sortDir === 'asc' ? cmp : -cmp
      }
      if (sortKey === 'role') {
        const av = a.resource_job_title ?? ''
        const bv = b.resource_job_title ?? ''
        const cmp = av.localeCompare(bv)
        return sortDir === 'asc' ? cmp : -cmp
      }
      if (sortKey === 'exp') {
        const av = a.resource_years_experience ?? -1
        const bv = b.resource_years_experience ?? -1
        const cmp = av - bv
        return sortDir === 'asc' ? cmp : -cmp
      }
      if (sortKey === 'sessions') {
        const av = (leadSessionsByResource[a.resource_id] ?? []).length
        const bv = (leadSessionsByResource[b.resource_id] ?? []).length
        const cmp = av - bv
        return sortDir === 'asc' ? cmp : -cmp
      }
      // Default: supplier order then alpha
      const aAbbr = getSupplier(a.suppliers)?.supplier_abbreviation ?? ''
      const bAbbr = getSupplier(b.suppliers)?.supplier_abbreviation ?? ''
      const aIdx = supplierOrder[aAbbr] ?? 999
      const bIdx = supplierOrder[bAbbr] ?? 999
      if (aIdx !== bIdx) return aIdx - bIdx
      return a.resource_name.localeCompare(b.resource_name)
    })
  }, [
    resources,
    search,
    selectedSuppliers,
    selectedLocation,
    sortKey,
    sortDir,
    supplierOrder,
    leadSessionsByResource,
  ])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'exp' || key === 'sessions' ? 'desc' : 'asc')
    }
  }

  const selectedResource = selectedId
    ? (resources.find((r) => r.resource_id === selectedId) ?? null)
    : null

  return (
    <>
      <style>{`
        .people-layout {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 20px;
          align-items: flex-start;
        }
        @media (max-width: 768px) {
          .people-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--rmg-spacing-04)',
        }}
      >
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
          <div
            style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--rmg-color-text-light)',
                pointerEvents: 'none',
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="Search by name or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px var(--rmg-spacing-03) 6px 28px',
                borderRadius: 'var(--rmg-radius-s)',
                border: '1px solid var(--rmg-color-grey-3)',
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-b3)',
                color: 'var(--rmg-color-text-body)',
                background: 'var(--rmg-color-surface-light)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Supplier pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--rmg-spacing-02)',
              flexWrap: 'wrap',
            }}
          >
            <span style={labelStyle}>Supplier</span>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setSelectedSuppliers([])}
                style={filterPill(selectedSuppliers.length === 0)}
              >
                All
              </button>
              {suppliers.map((s) => {
                const colour = getSupplierColour(
                  s.supplier_abbreviation,
                  colourMap,
                )
                const isActive = selectedSuppliers.includes(
                  s.supplier_abbreviation,
                )
                return (
                  <button
                    key={s.supplier_abbreviation}
                    type="button"
                    onClick={() =>
                      setSelectedSuppliers((prev) =>
                        prev.includes(s.supplier_abbreviation)
                          ? prev.filter((x) => x !== s.supplier_abbreviation)
                          : [...prev, s.supplier_abbreviation],
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
                      backgroundColor: isActive ? colour : `${colour}18`,
                      border: `1px solid ${colour}`,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.supplier_abbreviation}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Location pills */}
          {allLocations.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--rmg-spacing-02)',
                flexWrap: 'wrap',
              }}
            >
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
                      setSelectedLocation(
                        loc === selectedLocation ? null : loc,
                      )
                    }
                    style={filterPill(selectedLocation === loc)}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Result count */}
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: 'monospace',
              fontSize: 'var(--rmg-text-c2)',
              color: 'var(--rmg-color-text-light)',
              flexShrink: 0,
            }}
          >
            {filtered.length} result{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Two-column layout */}
        <div className="people-layout">
          {/* Person list */}
          <div
            style={{
              backgroundColor: 'var(--rmg-color-surface-white)',
              borderRadius: 'var(--rmg-radius-m)',
              boxShadow: 'var(--rmg-shadow-card)',
              overflow: 'hidden',
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: GRID_COLS,
                gap: 'var(--rmg-spacing-04)',
                padding: 'var(--rmg-spacing-03) var(--rmg-spacing-05)',
                borderBottom: '1px solid var(--rmg-color-grey-3)',
                alignItems: 'center',
              }}
            >
              <SortButton
                label="Name"
                sortKey="name"
                activeSortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortButton
                label="Role"
                sortKey="role"
                activeSortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <span style={labelStyle}>Supplier</span>
              <SortButton
                label="Exp"
                sortKey="exp"
                activeSortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortButton
                label="KT"
                sortKey="sessions"
                activeSortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
            </div>

            {/* Rows */}
            {filtered.map((r) => (
              <PersonRow
                key={r.resource_id}
                resource={r}
                isSelected={selectedId === r.resource_id}
                onSelect={setSelectedId}
                sessions={leadSessionsByResource[r.resource_id] ?? []}
                search={search}
                colourMap={colourMap}
              />
            ))}

            {filtered.length === 0 && (
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
              width: '100%',
              backgroundColor: 'var(--rmg-color-surface-white)',
              borderRadius: 'var(--rmg-radius-m)',
              boxShadow: 'var(--rmg-shadow-card)',
              position: 'sticky',
              top: 16,
              overflow: 'hidden',
            }}
          >
            {selectedResource ? (
              <PersonDetail
                resource={selectedResource}
                sessions={leadSessionsByResource[selectedId!] ?? []}
                colourMap={colourMap}
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
    </>
  )
}
