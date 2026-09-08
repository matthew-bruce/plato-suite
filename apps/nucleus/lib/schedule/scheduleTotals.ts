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

import { isIncludedInBaseCost, isChargeableRow } from './ui'

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
