// Row model for the Team Schedule and Supplier Schedule exports.
//
// Both files list one row per ALLOCATION RECORD, not one per person. A person
// legitimately holds more than one: a mid-quarter supplier transition
// (Capgemini → TCS) is two records, and so is a split across two teams. The
// table shows both; only the footer collapses them back to people.
//
// The two variants deliberately disagree about NPC — see
// commercialCostPence's contract and the note above supplierScheduleIncludes.
// That divergence is intentional and load-bearing; it is not an oversight to
// tidy up.

import { isChargeableRow, isIncludedInBaseCost } from '../schedule/ui'
import { allocationBasePence, allocationVatPence } from '../schedule/scheduleTotals'
import { getCapacitySplit } from '../scheduleUtils'

/** A resource's share of one team, as the Schedule page carries it. */
export interface TeamAssignmentRef {
  teamId: string
  teamName: string
  capacitySplit: number
}

/**
 * One allocation record, shaped exactly as the live Schedule page shapes it
 * (packages/schema/src/queries/schedule.ts) rather than re-derived here — the
 * teams array with its splits, the allocation's own location, its own
 * utilisation and day count.
 */
export interface VariantAllocationRow {
  allocation_id: string
  resource_id: string | null
  resource_name: string | null
  role_title: string | null
  planview_code: string | null
  supplier_name: string | null
  supplier_abbreviation: string | null
  supplier_colour: string | null
  resource_location: string | null
  utilisation_percent: number
  capacity_days: number | null
  /** Integer pence. */
  day_rate: number
  vat_applies: boolean
  teams: TeamAssignmentRef[]
}

/**
 * Sprint and month lengths are reporting conventions, fixed on purpose.
 *
 * A quarter's real working days vary by where someone sits (UK 64 vs India 63
 * in Q3 FY26/27, before that resource's own leave), which is why no single
 * working-days figure appears at file level and why the Quarter column reads
 * each row's own capacity_days. Sprint and month are not attempts to measure
 * that: they are "what does a sprint of this person cost", asked the same way
 * for everyone so the numbers can be compared down the column.
 */
export const SPRINT_WORKING_DAYS = 10
export const MONTH_WORKING_DAYS = 21

/** The em-dash a cell shows when a figure would be misleading rather than zero. */
export const NOT_APPLICABLE = '—'

/**
 * A resource's share of the team a file is scoped to — the SAME
 * getCapacitySplit the live Schedule page runs when it is filtered to one
 * team and labels its totals "(PROPORTIONAL)".
 *
 * An export has to present a figure the way the app presents it, or the two
 * disagree and the export is the one that gets believed. Someone 50% Cygnus /
 * 50% Pluto is half a person to Cygnus: the page shows them at half their
 * days and half their cost under a Cygnus filter, and so must a Cygnus file.
 *
 * Accepts a team id or a team name, as getCapacitySplit does, and returns 1.0
 * for an unscoped file — which is what makes this safe to apply
 * unconditionally in the team-scoped cost functions below.
 */
export function teamShare(
  row: Pick<VariantAllocationRow, 'teams'>,
  teamScope: string | null,
): number {
  return getCapacitySplit(row.teams, teamScope)
}

/**
 * The days a row contributes to the team a file is scoped to: its raw period
 * days times that team's share of the resource.
 *
 * This is the figure the Team Schedule's "Total days" column shows, and the
 * one every cost figure on that sheet is derived from — mirroring the page's
 * own `displayDays = rawDays * split`.
 */
export function proratedDays(
  row: Pick<VariantAllocationRow, 'teams' | 'capacity_days'>,
  teamScope: string | null,
): number {
  return (row.capacity_days ?? 0) * getCapacitySplit(row.teams, teamScope)
}

/**
 * The team-split label, formatted the way the live Schedule page's badges
 * read: name then whole-percent share, in the order the assignments arrive.
 * Same Math.round as the badge, so a 0.335 split reads 34% in both places.
 */
export function formatTeamSplits(teams: readonly TeamAssignmentRef[]): string {
  return teams.map((t) => `${t.teamName} ${Math.round(t.capacitySplit * 100)}%`).join(', ')
}

/**
 * What the Team split column shows. A single team at full allocation carries
 * no information worth a column-width, so it collapses to blank; anything
 * else — a genuine split, or a single team at a partial share — is spelled
 * out.
 */
export function teamSplitCell(teams: readonly TeamAssignmentRef[]): string {
  if (teams.length === 0) return ''
  if (teams.length === 1 && Math.round(teams[0].capacitySplit * 100) === 100) return ''
  return formatTeamSplits(teams)
}

/**
 * The commercial (supplier-rate) cost of `days` days of this allocation, in
 * pence, VAT-inclusive.
 *
 * Runs through the same allocationBasePence/allocationVatPence the Schedule
 * page and the Rate Calculator use, with the day count substituted — so a
 * row's Quarter figure here and its Base/+VAT on the page are the same
 * arithmetic, and a row whose vat_applies is false is treated identically in
 * both places.
 *
 * Utilisation scales the cost; it never scales the RATE. A 50%-utilised
 * person is not on a discounted day rate, they are on their contracted rate
 * for half the time, and the Day rate column says so.
 */
export function commercialCostPence(
  row: VariantAllocationRow,
  days: number,
  vatMultiplier: number,
): number {
  return allocationVatPence(
    {
      planview_code: row.planview_code,
      utilisation_percent: row.utilisation_percent,
      capacity_days: days,
      day_rate: row.day_rate,
      vat_applies: row.vat_applies,
    },
    vatMultiplier,
  )
}

/** The same figure before VAT — used only where a caller needs the split out. */
export function commercialBasePence(row: VariantAllocationRow, days: number): number {
  return allocationBasePence({
    planview_code: row.planview_code,
    utilisation_percent: row.utilisation_percent,
    capacity_days: days,
    day_rate: row.day_rate,
    vat_applies: row.vat_applies,
  })
}

/**
 * The internal cross-charge for `days` days, in pence — or null when this row
 * is not cross-charged at all, which the sheet renders as "—".
 *
 * Cross-charge follows is_chargeable / isChargeableRow: PR and nothing else.
 * F_Gov is the one that catches people out — its cost is real, borne by the
 * platform, and counted in every platform total (isIncludedInBaseCost) — but
 * it is never recovered against a PR ticket, so it has no cross-charge figure.
 * BAU and NPC are not platform cost in the first place.
 *
 * No VAT multiplier: the blended rate is derived from a VAT-inclusive total
 * (see computeScheduleTotals — totalPlatformPence ÷ chargeable days), so it
 * already carries VAT. Uplifting it again would double-count.
 */
export function crossChargeCostPence(
  row: VariantAllocationRow,
  days: number,
  blendedDayRatePence: number,
): number | null {
  if (!isChargeableRow(row.planview_code)) return null
  return Math.round(blendedDayRatePence * days * (row.utilisation_percent / 100))
}

/** The three cost figures a cost group shows for one row. */
export interface CostGroupFigures {
  /** Null renders as "—": this row has no such cost, as opposed to zero of it. */
  sprintPence: number | null
  monthPence: number | null
  quarterPence: number | null
}

const NO_FIGURES: CostGroupFigures = {
  sprintPence: null,
  monthPence: null,
  quarterPence: null,
}

/**
 * TEAM SCHEDULE — commercial cost group.
 *
 * Gated on isIncludedInBaseCost: PR and F_Gov show real money, BAU and NPC
 * show "—". This file is about what running the team costs the PLATFORM, so a
 * cost the platform does not bear has no figure here even though the supplier
 * rate behind it exists.
 *
 * ⚠ The Supplier Schedule answers a different question and therefore gives a
 * different answer for the same NPC row — see supplierCommercialFigures.
 */
export function teamCommercialFigures(
  row: VariantAllocationRow,
  vatMultiplier: number,
  /**
   * The team this file is scoped to. Required, not defaulted: silently
   * falling back to unprorated is the exact defect this parameter exists to
   * prevent, so a caller has to say `null` to mean "no team" on purpose.
   */
  teamScope: string | null,
): CostGroupFigures {
  if (!isIncludedInBaseCost(row.planview_code)) return NO_FIGURES
  // Every figure is prorated by the same team share — the quarter through the
  // row's own prorated days, and the sprint/month conventions through a
  // prorated slice of those fixed lengths. A person half-allocated to this
  // team costs it half a sprint, not a whole one.
  const share = teamShare(row, teamScope)
  return {
    sprintPence: commercialCostPence(row, SPRINT_WORKING_DAYS * share, vatMultiplier),
    monthPence: commercialCostPence(row, MONTH_WORKING_DAYS * share, vatMultiplier),
    quarterPence: commercialCostPence(row, proratedDays(row, teamScope), vatMultiplier),
  }
}

/**
 * TEAM SCHEDULE — cross-charge cost group. PR rows only; everything else "—".
 * There is no Day rate sub-column here: the cross-charge rate is flat across
 * the platform and is stated once in the header instead of repeated down a
 * column of identical values.
 */
export function teamCrossChargeFigures(
  row: VariantAllocationRow,
  blendedDayRatePence: number,
  /** The team this file is scoped to — required, for the reason above. */
  teamScope: string | null,
): CostGroupFigures {
  // Prorated on the same basis as the commercial group above: the recharge a
  // team owes for a half-allocated person is half the recharge.
  const share = teamShare(row, teamScope)
  return {
    sprintPence: crossChargeCostPence(row, SPRINT_WORKING_DAYS * share, blendedDayRatePence),
    monthPence: crossChargeCostPence(row, MONTH_WORKING_DAYS * share, blendedDayRatePence),
    quarterPence: crossChargeCostPence(row, proratedDays(row, teamScope), blendedDayRatePence),
  }
}

/**
 * SUPPLIER SCHEDULE — commercial cost group.
 *
 * ⚠ DELIBERATE DIVERGENCE FROM teamCommercialFigures ABOVE. Every row gets a
 * real figure, NPC included, with no isIncludedInBaseCost gate.
 *
 * This is not an inconsistency to reconcile. The two files answer different
 * questions:
 *
 *   Team Schedule     — "what does running this team cost the platform?"
 *                       An NPC person's cost is borne by someone else's
 *                       budget, so it is not part of that answer: "—".
 *   Supplier Schedule — "what does Royal Mail Group pay this supplier?"
 *                       An NPC person is still a real person the supplier
 *                       still invoices for. Which internal budget the cost
 *                       lands against is RMG's business, not the supplier's,
 *                       and dropping the row would make the file disagree
 *                       with the invoice it exists to reconcile.
 *
 * Making these two agree would break one of the files. If a future change
 * needs them to converge, that is a product decision, not a cleanup.
 */
export function supplierCommercialFigures(
  row: VariantAllocationRow,
  vatMultiplier: number,
): CostGroupFigures {
  return {
    sprintPence: commercialCostPence(row, SPRINT_WORKING_DAYS, vatMultiplier),
    monthPence: commercialCostPence(row, MONTH_WORKING_DAYS, vatMultiplier),
    quarterPence: commercialCostPence(row, row.capacity_days ?? 0, vatMultiplier),
  }
}

/* ── Footer aggregates ─────────────────────────────────────────────── */

/** A row for a real, named person — vacant/TBC seats have no resource_id. */
function isNamedRow(row: VariantAllocationRow): boolean {
  return row.resource_id !== null && row.resource_id !== ''
}

/**
 * The people behind the rows, keyed by resource_id.
 *
 * The table lists allocation records, so a person mid-transition appears
 * twice; the footer counts them once. Vacant seats are excluded — "team size"
 * means people, not budgeted headcount.
 */
export function uniqueNamedPeople(rows: readonly VariantAllocationRow[]): string[] {
  const ids = new Set<string>()
  for (const row of rows) {
    if (isNamedRow(row) && row.resource_id) ids.add(row.resource_id)
  }
  return [...ids]
}

export function uniqueNamedPeopleCount(rows: readonly VariantAllocationRow[]): number {
  return uniqueNamedPeople(rows).length
}

/**
 * Total FTE across the unique people in these rows.
 *
 * Per person, not per row: someone who moved supplier mid-quarter holds two
 * 100% records and is one FTE, not two. Their records' utilisations are
 * summed and then capped at 100% — summing alone double-counts the transition
 * case, and taking one record alone would undercount a genuine split across
 * two suppliers.
 *
 * On a team-scoped file each record's utilisation is first cut to that team's
 * share, so the footer answers "how many whole people does this team have",
 * not "how many people touch this team". Someone 50% Cygnus at 90%
 * utilisation is 0.45 FTE to Cygnus, not 0.9.
 */
export function totalFte(
  rows: readonly VariantAllocationRow[],
  /** The team this file is scoped to; omit for an unscoped, unprorated total. */
  teamScope: string | null = null,
): number {
  const byPerson = new Map<string, number>()
  for (const row of rows) {
    if (!isNamedRow(row) || !row.resource_id) continue
    const share = teamShare(row, teamScope)
    byPerson.set(
      row.resource_id,
      (byPerson.get(row.resource_id) ?? 0) + row.utilisation_percent * share,
    )
  }
  let fte = 0
  for (const summed of byPerson.values()) {
    fte += Math.min(summed, 100) / 100
  }
  return fte
}

/** How many distinct teams these rows touch — the Supplier Schedule footer. */
export function distinctTeamCount(rows: readonly VariantAllocationRow[]): number {
  const teamIds = new Set<string>()
  for (const row of rows) {
    for (const team of row.teams) teamIds.add(team.teamId)
  }
  return teamIds.size
}

/** Headcount whose cost the platform actually bears — the stats-line figure. */
export function costIncludedPeopleCount(rows: readonly VariantAllocationRow[]): number {
  return uniqueNamedPeopleCount(rows.filter((r) => isIncludedInBaseCost(r.planview_code)))
}

/* ── Scoping ───────────────────────────────────────────────────────── */

/** The allocation records assigned to one team, by team id. */
export function rowsForTeam(
  rows: readonly VariantAllocationRow[],
  teamId: string,
): VariantAllocationRow[] {
  return rows.filter((row) => row.teams.some((t) => t.teamId === teamId))
}

/**
 * The allocation records belonging to one supplier, by supplier name.
 *
 * No planview filter: the Supplier Schedule shows everyone this supplier has
 * on the platform, NPC included — see supplierCommercialFigures.
 */
export function rowsForSupplier(
  rows: readonly VariantAllocationRow[],
  supplierName: string,
): VariantAllocationRow[] {
  return rows.filter((row) => row.supplier_name === supplierName)
}

/** Totals down a cost column, skipping the "—" rows rather than reading them as 0. */
export function sumCostColumn(
  figures: readonly CostGroupFigures[],
  key: keyof CostGroupFigures,
): number {
  return figures.reduce((sum, f) => sum + (f[key] ?? 0), 0)
}
