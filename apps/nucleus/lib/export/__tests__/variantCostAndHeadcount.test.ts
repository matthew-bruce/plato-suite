import { describe, expect, it } from 'vitest'
import { computeScheduleTotals, computeTotalsByGroup } from '../../schedule/scheduleTotals'
import type { TotalsAllocation } from '../../schedule/scheduleTotals'
import { isCountedInHeadcount } from '../../schedule/ui'
import {
  getAllNamedPersonRows,
  getIncludedCostRows,
  isNamedPerson,
} from '../rowPopulations'
import type { PopulationRow } from '../rowPopulations'

/* ══════════════════════════════════════════════════════════════════════
   The regression guard for the conflation risk, across the two export
   variants rather than within one function.

   RULE A — cost must be IDENTICAL between Rate Calculator and Platform
   Schedule for the same dataset. Both run the same isIncludedInBaseCost
   path; a variant that computed its own would drift the moment either
   changed.

   RULE B — headcount must NOT be identical when NPC/BAU rows are present.
   Rate Calculator counts cost-relevant people (isCountedInHeadcount, which
   drops NPC); Platform Schedule counts every named person on the file. If
   a future change makes these two agree on this dataset, the two rules have
   been merged and one of them is now wrong.
══════════════════════════════════════════════════════════════════════ */

interface Row extends TotalsAllocation, PopulationRow {
  supplier_name: string | null
}

const VAT = 1.07082

const alloc = (over: Partial<Row>): Row => ({
  planview_code: 'PR',
  resource_id: 'res-1',
  supplier_name: 'EPAM',
  utilisation_percent: 100,
  capacity_days: 10,
  day_rate: 50000,
  vat_applies: false,
  ...over,
})

/**
 * A dataset carrying every shape that separates the two populations: named
 * people on each code, and a vacant seat that costs money with nobody in it.
 */
const SCHEDULE: Row[] = [
  alloc({ resource_id: 'p1', planview_code: 'PR' }),
  alloc({ resource_id: 'p2', planview_code: 'F_Gov' }),
  alloc({ resource_id: 'p3', planview_code: 'BAU' }), // headcount, no cost
  alloc({ resource_id: 'p4', planview_code: 'NPC', supplier_name: 'Capgemini' }),
  alloc({ resource_id: 'p5', planview_code: 'NPC', supplier_name: 'Capgemini' }),
  alloc({ resource_id: null, planview_code: 'PR' }), // cost, no headcount
]

/** Rate Calculator's population: NPC rows never reach the file at all. */
const rateCalculatorRows = SCHEDULE.filter((r) => r.planview_code !== 'NPC')
/** Platform Schedule's population: everything, NPC included. */
const platformScheduleRows = SCHEDULE

describe('RULE A — cost is identical between the two export variants', () => {
  it('Total Platform Cost matches exactly, to the penny', () => {
    const rateCalculator = computeScheduleTotals(rateCalculatorRows, [], VAT)
    const platformSchedule = computeScheduleTotals(platformScheduleRows, [], VAT)

    expect(platformSchedule.resourcesVatPence).toBe(rateCalculator.resourcesVatPence)
    expect(platformSchedule.totalPlatformPence).toBe(rateCalculator.totalPlatformPence)
    // Not vacuously zero — there is real money in this dataset.
    expect(platformSchedule.totalPlatformPence).toBeGreaterThan(0)
  })

  it('the Advised Rate that follows is identical too', () => {
    const rateCalculator = computeScheduleTotals(rateCalculatorRows, [], VAT)
    const platformSchedule = computeScheduleTotals(platformScheduleRows, [], VAT)

    expect(platformSchedule.xChargeableDays).toBe(rateCalculator.xChargeableDays)
    expect(platformSchedule.advisedRatePence).toBe(rateCalculator.advisedRatePence)
  })

  it('showing the NPC rows adds no cost — visibility and cost are separate questions', () => {
    // Platform Schedule lists two Capgemini NPC people the Rate Calculator
    // hides. They appear on the file and contribute nothing to any total.
    expect(platformScheduleRows).toHaveLength(rateCalculatorRows.length + 2)
    expect(getIncludedCostRows(platformScheduleRows)).toEqual(
      getIncludedCostRows(rateCalculatorRows),
    )
  })

  it('the grouped breakdown agrees on cost under either headcount rule', () => {
    const byRateCalculatorRule = computeTotalsByGroup(
      platformScheduleRows,
      (a) => a.supplier_name,
      VAT,
    )
    const byPlatformScheduleRule = computeTotalsByGroup(
      platformScheduleRows,
      (a) => a.supplier_name,
      VAT,
      isNamedPerson,
    )
    const sumCost = (groups: Map<string, { vatPence: number }>) =>
      [...groups.values()].reduce((s, g) => s + g.vatPence, 0)

    // Swapping the headcount rule must not move a penny of cost.
    expect(sumCost(byPlatformScheduleRule)).toBe(sumCost(byRateCalculatorRule))
    expect(sumCost(byPlatformScheduleRule)).toBe(
      computeScheduleTotals(platformScheduleRows, [], VAT).resourcesVatPence,
    )
  })

  it('a vacant seat keeps its cost under the named-person headcount rule', () => {
    // The specific way this could break: Platform Schedule counts people, and
    // a vacant seat is not one — but it is still budgeted money.
    const vacantOnly: Row[] = [alloc({ resource_id: null, planview_code: 'PR' })]
    const groups = computeTotalsByGroup(vacantOnly, (a) => a.supplier_name, VAT, isNamedPerson)
    const epam = groups.get('EPAM')

    expect(epam?.vatPence).toBe(computeScheduleTotals(vacantOnly, [], VAT).resourcesVatPence)
    expect(epam?.vatPence).toBeGreaterThan(0)
    expect(epam?.count).toBe(0) // cost without headcount
  })
})

describe('RULE B — headcount differs, on purpose, when NPC/BAU are present', () => {
  const rateCalculatorHeadcount = rateCalculatorRows.filter((r) =>
    isCountedInHeadcount(r.planview_code),
  ).length
  const platformScheduleHeadcount = getAllNamedPersonRows(platformScheduleRows).length

  it('Platform Schedule counts every named person; Rate Calculator counts by code', () => {
    // The two rules differ on two axes, not one, and this pins both:
    //
    //  - WHICH CODES. Rate Calculator drops NPC; Platform Schedule keeps it.
    //  - WHAT IS COUNTED. Rate Calculator's rule reads planview_code alone, so
    //    a vacant PR seat counts toward its headcount even though nobody is in
    //    it. Platform Schedule counts people, so the same seat does not.
    //
    // Rate Calculator: PR + F_Gov + BAU named people, plus the vacant PR
    // seat its code-based rule also counts = 4.
    expect(rateCalculatorHeadcount).toBe(4)
    // Platform Schedule: the 5 named people, NPC included, vacant seat not.
    expect(platformScheduleHeadcount).toBe(5)
    // Existing Rate Calculator behaviour, recorded rather than changed — this
    // branch is additive and must not move that figure.
    expect(rateCalculatorRows.filter((r) => r.resource_id !== null)).toHaveLength(3)
  })

  it('the two headcounts are NOT equal — if they ever are, the rules have merged', () => {
    expect(platformScheduleHeadcount).not.toBe(rateCalculatorHeadcount)
    expect(platformScheduleHeadcount).toBeGreaterThan(rateCalculatorHeadcount)
  })

  it('Platform Schedule headcount is not filtered by cost inclusion', () => {
    // Stated directly rather than inferred from the totals: the BAU and NPC
    // people are all in the headcount population and none of them in cost.
    const headcount = getAllNamedPersonRows(platformScheduleRows)
    const costed = getIncludedCostRows(platformScheduleRows)

    for (const code of ['BAU', 'NPC']) {
      const person = headcount.find((r) => r.planview_code === code)
      expect(person).toBeDefined()
      expect(costed).not.toContain(person)
    }
  })

  it('grouped counts reflect whichever rule the variant passes', () => {
    const rateCalculatorGroups = computeTotalsByGroup(
      rateCalculatorRows,
      (a) => a.supplier_name,
      VAT,
    )
    const platformScheduleGroups = computeTotalsByGroup(
      platformScheduleRows,
      (a) => a.supplier_name,
      VAT,
      isNamedPerson,
    )
    const sumCount = (groups: Map<string, { count: number }>) =>
      [...groups.values()].reduce((s, g) => s + g.count, 0)

    expect(sumCount(rateCalculatorGroups)).toBe(rateCalculatorHeadcount)
    expect(sumCount(platformScheduleGroups)).toBe(platformScheduleHeadcount)
    expect(sumCount(platformScheduleGroups)).not.toBe(sumCount(rateCalculatorGroups))
  })

  it('Capgemini appears on Platform Schedule as headcount at zero cost', () => {
    // The real Q3 shape: a supplier whose every row is NPC. Absent from the
    // Rate Calculator entirely, present on the Platform Schedule with two
    // people and nothing to charge.
    const groups = computeTotalsByGroup(
      platformScheduleRows,
      (a) => a.supplier_name,
      VAT,
      isNamedPerson,
    )
    expect(groups.get('Capgemini')?.count).toBe(2)
    expect(groups.get('Capgemini')?.vatPence).toBe(0)

    const rateCalculatorGroups = computeTotalsByGroup(
      rateCalculatorRows,
      (a) => a.supplier_name,
      VAT,
    )
    expect(rateCalculatorGroups.has('Capgemini')).toBe(false)
  })
})

describe('the default headcount rule is unchanged for existing callers', () => {
  it('omitting the predicate behaves exactly as isCountedInHeadcount did', () => {
    // Rate Calculator call sites pass three arguments and must be unaffected
    // by the new fourth. Pinned by computing both ways over the same rows.
    const implicit = computeTotalsByGroup(SCHEDULE, (a) => a.supplier_name, VAT)
    const explicit = computeTotalsByGroup(SCHEDULE, (a) => a.supplier_name, VAT, (a) =>
      isCountedInHeadcount(a.planview_code),
    )
    expect([...implicit.entries()]).toEqual([...explicit.entries()])
  })
})
