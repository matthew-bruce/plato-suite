'use client'

import { useState, useMemo, useEffect, type ReactNode } from 'react'
import { ChevronLeft, SlidersHorizontal } from 'lucide-react'
import type { DirectoryResource } from '@plato/schema'
import { filterDirectoryResources, NO_TEAM_SENTINEL } from '@plato/schema'
import {
  PageToolbar,
  PageToolbarSearch,
  PageToolbarFilterPill,
  PageToolbarPrimaryActions,
  PageToolbarResourceCount,
} from '@plato/ui'
import { getSupplierColour, buildSupplierMap } from '@plato/ui/tokens'
import { highlightMatch } from '@/lib/schedule/highlightMatch'
import { TeamFilterSheet, ALL_TEAMS } from './TeamFilterSheet'
import { PersonDetailPanel } from './PersonDetailPanel'
import {
  FUNCTION_FILTER_ORDER,
  LOCATION_FILTER_ORDER,
  humanizeFunction,
  sentenceCaseLocation,
  getPersonInitials,
} from '@/lib/people/format'

const MOBILE_BREAKPOINT = 768
const ALL_SENTINEL = '--all'

export interface PeopleDirectoryClientProps {
  resources: DirectoryResource[]
}

export function PeopleDirectoryClient({ resources }: PeopleDirectoryClientProps) {
  const [search, setSearch] = useState('')
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([])
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [teamSheetOpen, setTeamSheetOpen] = useState(false)
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Supplier pill colours always come from the DB via buildSupplierMap() /
  // getSupplierColour() — never hardcoded. Options are derived from the
  // resources actually loaded (same pattern as Schedule's supplierOptions),
  // ordered by supplier_sort_order then abbreviation.
  const supplierOptions = useMemo(() => {
    const bySupplier = new Map<string, { colour: string; sortOrder: number | null }>()
    for (const r of resources) {
      if (!r.supplier_abbreviation) continue
      if (!bySupplier.has(r.supplier_abbreviation)) {
        bySupplier.set(r.supplier_abbreviation, {
          colour: r.supplier_colour ?? '',
          sortOrder: r.supplier_sort_order,
        })
      }
    }
    const map = buildSupplierMap(
      Array.from(bySupplier.entries()).map(([abbreviation, v]) => ({
        supplier_abbreviation: abbreviation,
        supplier_colour: v.colour,
      })),
    )
    return Array.from(bySupplier.entries())
      .map(([abbreviation, v]) => ({
        abbreviation,
        sortOrder: v.sortOrder,
        colour: getSupplierColour(abbreviation, map),
      }))
      .sort((a, b) => {
        const sa = a.sortOrder ?? Infinity
        const sb = b.sortOrder ?? Infinity
        if (sa !== sb) return sa - sb
        return a.abbreviation.localeCompare(b.abbreviation)
      })
  }, [resources])

  const filtered = useMemo(
    () =>
      filterDirectoryResources(resources, {
        search,
        functions: selectedFunctions,
        teams: selectedTeams,
        suppliers: selectedSuppliers,
        locations: selectedLocations,
      }),
    [resources, search, selectedFunctions, selectedTeams, selectedSuppliers, selectedLocations],
  )

  const selectedResource: DirectoryResource | null = selectedResourceId
    ? (resources.find((r) => r.resource_id === selectedResourceId) ?? null)
    : null

  function toggleFunction(fn: string) {
    setSelectedFunctions((prev) => (prev.includes(fn) ? prev.filter((f) => f !== fn) : [...prev, fn]))
  }

  function toggleTeam(team: string) {
    setSelectedTeams((prev) => (prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]))
  }

  function toggleSupplier(abbreviation: string) {
    setSelectedSuppliers((prev) =>
      prev.includes(abbreviation) ? prev.filter((s) => s !== abbreviation) : [...prev, abbreviation],
    )
  }

  function toggleLocation(location: string) {
    setSelectedLocations((prev) => (prev.includes(location) ? prev.filter((l) => l !== location) : [...prev, location]))
  }

  // Mobile: selecting a resource pushes a full-screen detail view.
  if (isMobile && selectedResource) {
    return (
      <div style={{ background: 'var(--rmg-color-surface-light)', minHeight: '100vh' }}>
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: '#fff',
            borderBottom: '1px solid var(--rmg-color-grey-3)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedResourceId(null)}
            aria-label="Back to People Directory"
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--rmg-color-text-heading)',
              padding: 4,
            }}
          >
            <ChevronLeft size={22} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--rmg-color-text-heading)' }}>
            {selectedResource.resource_name}
          </span>
        </div>
        <div style={{ padding: 16 }}>
          <PersonDetailPanel resource={selectedResource} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--rmg-color-surface-light)', minHeight: '100vh', padding: 'var(--rmg-spacing-07)' }}>
      <div style={{ marginBottom: 'var(--rmg-spacing-06)' }}>
        <h1
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--rmg-color-text-heading)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          People Directory
        </h1>
        <p style={{ fontSize: 14, color: 'var(--rmg-color-text-light)', marginTop: 6 }}>
          All resources across every platform — not just those on an active team assignment.
        </p>
      </div>

      <div style={{ marginBottom: 14 }}>
        <PageToolbar
          primaryRow={
            <>
              <div style={isMobile ? { flex: '1 1 100%' } : { maxWidth: 400, flexShrink: 0 }}>
                <PageToolbarSearch value={search} onChange={setSearch} placeholder="Search name, role, team, location…" />
              </div>
              <PageToolbarPrimaryActions style={{ marginLeft: 'auto' }}>
                <PageToolbarResourceCount>{filtered.length} resources</PageToolbarResourceCount>
              </PageToolbarPrimaryActions>
            </>
          }
          filterRow={
            isMobile ? (
              <MobileFilterRow
                supplierOptions={supplierOptions}
                selectedSuppliers={selectedSuppliers}
                onToggleSupplier={toggleSupplier}
                selectedLocations={selectedLocations}
                onToggleLocation={toggleLocation}
                selectedFunctions={selectedFunctions}
                onToggleFunction={toggleFunction}
                selectedTeamsCount={selectedTeams.length}
                onOpenTeamSheet={() => setTeamSheetOpen(true)}
              />
            ) : (
              <DesktopFilterRow
                supplierOptions={supplierOptions}
                selectedSuppliers={selectedSuppliers}
                onToggleSupplier={toggleSupplier}
                onClearSuppliers={() => setSelectedSuppliers([])}
                selectedLocations={selectedLocations}
                onToggleLocation={toggleLocation}
                onClearLocations={() => setSelectedLocations([])}
                selectedFunctions={selectedFunctions}
                onToggleFunction={toggleFunction}
                selectedTeams={selectedTeams}
                onToggleTeam={toggleTeam}
              />
            )
          }
        />
      </div>

      {teamSheetOpen && (
        <TeamFilterSheet selected={selectedTeams} onChange={setSelectedTeams} onClose={() => setTeamSheetOpen(false)} />
      )}

      {isMobile ? (
        <ResourceList resources={filtered} selectedId={selectedResourceId} onSelect={setSelectedResourceId} search={search} isMobile />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
          <ResourceList resources={filtered} selectedId={selectedResourceId} onSelect={setSelectedResourceId} search={search} />
          <div style={{ position: 'sticky', top: 16 }}>
            {selectedResource ? (
              <PersonDetailPanel resource={selectedResource} />
            ) : (
              <div
                style={{
                  background: 'white',
                  borderRadius: 'var(--rmg-radius-m)',
                  boxShadow: 'var(--rmg-shadow-card)',
                  padding: '40px 24px',
                  textAlign: 'center',
                  color: 'var(--rmg-color-grey-1)',
                  fontSize: 13,
                }}
              >
                Select a resource to see their allocation history.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface SupplierOption {
  abbreviation: string
  colour: string
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        color: 'var(--rmg-color-grey-1)',
      }}
    >
      {children}
    </span>
  )
}

function GroupDivider() {
  return <div style={{ width: 1, height: 18, background: 'var(--rmg-color-grey-2)', flexShrink: 0, margin: '0 4px' }} />
}

function DesktopFilterRow({
  supplierOptions,
  selectedSuppliers,
  onToggleSupplier,
  onClearSuppliers,
  selectedLocations,
  onToggleLocation,
  onClearLocations,
  selectedFunctions,
  onToggleFunction,
  selectedTeams,
  onToggleTeam,
}: {
  supplierOptions: SupplierOption[]
  selectedSuppliers: string[]
  onToggleSupplier: (abbreviation: string) => void
  onClearSuppliers: () => void
  selectedLocations: string[]
  onToggleLocation: (location: string) => void
  onClearLocations: () => void
  selectedFunctions: string[]
  onToggleFunction: (fn: string) => void
  selectedTeams: string[]
  onToggleTeam: (team: string) => void
}) {
  return (
    <>
      <GroupLabel>Supplier</GroupLabel>
      <PageToolbarFilterPill
        label="All"
        active={selectedSuppliers.length === 0}
        colour={ALL_SENTINEL}
        onClick={onClearSuppliers}
      />
      {supplierOptions.map((s) => (
        <PageToolbarFilterPill
          key={s.abbreviation}
          label={s.abbreviation}
          active={selectedSuppliers.includes(s.abbreviation)}
          colour={s.colour}
          onClick={() => onToggleSupplier(s.abbreviation)}
        />
      ))}

      <GroupDivider />

      <GroupLabel>Location</GroupLabel>
      <PageToolbarFilterPill
        label="All"
        active={selectedLocations.length === 0}
        colour={ALL_SENTINEL}
        onClick={onClearLocations}
      />
      {LOCATION_FILTER_ORDER.map((loc) => (
        <PageToolbarFilterPill
          key={loc}
          label={sentenceCaseLocation(loc) ?? loc}
          active={selectedLocations.includes(loc)}
          colour={ALL_SENTINEL}
          onClick={() => onToggleLocation(loc)}
        />
      ))}

      <GroupDivider />

      <GroupLabel>Function</GroupLabel>
      {FUNCTION_FILTER_ORDER.map((fn) => (
        <PageToolbarFilterPill
          key={fn}
          label={humanizeFunction(fn) ?? fn}
          active={selectedFunctions.includes(fn)}
          colour={ALL_SENTINEL}
          onClick={() => onToggleFunction(fn)}
        />
      ))}

      <GroupDivider />

      <GroupLabel>Team</GroupLabel>
      {ALL_TEAMS.map((team) => (
        <PageToolbarFilterPill
          key={team}
          label={team}
          active={selectedTeams.includes(team)}
          colour={ALL_SENTINEL}
          onClick={() => onToggleTeam(team)}
        />
      ))}
      <PageToolbarFilterPill
        label="No team"
        active={selectedTeams.includes(NO_TEAM_SENTINEL)}
        colour={ALL_SENTINEL}
        onClick={() => onToggleTeam(NO_TEAM_SENTINEL)}
      />
    </>
  )
}

function MobileFilterRow({
  supplierOptions,
  selectedSuppliers,
  onToggleSupplier,
  selectedLocations,
  onToggleLocation,
  selectedFunctions,
  onToggleFunction,
  selectedTeamsCount,
  onOpenTeamSheet,
}: {
  supplierOptions: SupplierOption[]
  selectedSuppliers: string[]
  onToggleSupplier: (abbreviation: string) => void
  selectedLocations: string[]
  onToggleLocation: (location: string) => void
  selectedFunctions: string[]
  onToggleFunction: (fn: string) => void
  selectedTeamsCount: number
  onOpenTeamSheet: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0, overflowX: 'auto', paddingBottom: 2 }}>
      {supplierOptions.map((s) => (
        <PageToolbarFilterPill
          key={s.abbreviation}
          label={s.abbreviation}
          active={selectedSuppliers.includes(s.abbreviation)}
          colour={s.colour}
          onClick={() => onToggleSupplier(s.abbreviation)}
          style={{ flexShrink: 0 }}
        />
      ))}
      {LOCATION_FILTER_ORDER.map((loc) => (
        <PageToolbarFilterPill
          key={loc}
          label={sentenceCaseLocation(loc) ?? loc}
          active={selectedLocations.includes(loc)}
          colour={ALL_SENTINEL}
          onClick={() => onToggleLocation(loc)}
          style={{ flexShrink: 0 }}
        />
      ))}
      {FUNCTION_FILTER_ORDER.map((fn) => (
        <PageToolbarFilterPill
          key={fn}
          label={humanizeFunction(fn) ?? fn}
          active={selectedFunctions.includes(fn)}
          colour={ALL_SENTINEL}
          onClick={() => onToggleFunction(fn)}
          style={{ flexShrink: 0 }}
        />
      ))}
      <button
        type="button"
        onClick={onOpenTeamSheet}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
          borderRadius: 'var(--rmg-radius-xl)',
          padding: '4px 12px',
          fontSize: 11,
          fontWeight: 600,
          border: '1.5px solid',
          borderColor: selectedTeamsCount > 0 ? 'var(--rmg-color-red)' : 'var(--rmg-color-grey-2)',
          background: selectedTeamsCount > 0 ? 'var(--rmg-color-tint-red)' : 'transparent',
          color: selectedTeamsCount > 0 ? 'var(--rmg-color-red)' : 'var(--rmg-color-dark-grey)',
          cursor: 'pointer',
          fontFamily: 'var(--rmg-font-body)',
          whiteSpace: 'nowrap',
        }}
      >
        <SlidersHorizontal size={11} />
        {selectedTeamsCount > 0 ? `+${selectedTeamsCount} filters` : 'Team'}
      </button>
    </div>
  )
}

function ResourceList({
  resources,
  selectedId,
  onSelect,
  search,
  isMobile,
}: {
  resources: DirectoryResource[]
  selectedId: string | null
  onSelect: (id: string) => void
  search: string
  isMobile?: boolean
}) {
  if (resources.length === 0) {
    return (
      <div
        style={{
          background: 'white',
          borderRadius: 'var(--rmg-radius-m)',
          boxShadow: 'var(--rmg-shadow-card)',
          padding: '40px 24px',
          textAlign: 'center',
          color: 'var(--rmg-color-grey-1)',
          fontSize: 13,
        }}
      >
        No resources match the current filters.
      </div>
    )
  }

  return (
    <div style={{ background: 'white', borderRadius: 'var(--rmg-radius-m)', boxShadow: 'var(--rmg-shadow-card)', overflow: 'hidden' }}>
      {resources.map((r) => (
        <PersonRow
          key={r.resource_id}
          resource={r}
          selected={r.resource_id === selectedId}
          onSelect={() => onSelect(r.resource_id)}
          search={search}
          isMobile={isMobile}
        />
      ))}
    </div>
  )
}

function PersonRow({
  resource,
  selected,
  onSelect,
  search,
  isMobile,
}: {
  resource: DirectoryResource
  selected: boolean
  onSelect: () => void
  search: string
  isMobile?: boolean
}) {
  const colour = getSupplierColour(resource.supplier_abbreviation ?? '')
  const functionLabel = humanizeFunction(resource.resource_function)
  const locationLabel = sentenceCaseLocation(resource.resource_location)

  const teamNode =
    resource.teams.length > 0 ? (
      highlightMatch(resource.teams.join(', '), search)
    ) : (
      <span style={{ color: 'var(--rmg-color-orange)' }}>Not on a team</span>
    )

  const avatar = (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: colour,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {getPersonInitials(resource.resource_name)}
    </div>
  )

  const nameBlock = (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--rmg-color-text-heading)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {highlightMatch(resource.resource_name, search)}
      </div>
      {functionLabel && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--rmg-color-grey-1)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {functionLabel}
        </div>
      )}
    </div>
  )

  if (isMobile) {
    const metaParts: ReactNode[] = [
      teamNode,
      resource.resource_job_title ? highlightMatch(resource.resource_job_title, search) : null,
      locationLabel ? highlightMatch(locationLabel, search) : null,
      resource.resource_years_experience !== null ? `${resource.resource_years_experience}y` : null,
    ].filter((p) => p !== null && p !== undefined && p !== '')

    return (
      <div
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSelect()
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '12px 16px',
          borderBottom: '1px solid var(--rmg-color-grey-3)',
          cursor: 'pointer',
          background: selected ? 'var(--rmg-color-tint-red)' : 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {avatar}
          {nameBlock}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--rmg-color-text-light)',
            paddingLeft: 44,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
          }}
        >
          {metaParts.map((part, i) => (
            <span key={i} style={{ display: 'inline-flex', gap: 4 }}>
              {i > 0 && <span style={{ color: 'var(--rmg-color-grey-2)' }}>·</span>}
              {part}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect()
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 150px 150px 90px 60px',
        gap: 12,
        alignItems: 'center',
        padding: '10px 20px',
        borderBottom: '1px solid var(--rmg-color-grey-3)',
        cursor: 'pointer',
        background: selected ? 'var(--rmg-color-tint-red)' : 'transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {avatar}
        {nameBlock}
      </div>

      <div style={{ fontSize: 12, color: 'var(--rmg-color-text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {teamNode}
      </div>

      <div style={{ fontSize: 12, color: 'var(--rmg-color-text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {resource.resource_job_title ? highlightMatch(resource.resource_job_title, search) : ''}
      </div>

      <div style={{ fontSize: 12, color: 'var(--rmg-color-text-body)' }}>
        {locationLabel ? highlightMatch(locationLabel, search) : ''}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--rmg-color-text-body)', textAlign: 'right' }}>
        {resource.resource_years_experience !== null ? `${resource.resource_years_experience}y` : ''}
      </div>
    </div>
  )
}
