// Pure UI helpers for the Platform Schedule v5 page.
// Money is stored as integer pence per ADR-029.

import { getCapacitySplit } from '../scheduleUtils'

// Single source of truth for the five valid planview_code values, shared by
// the Planview filter dropdown and the per-row edit-mode <select> so their
// option lists can't drift apart the way they did when 'NPC' (Non Platform
// Cost) was added to one and not the other.
export const PLANVIEW_CODES: { value: string; label: string }[] = [
  { value: 'PR', label: 'PR' },
  { value: 'F_Gov', label: 'F_GOV' },
  { value: 'BAU', label: 'BAU' },
  { value: 'ETP', label: 'ETP' },
  { value: 'NPC', label: 'NPC' },
]

export function formatMoney(pence: number, opts: { decimals?: 0 | 2 } = {}): string {
  const decimals = opts.decimals ?? 2
  const value = pence / 100
  return `£${value.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

export function getUtilColour(pct: number): string {
  if (pct <= 0) return '#EEEEEE'
  if (pct >= 90) return '#62A531'
  if (pct >= 50) return '#F3920D'
  return '#0892CB'
}

export function isIncludedInBaseCost(planviewCode: string | null | undefined): boolean {
  if (!planviewCode) return false
  return planviewCode !== 'BAU' && planviewCode !== 'NPC'
}

/**
 * Whether an allocation counts toward HEADCOUNT — a different question from
 * whether it counts toward COST (isIncludedInBaseCost above), and the two
 * must not be conflated: BAU is a real, known person who costs the platform
 * nothing, so BAU is excluded from cost but IS counted here. NPC is excluded
 * from both.
 *
 *   Code   | isIncludedInBaseCost | isCountedInHeadcount
 *   PR     | true                 | true
 *   F_Gov  | true                 | true
 *   BAU    | false                | true
 *   NPC    | false                | false
 *
 * This exists because merging the two rules — treating "not counted toward
 * cost" as "not counted at all" — is a regression that has happened twice in
 * one night on the Rate Calculator export's Summary tab, silently dropping
 * BAU (Royal Mail Group's own headcount) out of every breakdown it should
 * have appeared in. Do not reimplement this as `isIncludedInBaseCost`.
 */
export function isCountedInHeadcount(planviewCode: string | null | undefined): boolean {
  if (!planviewCode) return false
  return planviewCode !== 'NPC'
}

interface DaysRow {
  capacity_days: number | null
  planview_code: string | null | undefined
  teams?: Array<{ teamId: string; teamName: string; capacitySplit: number }>
}

// Sums capacity_days across groups/rows using the same row filter and
// capacity-split weighting as the BASE/+VAT footer totals (isIncludedInBaseCost
// + getCapacitySplit), so the Days total stays in lockstep with those figures.
export function sumFilteredDays<T extends DaysRow>(
  groups: { rows: T[] }[],
  activeTeamFilter: string | null,
): number {
  return groups.reduce((s, g) => {
    return s + g.rows.reduce((rs, r) => {
      if (!isIncludedInBaseCost(r.planview_code)) return rs
      return rs + (r.capacity_days ?? 0) * getCapacitySplit(r.teams ?? [], activeTeamFilter)
    }, 0)
  }, 0)
}

// Sums capacity_days across groups/rows the same way sumFilteredDays does,
// but filtered to isChargeableRow (PR only) rather than isIncludedInBaseCost.
// This is the capacity base for "Internal Run Rate": F_Gov and BAU cost the
// platform and stay in the BASE/+VAT footer via isIncludedInBaseCost, but
// they are not cross-charged, so they must not inflate the recoverable-days
// figure stakeholders are shown per team. NPC is excluded from both rules.
export function sumChargeableDays<T extends DaysRow>(
  groups: { rows: T[] }[],
  activeTeamFilter: string | null,
): number {
  return groups.reduce((s, g) => {
    return s + g.rows.reduce((rs, r) => {
      if (!isChargeableRow(r.planview_code)) return rs
      return rs + (r.capacity_days ?? 0) * getCapacitySplit(r.teams ?? [], activeTeamFilter)
    }, 0)
  }, 0)
}

/**
 * The one rounding rule for a Days figure: at most one decimal place.
 *
 * Proration produces arbitrary floats (64 × 0.35 = 22.400000000000002, a
 * third of a quarter = 21.333…), so every surface that shows Days has to
 * decide where to cut them off. It is decided here, once, rather than at
 * each call site — that is how the page came to show "32.0" beside "64",
 * with one branch running toFixed(1) and the other printing the raw value.
 */
export function roundDays(days: number): number {
  return Math.round(days * 10) / 10
}

// Formats a Days total: plain whole numbers, halves keep one decimal,
// never a forced trailing zero (48 not 48.0, 48.5 stays 48.5).
export function formatDaysTotal(days: number): string {
  return roundDays(days).toLocaleString('en-GB', { maximumFractionDigits: 1 })
}

// Single source of truth for "X/Y confirmed" — used by both the per-supplier
// chip and the Filtered Totals bar so the two figures can't diverge. Callers
// pass whatever set of rows is currently visible (already filtered by
// search/planview/location/team/supplier), so the count always reflects the
// active view, not the full unfiltered dataset.
export function calculateConfirmedCount(
  rows: { is_confirmed: boolean }[],
): { confirmed: number; total: number } {
  return {
    confirmed: rows.filter((r) => r.is_confirmed).length,
    total: rows.length,
  }
}

export function isChargeableRow(planviewCode: string | null | undefined): boolean {
  return planviewCode === 'PR'
}

// is_chargeable drives the "Chargeable" Yes/No badge and excludes non-PR
// rows from the billable-days total used to calculate the blended rate.
// It is true ONLY for planview_code === 'PR' — F_Gov, BAU, and NPC are all
// false. F_Gov's cost is still correctly included in Total Platform Cost,
// but via isIncludedInBaseCost() above — a separate, deliberately
// different rule (it excludes only BAU and NPC) — do not conflate the two.
//
// This column is derived and must never be set independently of
// planview_code, or it silently drifts out of sync with what the exported
// Rate Calculator (app/api/export/schedule/route.ts) assumes, even though
// that export currently computes its own values from planview_code
// directly rather than reading this column.
//
// Must always return the same result as isChargeableRow() above.
export function deriveIsChargeable(planviewCode: string | null | undefined): boolean {
  return planviewCode === 'PR'
}

// Applied to every allocation update payload before it's sent to the DB:
// whenever planview_code is part of the update (e.g. the Planview <select>
// changing), is_chargeable is re-derived alongside it so the two fields
// can never be edited independently and drift apart.
export function withDerivedChargeable<T extends { planview_code?: string | null }>(
  updates: T,
): T & { is_chargeable?: boolean } {
  if (!('planview_code' in updates)) return updates
  return { ...updates, is_chargeable: deriveIsChargeable(updates.planview_code) }
}

export function getLocationColour(location: string | null | undefined): string {
  if (!location) return '#D5D5D5'
  const key = location.toLowerCase()
  if (key === 'onshore') return '#008A00'
  if (key === 'nearshore') return '#0892CB'
  if (key === 'offshore') return '#F3920D'
  return '#D5D5D5'
}

/**
 * The buckets a location breakdown reports, in display order.
 *
 * resource_location_enum gained a fourth value, 'unspecified', in September
 * 2026 and it is already in use. A breakdown that only knew the first three
 * silently dropped those rows, which is how a location split stops adding up
 * to the total it sits under.
 */
export const LOCATION_BUCKETS = ['Onshore', 'Nearshore', 'Offshore', 'Unspecified'] as const

export type LocationBucket = (typeof LOCATION_BUCKETS)[number]

/**
 * The bucket a row's location belongs to.
 *
 * A deliberate 'unspecified' and a genuine NULL report identically: both mean
 * "no location has been decided for this row", and Finance has no use for the
 * distinction. Anything unrecognised lands there too — including a fifth enum
 * value added later — so a breakdown built from these buckets always accounts
 * for every row and can never quietly fail to tie to its own total.
 */
export function locationBucket(location: string | null | undefined): LocationBucket {
  const key = (location ?? '').trim().toLowerCase()
  if (key === 'onshore') return 'Onshore'
  if (key === 'nearshore') return 'Nearshore'
  if (key === 'offshore') return 'Offshore'
  return 'Unspecified'
}

export interface BadgeStyle {
  background: string
  color: string
}

export function getPlanBadgeStyle(code: string | null | undefined): BadgeStyle {
  switch (code) {
    case 'PR':
      return { background: '#BEE0F5', color: '#005F8A' }
    case 'F_Gov':
      return { background: '#EEEEEE', color: '#8F9495' }
    case 'BAU':
      return { background: '#EEEEEE', color: '#8F9495' }
    case 'ETP':
      return { background: '#BEE0F5', color: '#005F8A' }
    case 'NPC':
      return { background: 'var(--rmg-color-tint-orange)', color: 'var(--rmg-color-orange)' }
    default:
      return { background: '#EEEEEE', color: '#8F9495' }
  }
}

// W3C relative luminance — pick readable text colour on supplier backgrounds.
export function getTextColour(bgHex: string): '#ffffff' | '#2A2A2D' {
  const hex = bgHex.trim().replace('#', '')
  const normalised =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  if (normalised.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(normalised)) {
    return '#2A2A2D'
  }
  const r = parseInt(normalised.slice(0, 2), 16) / 255
  const g = parseInt(normalised.slice(2, 4), 16) / 255
  const b = parseInt(normalised.slice(4, 6), 16) / 255
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return L > 0.5 ? '#2A2A2D' : '#ffffff'
}

// Append a hex alpha byte to a colour. Defensive on length.
export function withAlpha(bgHex: string, alphaHex: string): string {
  const hex = bgHex.trim().replace('#', '')
  const normalised =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  if (normalised.length !== 6) return bgHex
  return `#${normalised}${alphaHex}`
}

// Default-period selection: prefer the active period, otherwise the most
// recent non-draft (i.e. historic). Periods MUST be provided in
// start-date-descending order — the first matching entry wins.
interface PickablePeriod {
  period_id: string
  period_status: 'draft' | 'active' | 'historic'
}

export function pickDefaultPeriodId<T extends PickablePeriod>(
  periods: T[],
): string | null {
  if (!periods || periods.length === 0) return null
  const active = periods.find((p) => p.period_status === 'active')
  if (active) return active.period_id
  const historic = periods.find((p) => p.period_status === 'historic')
  if (historic) return historic.period_id
  return null
}

export type SortableCol =
  | 'resource'
  | 'role'
  | 'team'
  | 'plan'
  | 'chargeable'
  | 'location'
  | 'days'
  | 'dayRate'
  | 'total'
  | 'vat'
export type SortDir = 'asc' | 'desc'

interface SortRow {
  resource_name: string | null
  role_title: string | null
  planview_code: string | null
  resource_location: string | null
  is_chargeable: boolean
  capacity_days: number | null
  day_rate: number
  utilisation_percent: number
  base_total_pence?: number
  vat_total_pence?: number
  teams?: Array<{ teamId: string; teamName: string; capacitySplit: number }>
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base' })
}

export function sortAllocations<T extends SortRow>(
  rows: T[],
  col: SortableCol | null,
  dir: SortDir,
): T[] {
  if (!col) return rows
  const sorted = [...rows]
  const mul = dir === 'asc' ? 1 : -1
  sorted.sort((a, b) => {
    switch (col) {
      case 'resource':
        return mul * compareStrings(a.resource_name ?? '', b.resource_name ?? '')
      case 'role':
        return mul * compareStrings(a.role_title ?? '', b.role_title ?? '')
      case 'team':
        return mul * compareStrings((a.teams?.[0]?.teamName ?? ''), (b.teams?.[0]?.teamName ?? ''))
      case 'plan':
        return mul * compareStrings(a.planview_code ?? '', b.planview_code ?? '')
      case 'chargeable':
        return mul * (Number(a.is_chargeable) - Number(b.is_chargeable))
      case 'location':
        return mul * compareStrings(a.resource_location ?? '', b.resource_location ?? '')
      case 'days':
        return mul * ((a.capacity_days ?? 0) - (b.capacity_days ?? 0))
      case 'dayRate':
        return mul * (a.day_rate - b.day_rate)
      case 'total':
        return mul * ((a.base_total_pence ?? 0) - (b.base_total_pence ?? 0))
      case 'vat':
        return mul * ((a.vat_total_pence ?? 0) - (b.vat_total_pence ?? 0))
      default:
        return 0
    }
  })
  return sorted
}
