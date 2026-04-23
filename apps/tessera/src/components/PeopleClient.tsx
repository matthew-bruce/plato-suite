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

// ── Itinerary stream colours (RMG Primary Accents) ─────────────────
// Represent the two RMG teams on the India trip.
const STREAM_COLOURS: Record<string, { bg: string; text: string }> = {
  BUILD: { bg: '#F3920D', text: '#ffffff' }, // --rmg-color-orange — Matt + Jonny
  SERVICE: { bg: '#F4AEBA', text: '#5A2A35' }, // --rmg-color-pink — Clare + Mandy
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

  // ── Derived filter/sort: filteredResources ────────────────────────
  const filteredResources = useMemo(() => {
    let result = resources

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (r) =>
          r.resource_name.toLowerCase().includes(q) ||
          (r.resource_job_title?.toLowerCase().includes(q) ?? false) ||
          (r.resource_function?.toLowerCase().includes(q) ?? false),
      )
    }

    if (selectedSuppliers.length > 0) {
      result = result.filter((r) => {
        const s = getSupplier(r.suppliers)
        return s != null && selectedSuppliers.includes(s.supplier_abbreviation)
      })
    }

    if (selectedStreams.length > 0) {
      // Stream membership is not yet stored on resources directly.
      // Once a stream attribute exists, filter here.
      result = result.filter(() => true)
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

  // Suppress unused-var warnings for state setters and helpers that
  // will be wired up when the JSX is added.
  void setSearchQuery
  void setSelectedSuppliers
  void setSelectedStreams
  void setSelectedLocation
  void setViewMode
  void setSortColumn
  void setSortDirection
  void setSelectedResourceId
  void filteredResources
  void leadSessionMap
  void selectedResourceId
  void viewMode
  void SUPPLIER_COLOURS
  void STREAM_COLOURS
  void getInitials

  return <div>PeopleClient — skeleton ready</div>
}
