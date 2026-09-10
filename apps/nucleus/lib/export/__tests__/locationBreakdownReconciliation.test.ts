import { describe, expect, it } from 'vitest'
import { computeScheduleTotals, computeTotalsByGroup } from '../../schedule/scheduleTotals'
import type { GroupTotal } from '../../schedule/scheduleTotals'
import { LOCATION_BUCKETS, locationBucket } from '../../schedule/ui'
import {
  Q4_ALLOCATIONS,
  Q4_COST_ITEMS,
  Q4_VAT_MULTIPLIER,
  Q4_EXPECTED,
} from '../../schedule/__tests__/fixtures/q4Fy2526'
import {
  Q2_ALLOCATIONS,
  Q2_COST_ITEMS,
  Q2_VAT_MULTIPLIER,
  Q2_EXPECTED,
} from '../../schedule/__tests__/fixtures/q2Fy2627'
import type { LocatedAllocation } from '../../schedule/__tests__/fixtures/q4Fy2526'

/* ══════════════════════════════════════════════════════════════════════
   The Summary tab's LOCATION TOTALS block sits directly beneath Total
   Platform Cost, so its rows have to add up to it. They only listed
   Onshore, Nearshore and Offshore — and resource_location_enum has a
   fourth value, 'unspecified', which is in use. Every such row fell
   through every bucket and vanished from the breakdown while still
   counting toward the headline above it.

   Q3 FY 26/27, which the other reconciliation tests use, has no
   unspecified rows: its three-bucket breakdown tied by luck. These are the
   two periods that actually carry them — Q4 FY 25/26 with four rows and
   Q2 FY 26/27 with one — so the tie is proved where it could fail.
══════════════════════════════════════════════════════════════════════ */

const gbp = (pence: number) => Math.round(pence / 100)

function sumGroups(groups: Map<string, GroupTotal>) {
  return [...groups.values()].reduce(
    (acc, g) => ({ vatPence: acc.vatPence + g.vatPence, count: acc.count + g.count }),
    { vatPence: 0, count: 0 },
  )
}

/** The export's own grouping: bucketed, exactly as route.ts keys it. */
function bucketed(allocations: LocatedAllocation[], vat: number) {
  return computeTotalsByGroup(allocations, (a) => locationBucket(a.resource_location), vat)
}

/** The grouping the export used before this fix: the raw column, unbucketed,
 *  read against a hard-coded list of three names. */
function threeBucketOnly(allocations: LocatedAllocation[], vat: number) {
  const raw = computeTotalsByGroup(allocations, (a) => a.resource_location, vat)
  let vatPence = 0
  for (const name of ['onshore', 'nearshore', 'offshore']) {
    vatPence += raw.get(name)?.vatPence ?? 0
  }
  return vatPence
}

const PERIODS = [
  {
    label: 'Q4 FY 25/26',
    allocations: Q4_ALLOCATIONS,
    costItems: Q4_COST_ITEMS,
    vat: Q4_VAT_MULTIPLIER,
    expected: Q4_EXPECTED,
  },
  {
    label: 'Q2 FY 26/27',
    allocations: Q2_ALLOCATIONS,
    costItems: Q2_COST_ITEMS,
    vat: Q2_VAT_MULTIPLIER,
    expected: Q2_EXPECTED,
  },
] as const

describe.each(PERIODS)(
  '$label — the four-bucket location breakdown ties to the headline',
  ({ allocations, costItems, vat, expected }) => {
    const headline = computeScheduleTotals(allocations, costItems, vat)
    const byLocation = bucketed(allocations as unknown as LocatedAllocation[], vat)

    it('the snapshot is the one these figures were derived from', () => {
      expect(allocations.length).toBe(expected.allocationRows)
      const unspecified = allocations.filter(
        (a) => locationBucket(a.resource_location) === 'Unspecified',
      )
      expect(unspecified.length).toBe(expected.locationHeadcounts.Unspecified)
      // The point of this period: it has rows the old breakdown could drop.
      expect(unspecified.length).toBeGreaterThan(0)
    })

    it('the location rows sum to the headline resource component, to the penny', () => {
      expect(sumGroups(byLocation).vatPence).toBe(headline.resourcesVatPence)
      expect(gbp(sumGroups(byLocation).vatPence)).toBe(expected.includedResourcesGbp)
    })

    it('and reconcile to Total Platform Cost once ad-hoc, ETP and SS are added', () => {
      const reconciled =
        sumGroups(byLocation).vatPence + headline.adhocVatPence + headline.etpSsPence
      expect(reconciled).toBe(headline.totalPlatformPence)
      expect(gbp(reconciled)).toBe(expected.totalPlatformGbp)
    })

    it('every headcounted row (BAU included, NPC excluded) lands in exactly one of the four buckets', () => {
      // Not the costed population (which also excludes BAU) — the export's
      // headcount columns use isCountedInHeadcount, a strictly larger set.
      const headcounted = allocations.filter((a) => a.planview_code !== 'NPC')
      expect(sumGroups(byLocation).count).toBe(headcounted.length)
      expect([...byLocation.keys()].every((k) => (LOCATION_BUCKETS as readonly string[]).includes(k))).toBe(true)
    })

    it('BAU counts toward headcount but not cost — the two populations differ by exactly the BAU rows', () => {
      const costed = allocations.filter(
        (a) => a.planview_code !== 'BAU' && a.planview_code !== 'NPC',
      )
      const bauRows = allocations.filter((a) => a.planview_code === 'BAU')
      expect(bauRows.length).toBeGreaterThan(0)
      expect(sumGroups(byLocation).count - costed.length).toBe(bauRows.length)
    })

    it('splits across the four buckets as the page does', () => {
      for (const name of LOCATION_BUCKETS) {
        expect(gbp(byLocation.get(name)?.vatPence ?? 0)).toBe(expected.locationGbp[name])
        expect(byLocation.get(name)?.count ?? 0).toBe(expected.locationHeadcounts[name])
      }
      const summed = LOCATION_BUCKETS.reduce((s, n) => s + expected.locationGbp[n], 0)
      expect(summed).toBe(expected.includedResourcesGbp)
    })

    it('the old three-name breakdown was short by exactly the unspecified rows', () => {
      const before = threeBucketOnly(allocations as unknown as LocatedAllocation[], vat)
      expect(gbp(before)).toBe(expected.threeBucketOnlyGbp)
      // In pence, so the shortfall is the Unspecified bucket itself and not
      // two independently rounded pound figures that happen to be close.
      const shortfall = headline.resourcesVatPence - before
      expect(shortfall).toBe(expected.droppedByThreeBucketPence)
      expect(shortfall).toBe(byLocation.get('Unspecified')!.vatPence)
      expect(shortfall).toBeGreaterThan(0)
      expect(gbp(shortfall)).toBe(expected.locationGbp.Unspecified)
    })

    it('a NULL location reports as Unspecified alongside the literal value', () => {
      // Nothing in the live data has a NULL location today, but the column is
      // nullable and vacant rows have no resource to fall back to. Both must
      // land in the same bucket or the tie is only true of today's data.
      const withNull = [
        ...(allocations as unknown as LocatedAllocation[]),
        { ...allocations[0], resource_location: null, planview_code: 'PR' },
      ]
      const groups = bucketed(withNull, vat)
      const totals = computeScheduleTotals(withNull, costItems, vat)
      expect(sumGroups(groups).vatPence).toBe(totals.resourcesVatPence)
      expect(groups.get('Unspecified')!.count).toBe(
        expected.locationHeadcounts.Unspecified + 1,
      )
    })
  },
)
