// Pure UI helpers for the Platform Schedule v5 page.
// Money is stored as integer pence per ADR-029.

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
  return planviewCode !== 'BAU'
}

export function isChargeableRow(planviewCode: string | null | undefined): boolean {
  return planviewCode === 'PR'
}

export function getLocationColour(location: string | null | undefined): string {
  if (!location) return '#D5D5D5'
  const key = location.toLowerCase()
  if (key === 'onshore') return '#008A00'
  if (key === 'nearshore') return '#0892CB'
  if (key === 'offshore') return '#F3920D'
  return '#D5D5D5'
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
