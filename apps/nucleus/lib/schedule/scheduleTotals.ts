// The Schedule page's headline money figures — Total Platform Cost and the
// Advised (blended) rate — computed once, in integer pence.
//
// These exist because the exported Rate Calculator workbook was computing its
// own versions of the same two figures and disagreeing with the page: it
// summed every allocation (the page excludes BAU and NPC via
// isIncludedInBaseCost) and never applied VAT to ad-hoc cost items (the page
// applies it per item's vat_applies). For Q3 FY 26/27 that read £2,752,077
// against the page's £2,671,777, and £594/day against £577.13 — two defects
// pulling opposite ways, so neither was obvious from the size of the gap.
//
// The rules encoded here are the page's, deliberately:
//   - Only allocations passing isIncludedInBaseCost() count toward cost.
//     BAU and NPC rows stay visible everywhere; they just are not
//     platform-borne. F_Gov is NOT excluded — it is overhead the platform
//     does carry (see the note on deriveIsChargeable in ./ui).
//   - Only PR allocations count toward X-chargeable days, via
//     isChargeableRow() — a different rule from the one above, on purpose.
//   - Ad-hoc items take VAT per their own vat_applies flag.
//   - ETP and Shared Services are taken as-is: their figures already embed
//     VAT, so uplifting them would double-count.
//
// Everything is integer pence with per-row rounding, matching how the page
// derives base_total_pence / vat_total_pence, so the two agree to the penny
// rather than to the nearest pound.

import { isIncludedInBaseCost, isChargeableRow, isCountedInHeadcount } from './ui'

export interface TotalsAllocation {
  planview_code: string | null | undefined
  utilisation_percent: number
  capacity_days: number | null
  /** Integer pence. */
  day_rate: number
  vat_applies: boolean
}

export interface TotalsCostItem {
  cost_item_category: string
  /** Integer pence. */
  amount_pence: number
  vat_applies: boolean
}

export interface ScheduleTotals {
  /** Allocations counted toward cost, VAT-inclusive, in pence. */
  resourcesVatPence: number
  /** Ad-hoc items, VAT applied per item, in pence. */
  adhocVatPence: number
  /** ETP + Shared Services, as stored (VAT already embedded), in pence. */
  etpSsPence: number
  /** Total Platform Cost — "inc. ad-hoc, ETP & Shared Services, plus VAT". */
  totalPlatformPence: number
  /** PR-only capacity days, utilisation-weighted. */
  xChargeableDays: number
  /** Total Platform Cost ÷ X-chargeable days, in pence. 0 when no PR days. */
  advisedRatePence: number
}

/**
 * The allocations that count toward cost — the single filter every total on
 * the Schedule page and in the export runs through. Callers that need to group
 * or count the same population (the export's supplier and location breakdown)
 * start from this rather than re-deriving the rule.
 */
export function includedAllocations<T extends TotalsAllocation>(allocations: T[]): T[] {
  return allocations.filter((a) => isIncludedInBaseCost(a.planview_code))
}

/** One allocation's cost before VAT, in pence — the page's own formula. */
export function allocationBasePence(a: TotalsAllocation): number {
  return Math.round(a.day_rate * (a.capacity_days ?? 0) * (a.utilisation_percent / 100))
}

/** One allocation's cost after VAT, in pence. */
export function allocationVatPence(a: TotalsAllocation, vatMultiplier: number): number {
  const base = allocationBasePence(a)
  // `!== false` rather than a truthy check: the page treats a missing flag as
  // "VAT applies", and so must this.
  return a.vat_applies !== false ? Math.round(base * vatMultiplier) : base
}

function isAdhoc(item: TotalsCostItem): boolean {
  return item.cost_item_category === 'ADHOC'
}

function isEtpOrSharedServices(item: TotalsCostItem): boolean {
  return (
    item.cost_item_category === 'ETP' || item.cost_item_category === 'SHARED_SERVICES'
  )
}

/** One row of a grouped breakdown — by supplier, by location, or otherwise. */
export interface GroupTotal {
  /** Rows in this group counted toward HEADCOUNT (isCountedInHeadcount) —
   *  BAU included, NPC excluded. Deliberately NOT the same population as
   *  basePence/vatPence below: BAU rows contribute to count but not to cost. */
  count: number
  basePence: number
  vatPence: number
}

/**
 * The cost and headcount rules, grouped.
 *
 * The export's Summary tab breaks Total Platform Cost — and headcount — down
 * by supplier and by location directly beneath the headline figures, so those
 * rows have to be built from the same populations the headlines are, or the
 * parts do not add up to the wholes they sit under. But cost and headcount
 * are two different populations (see isIncludedInBaseCost vs
 * isCountedInHeadcount in ./ui): a group's basePence/vatPence come only from
 * its cost-included rows, while its count comes from its headcount-included
 * rows. Do not collapse these back into one filter; that conflation is the
 * exact regression this function's tests guard against.
 *
 * The two gates are evaluated INDEPENDENTLY, per row, because neither
 * population reliably contains the other. On the Rate Calculator's own rule
 * headcount happens to be the larger set (BAU is headcount without cost), but
 * the Platform Schedule export counts named people only — and a vacant PR seat
 * is cost without a person in it. Gating the loop on headcount first, as this
 * did, would silently drop that seat's cost.
 *
 * @param keyOf the group a row belongs to; a null key drops the row (it belongs
 *   to no group the breakdown shows).
 * @param countsTowardHeadcount which rows the `count` field counts. Defaults to
 *   isCountedInHeadcount — the Rate Calculator's rule — so existing callers are
 *   unaffected. The Platform Schedule export passes its own, broader rule
 *   (every named person) without touching cost, which never varies.
 */
export function computeTotalsByGroup<T extends TotalsAllocation>(
  allocations: T[],
  keyOf: (allocation: T) => string | null | undefined,
  vatMultiplier: number,
  countsTowardHeadcount: (allocation: T) => boolean = (a) =>
    isCountedInHeadcount(a.planview_code),
): Map<string, GroupTotal> {
  const groups = new Map<string, GroupTotal>()

  for (const a of allocations) {
    const counts = countsTowardHeadcount(a)
    const costs = isIncludedInBaseCost(a.planview_code)
    // A row that does neither belongs in no group at all — leaving it out
    // keeps a group from being created empty (e.g. a supplier whose every row
    // is NPC should be absent, not present at zero).
    if (!counts && !costs) continue
    const key = keyOf(a)
    if (!key) continue
    const group = groups.get(key) ?? { count: 0, basePence: 0, vatPence: 0 }
    if (counts) group.count += 1
    if (costs) {
      group.basePence += allocationBasePence(a)
      group.vatPence += allocationVatPence(a, vatMultiplier)
    }
    groups.set(key, group)
  }

  return groups
}

/** A group that contributed nothing — used for a supplier with no costed rows. */
export const EMPTY_GROUP_TOTAL: GroupTotal = { count: 0, basePence: 0, vatPence: 0 }

/**
 * @param vatMultiplier 1 + vat_uplift_percent/100 (e.g. 1.07082).
 */
export function computeScheduleTotals(
  allocations: TotalsAllocation[],
  costItems: TotalsCostItem[],
  vatMultiplier: number,
): ScheduleTotals {
  const resourcesVatPence = allocations.reduce(
    (sum, a) =>
      isIncludedInBaseCost(a.planview_code) ? sum + allocationVatPence(a, vatMultiplier) : sum,
    0,
  )

  const adhocVatPence = costItems.reduce((sum, i) => {
    if (!isAdhoc(i)) return sum
    return sum + (i.vat_applies ? Math.round(i.amount_pence * vatMultiplier) : i.amount_pence)
  }, 0)

  const etpSsPence = costItems.reduce(
    (sum, i) => (isEtpOrSharedServices(i) ? sum + i.amount_pence : sum),
    0,
  )

  const totalPlatformPence = resourcesVatPence + adhocVatPence + etpSsPence

  const xChargeableDays = allocations.reduce(
    (sum, a) =>
      isChargeableRow(a.planview_code)
        ? sum + (a.capacity_days ?? 0) * (a.utilisation_percent / 100)
        : sum,
    0,
  )

  return {
    resourcesVatPence,
    adhocVatPence,
    etpSsPence,
    totalPlatformPence,
    xChargeableDays,
    advisedRatePence: xChargeableDays > 0 ? totalPlatformPence / xChargeableDays : 0,
  }
}
