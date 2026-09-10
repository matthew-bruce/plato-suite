// The planview code palette used across every exported workbook.
//
// These are the colours the Summary tab's Planview Code Split has always
// used; they live here rather than inline in route.ts so the Team Schedule
// and Supplier Schedule sheets colour a code the same way without a second
// copy of the hex drifting away from the first.
//
// Excel needs literal ARGB — the --rmg-* custom properties the live page's
// badges use (getPlanBadgeStyle in lib/schedule/ui.ts) cannot resolve inside
// a workbook, which is why this is a separate palette rather than a reuse of
// that one.

export interface PlanviewStyle {
  /** Cell background, 8-digit ARGB. */
  fill: string
  /** Text colour, 8-digit ARGB. */
  font: string
  /** The long-form line used by the Summary tab's legend. */
  legendLabel: string
}

const NEUTRAL: PlanviewStyle = {
  fill: 'FFF5F5F5',
  font: 'FF888888',
  legendLabel: '',
}

export const PLANVIEW_STYLES: Record<string, PlanviewStyle> = {
  PR: {
    fill: 'FFE8F5E9',
    font: 'FF1B5E20',
    legendLabel: 'PR  Platform Request — recoverable',
  },
  F_Gov: {
    fill: 'FFE3F2FD',
    font: 'FF0D47A1',
    legendLabel: 'F_Gov  Factory Governance — overhead',
  },
  BAU: {
    fill: 'FFF5F5F5',
    font: 'FF888888',
    legendLabel: 'BAU  Business as Usual — not platform-borne',
  },
  NPC: {
    fill: 'FFFFF3E0',
    font: 'FF7A4400',
    legendLabel: 'NPC  Non Platform Cost — borne elsewhere',
  },
  ETP: {
    fill: 'FFE3F2FD',
    font: 'FF0D47A1',
    legendLabel: 'ETP  Enterprise Technology Platform',
  },
}

/** Anything unrecognised, or a row with no code, reads as neutral grey. */
export function planviewStyle(code: string | null | undefined): PlanviewStyle {
  if (!code) return NEUTRAL
  return PLANVIEW_STYLES[code] ?? NEUTRAL
}

/** "F_Gov" prints as "F_GOV", matching the live page's badge. */
export function planviewLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return code === 'F_Gov' ? 'F_GOV' : code
}
