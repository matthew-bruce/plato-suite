// The export variants offered for a period, as data.
//
// Deliberately an array rather than a two-way toggle: team-scoped and
// supplier-scoped variants are planned, and adding one should mean appending
// an entry here — the choice modal renders whatever this list contains and the
// export route switches on the same ids. Nothing downstream should branch on
// "is it the other one".
//
// The team- and supplier-scoped variants need something the first two did not:
// a further answer before the file can be built (which team? which supplier?
// whose rates may be shown?). That is declared here too, per variant, rather
// than by the modal growing an `if (id === 'team-schedule')`. A variant says
// what it needs; the modal renders whatever any variant says it needs.

export const EXPORT_VARIANT_IDS = [
  'rate-calculator',
  'platform-schedule',
  'team-schedule',
  'supplier-schedule',
] as const

export type ExportVariantId = (typeof EXPORT_VARIANT_IDS)[number]

/**
 * The entity a variant is scoped to, and therefore which picker the modal
 * shows once it is selected. Undefined means the file covers the whole
 * platform and needs no further choice.
 */
export type ExportScopeKind = 'team' | 'supplier'

/**
 * Whose money a file is allowed to show.
 *
 *   - `internal`   — the blended cross-charge rate only. Safe to circulate:
 *                    contains no supplier's contracted rate.
 *   - `commercial` — the supplier's own day rates. Rate-sensitive.
 *   - `both`       — both groups side by side. Rate-sensitive.
 */
export const COST_VISIBILITY_IDS = ['internal', 'commercial', 'both'] as const

export type CostVisibility = (typeof COST_VISIBILITY_IDS)[number]

/** Whether a variant lets the user choose, or fixes the answer itself. */
export type CostVisibilityControl =
  | { kind: 'none' }
  | { kind: 'choice'; default: CostVisibility }
  | { kind: 'fixed'; value: CostVisibility; note: string }

export interface ExportVariant {
  id: ExportVariantId
  /** Shown as the option's title in the choice modal. */
  label: string
  /** One line under the title: what this file is for. */
  description: string
  /** Who the file is aimed at — a short qualifier beside the title. */
  audience: string
  /** Which entity picker to reveal once selected, if any. */
  scope?: ExportScopeKind
  /** How this variant decides whose rates the file may show. */
  costVisibility: CostVisibilityControl
}

/** Shown whenever the selected cost visibility exposes supplier rates. */
export const RATE_SENSITIVE_WARNING = 'Contains supplier-sensitive rate data'

/**
 * Display order is the order offered. The first entry is the default
 * selection, so the Finance-safe file stays the one you get by pressing
 * Enter — see DEFAULT_EXPORT_VARIANT_ID below.
 */
export const EXPORT_VARIANTS: readonly ExportVariant[] = [
  {
    id: 'rate-calculator',
    label: 'Rate Calculator',
    audience: 'Finance',
    description:
      'Cost recovery workbook for the platform’s own charged resources. Excludes non-platform-cost (NPC) roles.',
    costVisibility: { kind: 'none' },
  },
  {
    id: 'platform-schedule',
    label: 'Platform Schedule',
    audience: 'Platform',
    description:
      'The whole platform: everyone Finance would expect on a SOW reconciliation, plus everyone else working on the platform or a platform team — whatever supplier or business unit they come from. Cost figures match the Rate Calculator exactly.',
    costVisibility: { kind: 'none' },
  },
  {
    id: 'team-schedule',
    label: 'Team Schedule',
    audience: 'Delivery',
    description:
      'One team’s people, roles and days for the quarter, with the cost of running it. Choose whether it shows the internal cross-charge, the supplier’s commercial rates, or both.',
    scope: 'team',
    // Internal-only by default: the file a Delivery Manager can forward
    // without thinking about whose rates are in it.
    costVisibility: { kind: 'choice', default: 'internal' },
  },
  {
    id: 'supplier-schedule',
    label: 'Supplier Schedule',
    audience: 'Supplier',
    description:
      'Everyone one supplier has on the platform, across every team, with the commercial cost of each. The file a supplier reconciles their invoice against.',
    scope: 'supplier',
    costVisibility: {
      kind: 'fixed',
      value: 'commercial',
      note: 'Always shows commercial cost only — the figure suppliers need for reconciliation.',
    },
  },
] as const

/** Pre-selected in the modal: the Finance-safe file, not the broader one. */
export const DEFAULT_EXPORT_VARIANT_ID: ExportVariantId = 'rate-calculator'

/**
 * Narrow an untrusted string (a query parameter) to a known variant id.
 * Anything unrecognised falls back to the default rather than erroring, so a
 * stale or hand-edited URL still returns the Finance-safe workbook.
 */
export function parseExportVariantId(value: string | null | undefined): ExportVariantId {
  const match = EXPORT_VARIANT_IDS.find((id) => id === value)
  return match ?? DEFAULT_EXPORT_VARIANT_ID
}

export function getExportVariant(id: ExportVariantId): ExportVariant {
  const variant = EXPORT_VARIANTS.find((v) => v.id === id)
  // EXPORT_VARIANT_IDS and EXPORT_VARIANTS are declared together; a missing
  // entry is a programming error, not a runtime condition to handle.
  if (!variant) throw new Error(`No export variant registered for id "${id}"`)
  return variant
}

/**
 * The cost visibility a variant will actually be built with.
 *
 * A variant that fixes its own answer ignores the requested value entirely —
 * a hand-edited `?costVisibility=commercial` cannot widen a file beyond what
 * its variant allows, and cannot narrow the Supplier Schedule below the
 * commercial figures that are its entire purpose.
 */
export function resolveCostVisibility(
  id: ExportVariantId,
  requested: string | null | undefined,
): CostVisibility {
  const control = getExportVariant(id).costVisibility
  if (control.kind === 'fixed') return control.value
  if (control.kind === 'none') return 'internal'
  const match = COST_VISIBILITY_IDS.find((v) => v === requested)
  return match ?? control.default
}

export function showsCommercialCost(visibility: CostVisibility): boolean {
  return visibility === 'commercial' || visibility === 'both'
}

export function showsInternalCost(visibility: CostVisibility): boolean {
  return visibility === 'internal' || visibility === 'both'
}

/** Whether the chosen visibility puts supplier rates in the file. */
export function isRateSensitive(visibility: CostVisibility): boolean {
  return showsCommercialCost(visibility)
}
