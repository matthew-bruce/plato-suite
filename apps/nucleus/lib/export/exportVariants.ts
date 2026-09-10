// The export variants offered for a period, as data.
//
// Deliberately an array rather than a two-way toggle: team-scoped and
// supplier-scoped variants are planned, and adding one should mean appending
// an entry here — the choice modal renders whatever this list contains and the
// export route switches on the same ids. Nothing downstream should branch on
// "is it the other one".

export const EXPORT_VARIANT_IDS = ['rate-calculator', 'platform-schedule'] as const

export type ExportVariantId = (typeof EXPORT_VARIANT_IDS)[number]

export interface ExportVariant {
  id: ExportVariantId
  /** Shown as the option's title in the choice modal. */
  label: string
  /** One line under the title: what this file is for. */
  description: string
  /** Who the file is aimed at — a short qualifier beside the title. */
  audience: string
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
