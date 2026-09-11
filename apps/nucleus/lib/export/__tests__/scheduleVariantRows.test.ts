import { describe, it, expect } from 'vitest'
import {
  SPRINT_WORKING_DAYS,
  MONTH_WORKING_DAYS,
  commercialCostPence,
  commercialBasePence,
  crossChargeCostPence,
  teamCrossChargeFigures,
  supplierRowMoney,
  formatTeamSplits,
  teamSplitCell,
  uniqueNamedPeopleCount,
  totalFte,
  distinctTeamCount,
  crossChargedPeopleCount,
  rowsForTeam,
  rowsForSupplier,
  sumCostColumn,
} from '../scheduleVariantRows'
import type { VariantAllocationRow, TeamAssignmentRef } from '../scheduleVariantRows'

const VAT = 1.07082
const BLENDED_RATE = 60_500 // £605.00/day in pence

const PLUTO: TeamAssignmentRef = { teamId: 't-pluto', teamName: 'Pluto', capacitySplit: 0.5 }
const CYGNUS: TeamAssignmentRef = { teamId: 't-cygnus', teamName: 'Cygnus', capacitySplit: 0.5 }
const JANUS: TeamAssignmentRef = { teamId: 't-janus', teamName: 'Janus', capacitySplit: 1.0 }

// The default fixture sits wholly on Janus, so scoping to it exercises the
// proration path at a share of 1.0 — i.e. these tests also prove that an
// unsplit resource is unchanged by team proration.
const JANUS_SCOPE = 't-janus'

function row(over: Partial<VariantAllocationRow> = {}): VariantAllocationRow {
  return {
    allocation_id: 'a1',
    resource_id: 'r1',
    resource_name: 'A. Patel',
    role_title: 'Engineer',
    planview_code: 'PR',
    supplier_name: 'Capgemini',
    supplier_abbreviation: 'CG',
    supplier_colour: '#003C82',
    resource_location: 'onshore',
    utilisation_percent: 100,
    capacity_days: 64,
    day_rate: 60_000,
    vat_applies: true,
    teams: [JANUS],
    ...over,
  }
}

/* ── Cross-charge inclusion: the is_chargeable rule, not the cost rule ── */

describe('Team Schedule cross-charge inclusion', () => {
  // A fixture carrying all four planview codes, so a change that widens or
  // narrows the rule shows up here rather than in a finance conversation.
  const mixed: VariantAllocationRow[] = [
    row({ allocation_id: 'pr', resource_id: 'p1', planview_code: 'PR' }),
    row({ allocation_id: 'fgov', resource_id: 'p2', planview_code: 'F_Gov' }),
    row({ allocation_id: 'bau', resource_id: 'p3', planview_code: 'BAU' }),
    row({ allocation_id: 'npc', resource_id: 'p4', planview_code: 'NPC' }),
  ]

  it('gives a PR row a cross-charge figure for sprint, month and quarter', () => {
    const figures = teamCrossChargeFigures(mixed[0], BLENDED_RATE, JANUS_SCOPE)
    expect(figures.sprintPence).toBe(60_500 * 10)
    expect(figures.monthPence).toBe(60_500 * 21)
    expect(figures.quarterPence).toBe(60_500 * 64)
  })

  it('gives F_Gov, BAU and NPC rows no cross-charge figure at all', () => {
    for (const r of mixed.slice(1)) {
      const figures = teamCrossChargeFigures(r, BLENDED_RATE, JANUS_SCOPE)
      expect(figures.sprintPence).toBeNull()
      expect(figures.monthPence).toBeNull()
      expect(figures.quarterPence).toBeNull()
    }
  })

  // F_Gov is the one that gets "fixed" by mistake: its cost is real and
  // counted, so it looks like it belongs in a cost column — but it is never
  // recovered against a PR ticket.
  it('excludes F_Gov from cross-charge while the Supplier file still prices it', () => {
    // F_Gov's cost is real and the supplier still invoices for it; it is
    // simply never recovered against a PR ticket. The two files say so
    // independently.
    const fgov = mixed[1]
    expect(teamCrossChargeFigures(fgov, BLENDED_RATE, JANUS_SCOPE).quarterPence).toBeNull()
    expect(supplierRowMoney(fgov, VAT).basePence).toBeGreaterThan(0)
  })

  it('scales cross-charge by utilisation but never the rate itself', () => {
    const half = row({ utilisation_percent: 50 })
    expect(crossChargeCostPence(half, 10, BLENDED_RATE)).toBe(60_500 * 10 * 0.5)
  })
})

/* ── Quarter reads each row's own day count, never a shared constant ── */

describe('Quarter cost uses each row’s own Total days', () => {
  // The real reason no single "N working days" figure appears at file level:
  // a UK resource and an India resource do not have the same quarter.
  const uk = row({ allocation_id: 'uk', resource_id: 'uk1', capacity_days: 64 })
  const india = row({ allocation_id: 'in', resource_id: 'in1', capacity_days: 63 })

  it('produces different cross-charge Quarter figures at identical utilisation', () => {
    expect(uk.utilisation_percent).toBe(india.utilisation_percent)
    expect(teamCrossChargeFigures(uk, BLENDED_RATE, JANUS_SCOPE).quarterPence).toBe(60_500 * 64)
    expect(teamCrossChargeFigures(india, BLENDED_RATE, JANUS_SCOPE).quarterPence).toBe(60_500 * 63)
  })

  it('produces different supplier Base figures at identical rate and utilisation', () => {
    expect(uk.day_rate).toBe(india.day_rate)
    const ukBase = supplierRowMoney(uk, VAT).basePence
    const indiaBase = supplierRowMoney(india, VAT).basePence
    expect(ukBase).not.toBe(indiaBase)
    expect(ukBase).toBe(commercialBasePence(uk, 64))
    expect(indiaBase).toBe(commercialBasePence(india, 63))
  })

  it('keeps Sprint and Month on the fixed conventions for both', () => {
    // Sprint/month are deliberately NOT location-adjusted — they are a
    // comparable unit, not a measurement of anyone's actual calendar.
    expect(SPRINT_WORKING_DAYS).toBe(10)
    expect(MONTH_WORKING_DAYS).toBe(21)
    expect(teamCrossChargeFigures(uk, BLENDED_RATE, JANUS_SCOPE).sprintPence).toBe(
      teamCrossChargeFigures(india, BLENDED_RATE, JANUS_SCOPE).sprintPence,
    )
  })

  it('treats a null capacity_days as zero days rather than throwing', () => {
    const noDays = row({ capacity_days: null })
    expect(teamCrossChargeFigures(noDays, BLENDED_RATE, JANUS_SCOPE).quarterPence).toBe(0)
    expect(supplierRowMoney(noDays, VAT).basePence).toBe(0)
  })
})

/* ── One person, several allocation records ── */

describe('multi-row-per-person handling', () => {
  // A mid-quarter supplier transition: same human, two allocation records.
  const transition: VariantAllocationRow[] = [
    row({
      allocation_id: 'cg-half',
      resource_id: 'same-person',
      supplier_name: 'Capgemini',
      supplier_abbreviation: 'CG',
      capacity_days: 32,
      utilisation_percent: 100,
    }),
    row({
      allocation_id: 'tcs-half',
      resource_id: 'same-person',
      supplier_name: 'Tata Consultancy Services',
      supplier_abbreviation: 'TCS',
      capacity_days: 32,
      utilisation_percent: 100,
    }),
  ]

  it('keeps both allocation records as separate table rows', () => {
    expect(transition).toHaveLength(2)
    expect(transition[0].allocation_id).not.toBe(transition[1].allocation_id)
    expect(transition[0].supplier_abbreviation).toBe('CG')
    expect(transition[1].supplier_abbreviation).toBe('TCS')
  })

  it('counts the person once in the footer headcount, not twice', () => {
    expect(uniqueNamedPeopleCount(transition)).toBe(1)
  })

  it('counts one FTE, not two, for two 100% records of the same person', () => {
    expect(totalFte(transition)).toBe(1)
  })

  it('still counts a genuine 50/50 two-team split as one whole FTE', () => {
    const splitPerson: VariantAllocationRow[] = [
      row({ allocation_id: 's1', resource_id: 'split-person', utilisation_percent: 50 }),
      row({ allocation_id: 's2', resource_id: 'split-person', utilisation_percent: 50 }),
    ]
    expect(uniqueNamedPeopleCount(splitPerson)).toBe(1)
    expect(totalFte(splitPerson)).toBe(1)
  })

  it('adds two distinct half-time people to one FTE between them', () => {
    const twoHalves: VariantAllocationRow[] = [
      row({ allocation_id: 'h1', resource_id: 'person-a', utilisation_percent: 50 }),
      row({ allocation_id: 'h2', resource_id: 'person-b', utilisation_percent: 50 }),
    ]
    expect(uniqueNamedPeopleCount(twoHalves)).toBe(2)
    expect(totalFte(twoHalves)).toBe(1)
  })

  it('excludes vacant/TBC seats from both people and FTE', () => {
    const withVacancy: VariantAllocationRow[] = [
      row({ allocation_id: 'named', resource_id: 'real-person' }),
      row({ allocation_id: 'vacant', resource_id: null, resource_name: null }),
    ]
    expect(uniqueNamedPeopleCount(withVacancy)).toBe(1)
    expect(totalFte(withVacancy)).toBe(1)
  })
})

/* ── The deliberate Team vs Supplier divergence on NPC ── */

describe('NPC divergence between Team Schedule and Supplier Schedule', () => {
  const npc = row({
    allocation_id: 'npc-row',
    resource_id: 'npc-person',
    planview_code: 'NPC',
    supplier_name: 'Capgemini',
    capacity_days: 11,
    day_rate: 60_500,
  })

  it('gives the same NPC resource a real commercial figure on the Supplier Schedule', () => {
    const money = supplierRowMoney(npc, VAT)
    expect(money.basePence).toBeGreaterThan(0)
    expect(money.totalPence).toBeGreaterThan(0)
    expect(money.basePence).toBe(commercialBasePence(npc, 11))
  })

  // The divergence now runs through the cross-charge rule rather than a
  // commercial one, because the Team Schedule no longer has any commercial
  // content to withhold — but it lands in the same place: this row is money
  // to the supplier and nothing to the team's stakeholders.
  it('gives that identical row no figure at all on the Team Schedule', () => {
    const figures = teamCrossChargeFigures(npc, BLENDED_RATE, JANUS_SCOPE)
    expect(figures.quarterPence).toBeNull()
    expect(figures.sprintPence).toBeNull()
    expect(figures.monthPence).toBeNull()
  })

  // Stated as a single assertion so the intent survives a future reader who
  // spots the two functions and assumes one of them is a bug.
  it('is a deliberate disagreement: same row, same inputs, different answers', () => {
    expect(teamCrossChargeFigures(npc, BLENDED_RATE, JANUS_SCOPE).quarterPence).toBeNull()
    expect(supplierRowMoney(npc, VAT).totalPence).toBeGreaterThan(0)
  })

  it('includes the NPC row in a Supplier Schedule total', () => {
    const supplierRows = [row({ resource_id: 'p1' }), npc]
    const total = supplierRows.reduce((sum, r) => sum + supplierRowMoney(r, VAT).basePence, 0)
    expect(total).toBe(commercialBasePence(supplierRows[0], 64) + commercialBasePence(npc, 11))
  })

  it('omits it from a Team Schedule total, which skips "—" rather than adding zero', () => {
    const teamRows = [row({ resource_id: 'p1' }), npc]
    const figures = teamRows.map((r) => teamCrossChargeFigures(r, BLENDED_RATE, JANUS_SCOPE))
    expect(sumCostColumn(figures, 'quarterPence')).toBe(
      teamCrossChargeFigures(teamRows[0], BLENDED_RATE, JANUS_SCOPE).quarterPence,
    )
  })
})

/* ── Presentation and scoping helpers ── */

describe('team split formatting', () => {
  it('reads like the live Schedule page’s badges', () => {
    expect(formatTeamSplits([PLUTO, CYGNUS])).toBe('Pluto 50%, Cygnus 50%')
  })

  it('rounds to whole percent the same way the badge does', () => {
    expect(formatTeamSplits([{ teamId: 't', teamName: 'Sagan', capacitySplit: 0.335 }])).toBe(
      'Sagan 34%',
    )
  })

  it('omits the cell entirely for a single team at full allocation', () => {
    expect(teamSplitCell([JANUS])).toBe('')
  })

  it('spells out a single team at a partial share', () => {
    expect(teamSplitCell([PLUTO])).toBe('Pluto 50%')
  })

  it('spells out a genuine multi-team split', () => {
    expect(teamSplitCell([PLUTO, CYGNUS])).toBe('Pluto 50%, Cygnus 50%')
  })

  it('is blank when the row has no team', () => {
    expect(teamSplitCell([])).toBe('')
  })
})

describe('scoping and footer aggregates', () => {
  const rows: VariantAllocationRow[] = [
    row({ allocation_id: '1', resource_id: 'a', teams: [PLUTO, CYGNUS], supplier_name: 'Capgemini' }),
    row({ allocation_id: '2', resource_id: 'b', teams: [JANUS], supplier_name: 'Capgemini' }),
    row({ allocation_id: '3', resource_id: 'c', teams: [PLUTO], supplier_name: 'EPAM' }),
  ]

  it('scopes to a team by id, including multi-team members', () => {
    expect(rowsForTeam(rows, 't-pluto').map((r) => r.allocation_id)).toEqual(['1', '3'])
  })

  it('scopes to a supplier by name', () => {
    expect(rowsForSupplier(rows, 'Capgemini').map((r) => r.allocation_id)).toEqual(['1', '2'])
  })

  it('counts distinct teams a supplier appears on', () => {
    expect(distinctTeamCount(rowsForSupplier(rows, 'Capgemini'))).toBe(3)
    expect(distinctTeamCount(rowsForSupplier(rows, 'EPAM'))).toBe(1)
  })

  it('counts cross-charged people via isChargeableRow, not headcount', () => {
    const mixed: VariantAllocationRow[] = [
      row({ allocation_id: 'x1', resource_id: 'pr-person', planview_code: 'PR' }),
      row({ allocation_id: 'x2', resource_id: 'fgov-person', planview_code: 'F_Gov' }),
      row({ allocation_id: 'x3', resource_id: 'bau-person', planview_code: 'BAU' }),
      row({ allocation_id: 'x4', resource_id: 'npc-person', planview_code: 'NPC' }),
    ]
    expect(uniqueNamedPeopleCount(mixed)).toBe(4)
    // PR only — the Team Schedule's masthead asks how many of the named
    // people are actually cross-charged, not how many cost the platform.
    expect(crossChargedPeopleCount(mixed)).toBe(1)
  })
})
