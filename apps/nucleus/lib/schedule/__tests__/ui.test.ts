import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  getUtilColour,
  isIncludedInBaseCost,
  isCountedInHeadcount,
  isChargeableRow,
  deriveIsChargeable,
  withDerivedChargeable,
  PLANVIEW_CODES,
  getLocationColour,
  locationBucket,
  LOCATION_BUCKETS,
  getPlanBadgeStyle,
  getTextColour,
  withAlpha,
  sortAllocations,
  pickDefaultPeriodId,
  sumFilteredDays,
  sumChargeableDays,
  costCellDecoration,
  formatDaysTotal,
} from '../ui'
import { computeScheduleTotals } from '../scheduleTotals'

describe('formatMoney', () => {
  it('formats pence to pounds with commas and 2dp by default', () => {
    expect(formatMoney(191_473_200)).toBe('£1,914,732.00')
  })
  it('supports zero decimals for whole pounds', () => {
    expect(formatMoney(55000, { decimals: 0 })).toBe('£550')
  })
  it('supports two decimals explicitly', () => {
    expect(formatMoney(55000, { decimals: 2 })).toBe('£550.00')
  })
  it('handles zero', () => {
    expect(formatMoney(0)).toBe('£0.00')
  })
})

describe('getUtilColour', () => {
  it('returns empty grey for 0', () => {
    expect(getUtilColour(0)).toBe('#EEEEEE')
  })
  it('returns blue for <50', () => {
    expect(getUtilColour(25)).toBe('#0892CB')
  })
  it('returns orange for 50–89', () => {
    expect(getUtilColour(50)).toBe('#F3920D')
    expect(getUtilColour(89)).toBe('#F3920D')
  })
  it('returns green for 90+', () => {
    expect(getUtilColour(90)).toBe('#62A531')
    expect(getUtilColour(100)).toBe('#62A531')
  })
})

describe('isIncludedInBaseCost', () => {
  it('includes PR / F_Gov / ETP', () => {
    expect(isIncludedInBaseCost('PR')).toBe(true)
    expect(isIncludedInBaseCost('F_Gov')).toBe(true)
    expect(isIncludedInBaseCost('ETP')).toBe(true)
  })
  it('excludes BAU', () => {
    expect(isIncludedInBaseCost('BAU')).toBe(false)
  })
  it('excludes NPC', () => {
    expect(isIncludedInBaseCost('NPC')).toBe(false)
  })
  it('excludes null/empty', () => {
    expect(isIncludedInBaseCost(null)).toBe(false)
    expect(isIncludedInBaseCost(undefined)).toBe(false)
  })
})

describe('isCountedInHeadcount', () => {
  it('includes PR / F_Gov / ETP', () => {
    expect(isCountedInHeadcount('PR')).toBe(true)
    expect(isCountedInHeadcount('F_Gov')).toBe(true)
    expect(isCountedInHeadcount('ETP')).toBe(true)
  })
  it('includes BAU — unlike isIncludedInBaseCost', () => {
    expect(isCountedInHeadcount('BAU')).toBe(true)
  })
  it('excludes NPC', () => {
    expect(isCountedInHeadcount('NPC')).toBe(false)
  })
  it('excludes null/empty', () => {
    expect(isCountedInHeadcount(null)).toBe(false)
    expect(isCountedInHeadcount(undefined)).toBe(false)
  })
  // The two rules must diverge on exactly one code (BAU) and agree on every
  // other one. This pins the divergence down directly, independent of any
  // fixture, so reimplementing isCountedInHeadcount as a delegate to
  // isIncludedInBaseCost — the regression that has happened twice — fails
  // here first.
  it('diverges from isIncludedInBaseCost on BAU only', () => {
    for (const code of ['PR', 'F_Gov', 'ETP', 'NPC', null, undefined]) {
      expect(isCountedInHeadcount(code)).toBe(isIncludedInBaseCost(code))
    }
    expect(isCountedInHeadcount('BAU')).not.toBe(isIncludedInBaseCost('BAU'))
  })
})

describe('isChargeableRow', () => {
  it('returns true only for PR', () => {
    expect(isChargeableRow('PR')).toBe(true)
    expect(isChargeableRow('F_Gov')).toBe(false)
    expect(isChargeableRow('BAU')).toBe(false)
    expect(isChargeableRow('ETP')).toBe(false)
    expect(isChargeableRow(null)).toBe(false)
  })
})

describe('deriveIsChargeable', () => {
  it('returns true for PR', () => {
    expect(deriveIsChargeable('PR')).toBe(true)
  })
  it('returns false for F_Gov, BAU, and NPC', () => {
    expect(deriveIsChargeable('F_Gov')).toBe(false)
    expect(deriveIsChargeable('BAU')).toBe(false)
    expect(deriveIsChargeable('NPC')).toBe(false)
  })
  it('returns false for null/undefined', () => {
    expect(deriveIsChargeable(null)).toBe(false)
    expect(deriveIsChargeable(undefined)).toBe(false)
  })
  // deriveIsChargeable and isChargeableRow must never diverge — they're
  // kept as separate named exports for different call sites (DB-write
  // derivation vs. UI badge/days-filter), but the underlying rule is the
  // same and this pins that down so a future session can't drift one
  // without the other again.
  it('always agrees with isChargeableRow for every valid planview_code', () => {
    for (const { value } of PLANVIEW_CODES) {
      expect(deriveIsChargeable(value)).toBe(isChargeableRow(value))
    }
  })
})

describe('withDerivedChargeable', () => {
  it('injects is_chargeable = true only when the update sets planview_code to PR', () => {
    expect(withDerivedChargeable({ planview_code: 'PR' })).toEqual({
      planview_code: 'PR',
      is_chargeable: true,
    })
  })
  it('injects is_chargeable = false when the update sets planview_code to F_Gov/BAU/NPC', () => {
    expect(withDerivedChargeable({ planview_code: 'F_Gov' })).toEqual({
      planview_code: 'F_Gov',
      is_chargeable: false,
    })
    expect(withDerivedChargeable({ planview_code: 'BAU' })).toEqual({
      planview_code: 'BAU',
      is_chargeable: false,
    })
    expect(withDerivedChargeable({ planview_code: 'NPC' })).toEqual({
      planview_code: 'NPC',
      is_chargeable: false,
    })
  })
  it('leaves the payload untouched when planview_code is not part of the update', () => {
    // Typed rather than a bare literal: the generic constrains T to an object
    // carrying planview_code, so an inline literal without it trips excess
    // property checking even though the call is exactly what this asserts.
    const payload: { planview_code?: string | null; day_rate: number } = { day_rate: 50000 }
    expect(withDerivedChargeable(payload)).toEqual({ day_rate: 50000 })
  })
})

// Single source of truth for the Planview filter dropdown's and the
// per-row edit-mode <select>'s option lists — both are generated from
// this array, so a row's planview_code always has a matching <option>
// and the browser never silently falls back to displaying the first
// option (which is what happened to 'NPC' rows before it was added here:
// no matching <option> meant the <select> showed "PR").
describe('PLANVIEW_CODES', () => {
  it('includes all 5 valid planview_code values', () => {
    expect(PLANVIEW_CODES.map((pc) => pc.value)).toEqual([
      'PR',
      'F_Gov',
      'BAU',
      'ETP',
      'NPC',
    ])
  })
  it('has a matching option for NPC, so a row with that code is not coerced to the first option (PR) by the browser', () => {
    expect(PLANVIEW_CODES.some((pc) => pc.value === 'NPC')).toBe(true)
  })
  it('renders a row with planview_code = NPC as selected in edit mode, not falling back to the first option', () => {
    // Mirrors the edit-mode <select>'s value expression in
    // SchedulePageClient.tsx: value={plan ?? 'BAU'} where plan is
    // row.planview_code. A <select value=X> only displays X as selected
    // when X matches one of its rendered <option value> attributes —
    // otherwise the browser silently falls back to the first option.
    const row: { planview_code: string | null } = { planview_code: 'NPC' }
    const selectValue = row.planview_code ?? 'BAU'
    expect(selectValue).toBe('NPC')
    expect(PLANVIEW_CODES.map((pc) => pc.value)).toContain(selectValue)
  })
})

describe('locationBucket', () => {
  it('maps each enum value to its display name', () => {
    expect(locationBucket('onshore')).toBe('Onshore')
    expect(locationBucket('nearshore')).toBe('Nearshore')
    expect(locationBucket('offshore')).toBe('Offshore')
    expect(locationBucket('unspecified')).toBe('Unspecified')
  })

  it('is case- and whitespace-insensitive', () => {
    expect(locationBucket('  Offshore ')).toBe('Offshore')
    expect(locationBucket('NEARSHORE')).toBe('Nearshore')
  })

  it('reports a NULL, an empty string and a literal unspecified identically', () => {
    // Finance has no use for the distinction between "no row in resources" and
    // "someone chose Unspecified" — both mean no location has been decided.
    expect(locationBucket(null)).toBe('Unspecified')
    expect(locationBucket(undefined)).toBe('Unspecified')
    expect(locationBucket('')).toBe('Unspecified')
    expect(locationBucket('unspecified')).toBe('Unspecified')
  })

  it('never returns a name outside the four the breakdown lists', () => {
    // A fifth enum value added later must land somewhere, or a breakdown built
    // from these buckets silently stops adding up to its own total.
    for (const input of ['nearshore', 'hybrid', 'Remote', '???', null]) {
      expect(LOCATION_BUCKETS).toContain(locationBucket(input))
    }
  })
})

describe('getLocationColour', () => {
  it('matches spec', () => {
    expect(getLocationColour('onshore')).toBe('#008A00')
    expect(getLocationColour('nearshore')).toBe('#0892CB')
    expect(getLocationColour('offshore')).toBe('#F3920D')
  })
  it('is case-insensitive', () => {
    expect(getLocationColour('Onshore')).toBe('#008A00')
  })
  it('falls back for null', () => {
    expect(getLocationColour(null)).toBe('#D5D5D5')
  })
})

describe('getPlanBadgeStyle', () => {
  it('returns PR style', () => {
    expect(getPlanBadgeStyle('PR')).toEqual({ background: '#BEE0F5', color: '#005F8A' })
  })
  it('returns F_Gov style', () => {
    expect(getPlanBadgeStyle('F_Gov')).toEqual({ background: '#EEEEEE', color: '#8F9495' })
  })
  it('returns NPC style', () => {
    expect(getPlanBadgeStyle('NPC')).toEqual({
      background: 'var(--rmg-color-tint-orange)',
      color: 'var(--rmg-color-orange)',
    })
  })
  it('falls back for null', () => {
    expect(getPlanBadgeStyle(null).color).toBeTruthy()
  })
  it('falls back to the default style for unmapped codes', () => {
    expect(getPlanBadgeStyle('SomethingElse')).toEqual({ background: '#EEEEEE', color: '#8F9495' })
  })
})

describe('getTextColour', () => {
  it('white text on dark supplier colour', () => {
    expect(getTextColour('#2A2A2D')).toBe('#ffffff')
    expect(getTextColour('#0892CB')).toBe('#ffffff')
    expect(getTextColour('#DA202A')).toBe('#ffffff')
  })
  it('dark text on light supplier colour', () => {
    expect(getTextColour('#FDDA24')).toBe('#2A2A2D')
    expect(getTextColour('#ffffff')).toBe('#2A2A2D')
  })
  it('handles 3-char hex', () => {
    expect(getTextColour('#fff')).toBe('#2A2A2D')
  })
  it('falls back to dark for invalid input', () => {
    expect(getTextColour('not-a-colour')).toBe('#2A2A2D')
  })
})

describe('withAlpha', () => {
  it('appends alpha byte', () => {
    expect(withAlpha('#0892CB', '0F')).toBe('#0892CB0F')
  })
  it('expands 3-char hex', () => {
    expect(withAlpha('#abc', '08')).toBe('#aabbcc08')
  })
  it('returns input on invalid', () => {
    expect(withAlpha('blah', '0F')).toBe('blah')
  })
})

describe('sortAllocations', () => {
  type Row = {
    resource_name: string
    role_title: string | null
    planview_code: string | null
    resource_location: string | null
    is_chargeable: boolean
    capacity_days: number | null
    day_rate: number
    utilisation_percent: number
    base_total_pence?: number
    vat_total_pence?: number
    teams?: Array<{ teamId: string; teamName: string; capacitySplit: number }>
  }
  const rows: Row[] = [
    {
      resource_name: 'Charlie',
      role_title: 'Dev',
      planview_code: 'PR',
      resource_location: 'onshore',
      is_chargeable: true,
      capacity_days: 50,
      day_rate: 50000,
      utilisation_percent: 100,
      base_total_pence: 2_500_000,
      vat_total_pence: 2_677_050,
      teams: [{ teamId: 'x', teamName: 'Alpha', capacitySplit: 1.0 }],
    },
    {
      resource_name: 'alice',
      role_title: 'Lead',
      planview_code: 'BAU',
      resource_location: 'offshore',
      is_chargeable: false,
      capacity_days: 30,
      day_rate: 40000,
      utilisation_percent: 50,
      base_total_pence: 600_000,
      vat_total_pence: 642_492,
      teams: [{ teamId: 'y', teamName: 'Zulu', capacitySplit: 1.0 }],
    },
    {
      resource_name: 'Bob',
      role_title: 'Architect',
      planview_code: 'F_Gov',
      resource_location: 'nearshore',
      is_chargeable: false,
      capacity_days: 64,
      day_rate: 60000,
      utilisation_percent: 80,
      base_total_pence: 3_072_000,
      vat_total_pence: 3_289_578,
      teams: [{ teamId: 'z', teamName: 'Mango', capacitySplit: 1.0 }],
    },
  ]

  it('sorts resource asc case-insensitively', () => {
    const out = sortAllocations(rows, 'resource', 'asc')
    expect(out.map((r) => r.resource_name)).toEqual(['alice', 'Bob', 'Charlie'])
  })

  it('sorts resource desc', () => {
    const out = sortAllocations(rows, 'resource', 'desc')
    expect(out.map((r) => r.resource_name)).toEqual(['Charlie', 'Bob', 'alice'])
  })

  it('sorts day rate numerically', () => {
    const out = sortAllocations(rows, 'dayRate', 'asc')
    expect(out.map((r) => r.day_rate)).toEqual([40000, 50000, 60000])
  })

  it('sorts by total (base pence)', () => {
    const out = sortAllocations(rows, 'total', 'desc')
    expect(out[0].resource_name).toBe('Bob')
  })

  it('does not mutate input', () => {
    const before = rows.map((r) => r.resource_name)
    sortAllocations(rows, 'resource', 'desc')
    expect(rows.map((r) => r.resource_name)).toEqual(before)
  })

  it('returns input when col is null', () => {
    const out = sortAllocations(rows, null, 'asc')
    expect(out).toEqual(rows)
  })

  it('handles empty array', () => {
    expect(sortAllocations([], 'resource', 'asc')).toEqual([])
  })
})

describe('pickDefaultPeriodId', () => {
  it('prefers active when present', () => {
    const out = pickDefaultPeriodId([
      { period_id: 'p1', period_status: 'draft' },
      { period_id: 'p2', period_status: 'active' },
      { period_id: 'p3', period_status: 'historic' },
    ])
    expect(out).toBe('p2')
  })
  it('falls back to most-recent historic when no active', () => {
    // Input is start-date-desc; first historic is most recent.
    const out = pickDefaultPeriodId([
      { period_id: 'future-draft', period_status: 'draft' },
      { period_id: 'recent-historic', period_status: 'historic' },
      { period_id: 'older-historic', period_status: 'historic' },
    ])
    expect(out).toBe('recent-historic')
  })
  it('returns null on empty list', () => {
    expect(pickDefaultPeriodId([])).toBeNull()
  })
  it('returns null when only draft periods exist', () => {
    const out = pickDefaultPeriodId([
      { period_id: 'd1', period_status: 'draft' },
      { period_id: 'd2', period_status: 'draft' },
    ])
    expect(out).toBeNull()
  })
  it('ignores draft periods when picking', () => {
    const out = pickDefaultPeriodId([
      { period_id: 'draft', period_status: 'draft' },
      { period_id: 'historic', period_status: 'historic' },
    ])
    expect(out).toBe('historic')
  })
})

describe('sumFilteredDays', () => {
  type Row = {
    capacity_days: number | null
    planview_code: string | null
    teams?: Array<{ teamId: string; teamName: string; capacitySplit: number }>
  }
  function groupOf(rows: Row[]) {
    return [{ rows }]
  }

  it('returns 0 for an empty array', () => {
    expect(sumFilteredDays([], null)).toBe(0)
  })

  it('sums whole-number days across rows', () => {
    const rows: Row[] = [
      { capacity_days: 10, planview_code: 'PR' },
      { capacity_days: 20, planview_code: 'PR' },
    ]
    expect(sumFilteredDays(groupOf(rows), null)).toBe(30)
  })

  it('sums mixed whole and half-day values', () => {
    const rows: Row[] = [
      { capacity_days: 48.5, planview_code: 'PR' },
      { capacity_days: 10, planview_code: 'F_Gov' },
    ]
    expect(sumFilteredDays(groupOf(rows), null)).toBe(58.5)
  })

  it('sums a single row', () => {
    const rows: Row[] = [{ capacity_days: 10.5, planview_code: 'PR' }]
    expect(sumFilteredDays(groupOf(rows), null)).toBe(10.5)
  })

  it('excludes BAU rows, matching the BASE/+VAT footer filter', () => {
    const rows: Row[] = [
      { capacity_days: 10, planview_code: 'PR' },
      { capacity_days: 99, planview_code: 'BAU' },
    ]
    expect(sumFilteredDays(groupOf(rows), null)).toBe(10)
  })

  it('applies the team capacity split when a team filter is active', () => {
    const rows: Row[] = [
      {
        capacity_days: 10,
        planview_code: 'PR',
        teams: [{ teamId: 't1', teamName: 'Alpha', capacitySplit: 0.5 }],
      },
    ]
    expect(sumFilteredDays(groupOf(rows), 'Alpha')).toBe(5)
  })
})

// The Base and +VAT cells in both the view-mode and edit-mode rows of
// SchedulePageClient spread `textDecoration: costCellDecoration(plan)`, so the
// value returned here IS the style those cells carry. Day Rate deliberately
// does not call this.
describe('costCellDecoration', () => {
  it('strikes through an NPC row', () => {
    expect(costCellDecoration('NPC')).toBe('line-through')
  })

  it('leaves PR, F_Gov, BAU and ETP rows un-struck', () => {
    expect(costCellDecoration('PR')).toBeUndefined()
    expect(costCellDecoration('F_Gov')).toBeUndefined()
    expect(costCellDecoration('BAU')).toBeUndefined()
    expect(costCellDecoration('ETP')).toBeUndefined()
  })

  it('leaves null/undefined un-struck', () => {
    expect(costCellDecoration(null)).toBeUndefined()
    expect(costCellDecoration(undefined)).toBeUndefined()
  })

  it('strikes exactly one planview code, and that code is NPC', () => {
    const struck = PLANVIEW_CODES.filter((pc) => costCellDecoration(pc.value) === 'line-through')
    expect(struck.map((pc) => pc.value)).toEqual(['NPC'])
  })

  // The two ways this could be written that both look right and are both
  // wrong. Pinned directly so neither can be "simplified" into place later.
  it('is not !isIncludedInBaseCost — that would also strike BAU', () => {
    expect(isIncludedInBaseCost('BAU')).toBe(false)
    expect(costCellDecoration('BAU')).toBeUndefined()
  })

  it('is not !isChargeableRow — that would strike F_Gov, whose cost is real and counted', () => {
    expect(isChargeableRow('F_Gov')).toBe(false)
    expect(isIncludedInBaseCost('F_Gov')).toBe(true)
    expect(costCellDecoration('F_Gov')).toBeUndefined()
  })
})

describe('sumChargeableDays', () => {
  type Row = {
    capacity_days: number | null
    planview_code: string | null
    utilisation_percent: number
    teams?: Array<{ teamId: string; teamName: string; capacitySplit: number }>
  }
  function groupOf(rows: Row[]) {
    return [{ rows }]
  }

  it('returns 0 for an empty array', () => {
    expect(sumChargeableDays([], null)).toBe(0)
  })

  it('sums PR rows only, at full utilisation', () => {
    const rows: Row[] = [
      { capacity_days: 10, planview_code: 'PR', utilisation_percent: 100 },
      { capacity_days: 20, planview_code: 'PR', utilisation_percent: 100 },
    ]
    expect(sumChargeableDays(groupOf(rows), null)).toBe(30)
  })

  // The regression this task exists to fix: Internal Run Rate's capacity
  // base ("Capacity Days" / "Full Quarter" / "Per Sprint") was summing every
  // row regardless of planview_code, so NPC and F_Gov resources — neither of
  // which is cross-charged — inflated the figure stakeholders are shown.
  // A resource with either code must contribute zero days here while still
  // counting toward headcount/base-cost totals via the separate rules those
  // use (isCountedInHeadcount, isIncludedInBaseCost).
  it('excludes NPC and F_Gov rows, unlike sumFilteredDays which includes F_Gov', () => {
    const rows: Row[] = [
      { capacity_days: 548, planview_code: 'PR', utilisation_percent: 100 },
      { capacity_days: 11, planview_code: 'NPC', utilisation_percent: 100 },
      { capacity_days: 6, planview_code: 'NPC', utilisation_percent: 100 },
      { capacity_days: 25, planview_code: 'F_Gov', utilisation_percent: 100 },
      { capacity_days: 99, planview_code: 'BAU', utilisation_percent: 100 },
    ]
    expect(sumChargeableDays(groupOf(rows), null)).toBe(548)
    // sumFilteredDays (the BASE/+VAT footer's rule) keeps F_Gov — the two
    // helpers must diverge there, not agree, or this is the same bug again
    // under a different name.
    expect(sumFilteredDays(groupOf(rows), null)).toBe(548 + 25)
  })

  it('reproduces the reported Cygnus example: 565 total, 548 PR-only after excluding 17 NPC days', () => {
    const rows: Row[] = [
      { capacity_days: 548, planview_code: 'PR', utilisation_percent: 100 },
      { capacity_days: 6, planview_code: 'NPC', utilisation_percent: 100 },
      { capacity_days: 11, planview_code: 'NPC', utilisation_percent: 100 },
    ]
    const totalAllCodes = rows.reduce((s, r) => s + (r.capacity_days ?? 0), 0)
    expect(totalAllCodes).toBe(565)
    expect(sumChargeableDays(groupOf(rows), null)).toBe(548)
  })

  it('applies the team capacity split when a team filter is active', () => {
    const rows: Row[] = [
      {
        capacity_days: 10,
        planview_code: 'PR',
        utilisation_percent: 100,
        teams: [{ teamId: 't1', teamName: 'Alpha', capacitySplit: 0.5 }],
      },
      {
        capacity_days: 40,
        planview_code: 'NPC',
        utilisation_percent: 100,
        teams: [{ teamId: 't1', teamName: 'Alpha', capacitySplit: 0.5 }],
      },
    ]
    expect(sumChargeableDays(groupOf(rows), 'Alpha')).toBe(5)
  })

  // The bug this task exists to fix: Internal Run Rate applied zero
  // utilisation weighting, so a PR resource at less than 100% utilisation was
  // charged to their team at their FULL capacity_days, not their real
  // (capacity_days × utilisation_percent / 100) contribution — the same real
  // figure the per-row Base cost and xChargeableDays both already used.
  it('weights by utilisation_percent, not just capacity_days and team split', () => {
    const rows: Row[] = [
      { capacity_days: 32, planview_code: 'PR', utilisation_percent: 90 },
    ]
    // 32 * 0.9 = 28.8, not 32.
    expect(sumChargeableDays(groupOf(rows), null)).toBeCloseTo(28.8, 10)
  })

  it('combines utilisation and team-split weighting multiplicatively', () => {
    const rows: Row[] = [
      {
        capacity_days: 100,
        planview_code: 'PR',
        utilisation_percent: 90,
        teams: [{ teamId: 't1', teamName: 'Alpha', capacitySplit: 0.5 }],
      },
    ]
    // 100 * 0.9 * 0.5 = 45.
    expect(sumChargeableDays(groupOf(rows), 'Alpha')).toBeCloseTo(45, 10)
  })

  it('leaves a fully-utilised row unchanged — the pre-fix behaviour was only wrong below 100%', () => {
    const rows: Row[] = [{ capacity_days: 64, planview_code: 'PR', utilisation_percent: 100 }]
    expect(sumChargeableDays(groupOf(rows), null)).toBe(64)
  })

  // sumChargeableDays and xChargeableDays (scheduleTotals.ts) apply the
  // IDENTICAL rule to the IDENTICAL population — isChargeableRow (PR only),
  // weighted by utilisation_percent — and must therefore agree, unlike the
  // deliberate Team Schedule vs Supplier Schedule NPC divergence pinned
  // elsewhere. Compared with no team filter (capacitySplit neutral at 1.0 for
  // every row via getCapacitySplit's null-filter branch) so the comparison
  // isn't confounded by sumChargeableDays' team-split weighting, which
  // xChargeableDays has no equivalent of — it sums the whole platform, not
  // one team.
  it('agrees exactly with xChargeableDays on the same mixed fixture', () => {
    const mixed = [
      { planview_code: 'PR', utilisation_percent: 90, capacity_days: 32, day_rate: 58_000, vat_applies: true },
      { planview_code: 'F_Gov', utilisation_percent: 80, capacity_days: 63, day_rate: 72_000, vat_applies: true },
      { planview_code: 'BAU', utilisation_percent: 50, capacity_days: 64, day_rate: 0, vat_applies: true },
      { planview_code: 'NPC', utilisation_percent: 100, capacity_days: 11, day_rate: 54_000, vat_applies: true },
      { planview_code: 'PR', utilisation_percent: 100, capacity_days: 20, day_rate: 58_000, vat_applies: true },
    ]

    const fromSumChargeableDays = sumChargeableDays(groupOf(mixed), null)
    const fromXChargeableDays = computeScheduleTotals(mixed, [], 1).xChargeableDays

    expect(fromSumChargeableDays).toBeCloseTo(fromXChargeableDays, 10)
    // Concretely: (32*0.9) + (20*1.0) = 28.8 + 20 = 48.8. F_Gov/BAU/NPC excluded.
    expect(fromSumChargeableDays).toBeCloseTo(48.8, 10)
  })
})

describe('formatDaysTotal', () => {
  it('formats zero', () => {
    expect(formatDaysTotal(0)).toBe('0')
  })
  it('drops the decimal for whole numbers', () => {
    expect(formatDaysTotal(48)).toBe('48')
  })
  it('keeps one decimal for half-day values', () => {
    expect(formatDaysTotal(48.5)).toBe('48.5')
    expect(formatDaysTotal(10.5)).toBe('10.5')
  })
  it('rounds to one decimal without forcing a trailing zero', () => {
    expect(formatDaysTotal(48.04)).toBe('48')
    expect(formatDaysTotal(48.06)).toBe('48.1')
  })
})
