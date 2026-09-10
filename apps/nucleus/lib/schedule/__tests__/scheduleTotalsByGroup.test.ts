import { describe, expect, it } from 'vitest'
import {
  computeScheduleTotals,
  computeTotalsByGroup,
  includedAllocations,
  EMPTY_GROUP_TOTAL,
} from '../scheduleTotals'
import type { TotalsAllocation } from '../scheduleTotals'
import { locationBucket, isIncludedInBaseCost, isCountedInHeadcount } from '../ui'
import {
  Q3_ALLOCATIONS,
  Q3_COST_ITEMS,
  Q3_VAT_MULTIPLIER,
  Q3_EXPECTED,
} from './fixtures/q3Fy2627'

/* ══════════════════════════════════════════════════════════════════════
   The Summary tab's supplier and location breakdown sits directly under
   Total Platform Cost, so its rows have to add up to that figure. They did
   not: the breakdown was SUMIF'd over every allocation on the Rate
   Calculator sheet, counting the BAU and NPC rows the headline excludes.
   On Q3 that was £89,597 — all of it Capgemini, whose ten rows are every
   one NPC.
══════════════════════════════════════════════════════════════════════ */

const gbp = (pence: number) => Math.round(pence / 100)

/** Sum a grouped breakdown back up, the way the sheet's total row does. */
function sumGroups(groups: Map<string, { vatPence: number; basePence: number; count: number }>) {
  return [...groups.values()].reduce(
    (acc, g) => ({
      vatPence: acc.vatPence + g.vatPence,
      basePence: acc.basePence + g.basePence,
      count: acc.count + g.count,
    }),
    { vatPence: 0, basePence: 0, count: 0 },
  )
}

describe('Q3 FY 26/27 — the breakdown ties to the headline', () => {
  const headline = computeScheduleTotals(Q3_ALLOCATIONS, Q3_COST_ITEMS, Q3_VAT_MULTIPLIER)
  const bySupplier = computeTotalsByGroup(Q3_ALLOCATIONS, (a) => a.supplier_name, Q3_VAT_MULTIPLIER)
  const byLocation = computeTotalsByGroup(
    Q3_ALLOCATIONS,
    (a) => a.resource_location,
    Q3_VAT_MULTIPLIER,
  )
  const byPlanview = computeTotalsByGroup(Q3_ALLOCATIONS, (a) => a.planview_code, Q3_VAT_MULTIPLIER)

  it('the supplier rows sum to the headline resource component, to the penny', () => {
    expect(sumGroups(bySupplier).vatPence).toBe(headline.resourcesVatPence)
  })

  it('and reconcile to Total Platform Cost once ad-hoc and ETP are added', () => {
    const reconciled =
      sumGroups(bySupplier).vatPence + headline.adhocVatPence + headline.etpSsPence
    expect(reconciled).toBe(headline.totalPlatformPence)
    expect(gbp(reconciled)).toBe(Q3_EXPECTED.totalPlatformGbp)
  })

  it('the planview split ties as well: PR + F_Gov is the whole resource component', () => {
    const pr = byPlanview.get('PR') ?? EMPTY_GROUP_TOTAL
    const fgov = byPlanview.get('F_Gov') ?? EMPTY_GROUP_TOTAL
    expect(pr.vatPence + fgov.vatPence).toBe(headline.resourcesVatPence)
    expect(pr.vatPence + fgov.vatPence).toBe(sumGroups(bySupplier).vatPence)
  })

  it('Capgemini contributed £89,597 before and contributes nothing now', () => {
    expect(bySupplier.has('Capgemini')).toBe(false)
    const capgeminiUnfiltered = Q3_ALLOCATIONS.filter((a) => a.supplier_name === 'Capgemini').reduce(
      (s, a) => {
        const base = Math.round(a.day_rate * (a.capacity_days ?? 0) * (a.utilisation_percent / 100))
        return s + (a.vat_applies ? Math.round(base * Q3_VAT_MULTIPLIER) : base)
      },
      0,
    )
    expect(gbp(capgeminiUnfiltered)).toBe(Q3_EXPECTED.capgeminiVatGbpBefore)
  })

  it('NPC appears in no group at all; BAU appears with zero cost', () => {
    // The exact regression this guards against: treating "excluded from
    // cost" (isIncludedInBaseCost) as "excluded from everything" would put
    // BAU here too. BAU is a real, known person — Royal Mail Group's own
    // headcount — and must appear, just at £0.
    expect(byPlanview.has('NPC')).toBe(false)
    expect(byPlanview.get('BAU')?.count).toBe(1)
    expect(byPlanview.get('BAU')?.vatPence).toBe(0)
    expect(byPlanview.get('BAU')?.basePence).toBe(0)
  })

  it('headcount counts BAU but not NPC — a different, strictly larger population than cost', () => {
    // Q3: 103 rows, 10 NPC (all Capgemini) + 1 BAU excluded from cost.
    // Headcount excludes only the 10 NPC rows, so it is the costed
    // population plus the one BAU row, not equal to it.
    const costedRowCount = includedAllocations(Q3_ALLOCATIONS).length
    expect(sumGroups(bySupplier).count).toBe(costedRowCount + 1)
    expect(sumGroups(bySupplier).count).toBe(
      Q3_EXPECTED.allocationRows - Q3_EXPECTED.excludedRows + 1,
    )
    expect(Q3_ALLOCATIONS.length).toBe(Q3_EXPECTED.allocationRows)
  })

  // The regression itself, pinned directly against the two rules rather than
  // against any fixture: if isCountedInHeadcount is ever reimplemented as a
  // delegate to isIncludedInBaseCost (merging the two rules back into one),
  // this fails immediately regardless of what data happens to be in scope.
  it('isIncludedInBaseCost and isCountedInHeadcount diverge on BAU — merging them is the regression', () => {
    expect(isIncludedInBaseCost('BAU')).toBe(false)
    expect(isCountedInHeadcount('BAU')).toBe(true)
  })
  it('isIncludedInBaseCost and isCountedInHeadcount agree everywhere else', () => {
    expect(isIncludedInBaseCost('NPC')).toBe(false)
    expect(isCountedInHeadcount('NPC')).toBe(false)
    for (const code of ['PR', 'F_Gov']) {
      expect(isIncludedInBaseCost(code)).toBe(true)
      expect(isCountedInHeadcount(code)).toBe(true)
    }
  })

  it('the difference from the old breakdown is exactly the £89,597', () => {
    const unfilteredVat = Q3_ALLOCATIONS.reduce((s, a) => {
      const base = Math.round(a.day_rate * (a.capacity_days ?? 0) * (a.utilisation_percent / 100))
      return s + (a.vat_applies ? Math.round(base * Q3_VAT_MULTIPLIER) : base)
    }, 0)
    expect(gbp(unfilteredVat - sumGroups(bySupplier).vatPence)).toBe(Q3_EXPECTED.excludedRowsGbp)
  })

  it('the location rows tie to the headline too, with nothing left over', () => {
    // Every allocation carries a location on its own row, so the three
    // location rows account for the whole resource component — no shortfall.
    // The export used to read location from the joined resources table
    // instead, which lost every vacant seat (no resources row to join to)
    // and misfiled rows whose two values disagreed.
    expect(sumGroups(byLocation).vatPence).toBe(headline.resourcesVatPence)
    expect(sumGroups(byLocation).vatPence).toBe(sumGroups(bySupplier).vatPence)
    expect(sumGroups(byLocation).count).toBe(sumGroups(bySupplier).count)
    expect(includedAllocations(Q3_ALLOCATIONS).every((a) => a.resource_location)).toBe(true)
  })

  it('splits across the three locations as the page does', () => {
    expect(gbp(byLocation.get('Onshore')!.vatPence)).toBe(Q3_EXPECTED.locationGbp.Onshore)
    expect(gbp(byLocation.get('Nearshore')!.vatPence)).toBe(Q3_EXPECTED.locationGbp.Nearshore)
    expect(gbp(byLocation.get('Offshore')!.vatPence)).toBe(Q3_EXPECTED.locationGbp.Offshore)
    const sum =
      Q3_EXPECTED.locationGbp.Onshore +
      Q3_EXPECTED.locationGbp.Nearshore +
      Q3_EXPECTED.locationGbp.Offshore
    expect(sum).toBe(Q3_EXPECTED.includedResourcesGbp)
  })
})

/* ══════════════════════════════════════════════════════════════════════
   Realistic supplier / location shapes, including the Capgemini case:
   a supplier whose every row is NPC, which now contributes nothing.
══════════════════════════════════════════════════════════════════════ */

interface Row extends TotalsAllocation {
  supplier_name: string | null
  resource_location: string | null
}

const alloc = (over: Partial<Row>): Row => ({
  planview_code: 'PR',
  utilisation_percent: 100,
  capacity_days: 10,
  day_rate: 50000,
  vat_applies: false,
  supplier_name: 'EPAM',
  resource_location: 'Onshore',
  ...over,
})

const SCHEDULE: Row[] = [
  alloc({ supplier_name: 'EPAM', resource_location: 'Onshore' }),
  alloc({ supplier_name: 'EPAM', resource_location: 'Offshore' }),
  alloc({ supplier_name: 'TCS', resource_location: 'Nearshore', planview_code: 'F_Gov' }),
  // Capgemini's whole allocation is NPC — the real Q3 shape.
  alloc({ supplier_name: 'Capgemini', resource_location: 'Offshore', planview_code: 'NPC' }),
  alloc({ supplier_name: 'Capgemini', resource_location: 'Offshore', planview_code: 'NPC' }),
  // A single BAU row against a supplier that also has costed work.
  alloc({ supplier_name: 'EPAM', resource_location: 'Onshore', planview_code: 'BAU' }),
]

describe('supplier and location breakdowns over a realistic schedule', () => {
  const vat = 1
  const headline = computeScheduleTotals(SCHEDULE, [], vat)
  const bySupplier = computeTotalsByGroup(SCHEDULE, (a) => a.supplier_name, vat)
  const byLocation = computeTotalsByGroup(SCHEDULE, (a) => a.resource_location, vat)

  it('the supplier rows sum to the headline resource component', () => {
    expect(sumGroups(bySupplier).vatPence).toBe(headline.resourcesVatPence)
  })

  it('the location rows sum to the same figure', () => {
    expect(sumGroups(byLocation).vatPence).toBe(headline.resourcesVatPence)
  })

  it('a supplier whose every row is excluded contributes nothing, and is not counted', () => {
    expect(bySupplier.has('Capgemini')).toBe(false)
    expect((bySupplier.get('Capgemini') ?? EMPTY_GROUP_TOTAL).vatPence).toBe(0)
    expect((bySupplier.get('Capgemini') ?? EMPTY_GROUP_TOTAL).count).toBe(0)
  })

  it("a supplier's headcount counts its BAU row too, but its cost still doesn't", () => {
    // EPAM has three rows: two PR, one BAU. All three count toward
    // headcount; only the two PR rows count toward cost.
    expect(bySupplier.get('EPAM')!.count).toBe(3)
    expect(bySupplier.get('EPAM')!.vatPence).toBe(2 * 500000)
  })

  it('F_Gov is counted — it is overhead the platform carries', () => {
    expect(bySupplier.get('TCS')!.count).toBe(1)
    expect(bySupplier.get('TCS')!.vatPence).toBe(500000)
  })

  it('the headcounts across the breakdown count BAU but not NPC, unlike the costed-row population', () => {
    // SCHEDULE: 6 rows — EPAM ×3 (2 PR + 1 BAU), TCS ×1 (F_Gov),
    // Capgemini ×2 (both NPC). Headcount excludes only the 2 NPC rows (4);
    // cost excludes those 2 plus the 1 BAU row too (3).
    expect(includedAllocations(SCHEDULE).length).toBe(3)
    expect(sumGroups(bySupplier).count).toBe(includedAllocations(SCHEDULE).length + 1)
    expect(sumGroups(bySupplier).count).toBe(4)
    expect(SCHEDULE.length).toBe(6)
  })

  it('rows with no group key are dropped rather than lumped together', () => {
    const withBlank = [...SCHEDULE, alloc({ supplier_name: null })]
    const groups = computeTotalsByGroup(withBlank, (a) => a.supplier_name, vat)
    expect([...groups.keys()]).not.toContain('')
    expect([...groups.keys()].sort()).toEqual(['EPAM', 'TCS'])
  })

  it('a blank location is short when grouped raw, and ties once bucketed', () => {
    // Grouping on the raw column drops any row whose location is blank — the
    // export did exactly that, against a hard-coded list of three names, and
    // so lost every 'unspecified' row from a breakdown that still sat under a
    // headline counting them. locationBucket() is what closed it: the same
    // rows, grouped by a function that always returns one of four names.
    const withBlank = [...SCHEDULE, alloc({ supplier_name: 'EPAM', resource_location: null })]
    const suppliers = computeTotalsByGroup(withBlank, (a) => a.supplier_name, vat)
    const raw = computeTotalsByGroup(withBlank, (a) => a.resource_location, vat)
    expect(sumGroups(suppliers).vatPence - sumGroups(raw).vatPence).toBe(500000)

    const bucketed = computeTotalsByGroup(
      withBlank,
      (a) => locationBucket(a.resource_location),
      vat,
    )
    expect(sumGroups(bucketed).vatPence).toBe(sumGroups(suppliers).vatPence)
    expect(sumGroups(bucketed).count).toBe(sumGroups(suppliers).count)
    expect(bucketed.get('Unspecified')!.vatPence).toBe(500000)
  })
})
