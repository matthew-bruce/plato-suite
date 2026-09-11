// The export variants offered for a period, as data.
//
// Deliberately an array rather than a two-way toggle: team-scoped and
// supplier-scoped variants are planned, and adding one should mean appending
// an entry here — the choice modal renders whatever this list contains and the
// export route switches on the same ids. Nothing downstream should branch on
// "is it the other one".
//
// The team- and supplier-scoped variants need something the first two did not:
// a further answer before the file can be built (which team? which supplier?).
// That is declared here too, per variant, rather than by the modal growing an
// `if (id === 'team-schedule')`. A variant says what it needs; the modal
// renders whatever any variant says it needs.
//
// There used to be a third thing a variant could declare: whose money the file
// may show, as a user-facing choice between internal, commercial and both. It
// is gone. Each file now has exactly one answer baked into it — the Team
// Schedule has no commercial content at all, the Supplier Schedule is
// commercial-only — because a per-export option only keeps supplier rates away
// from the wrong reader if whoever exports it picks correctly every single
// time, and structure does that job better than memory.

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
 *
 * 'team' is the only member, and deliberately still a union rather than a
 * boolean: a future variant scoped to something else adds a member here. It
 * used to include 'supplier', back when the Supplier Schedule made you pick
 * one supplier per file; that file now covers every supplier in the period at
 * once, so there is nothing to pick and no scope to declare.
 */
export type ExportScopeKind = 'team'

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
  /**
   * A fixed line shown under this variant's controls once it is selected —
   * for stating something the user cannot change, rather than offering them
   * anything. There is no setting behind it.
   */
  note?: string
}

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
  },
  {
    id: 'platform-schedule',
    label: 'Platform Schedule',
    audience: 'Platform',
    description:
      'The whole platform: everyone Finance would expect on a SOW reconciliation, plus everyone else working on the platform or a platform team — whatever supplier or business unit they come from. Cost figures match the Rate Calculator exactly.',
  },
  {
    id: 'team-schedule',
    label: 'Team Schedule',
    audience: 'Delivery',
    description:
      'One team’s people, roles and days for the quarter, with the internal cross-charge for running it. Contains no supplier rates, so it is safe to forward as-is.',
    scope: 'team',
    // No note and nothing to choose: this file has no commercial content to
    // reveal in the first place (see teamScheduleSheet.ts). An option would
    // imply one exists, and would only protect a reader when whoever exported
    // it remembered to set it correctly.
  },
  {
    id: 'supplier-schedule',
    label: 'Supplier Schedule',
    audience: 'Supplier',
    description:
      'Every supplier on the platform, one tab each, with the commercial cost of everyone they have across every team. The file a supplier reconciles their invoice against.',
    note: 'One tab per supplier with resources this period · commercial cost only — the figure suppliers need for reconciliation.',
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

