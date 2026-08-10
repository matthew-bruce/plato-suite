import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  getUtilColour,
  isIncludedInBaseCost,
  isChargeableRow,
  deriveIsChargeable,
  withDerivedChargeable,
  getLocationColour,
  getPlanBadgeStyle,
  getTextColour,
  withAlpha,
  sortAllocations,
  pickDefaultPeriodId,
  sumFilteredDays,
  formatDaysTotal,
} from '../ui'

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
  it('excludes Hypercare', () => {
    expect(isIncludedInBaseCost('Hypercare')).toBe(false)
  })
  it('excludes null/empty', () => {
    expect(isIncludedInBaseCost(null)).toBe(false)
    expect(isIncludedInBaseCost(undefined)).toBe(false)
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
  // F_Gov cost must still be recovered by the platform — just indirectly,
  // spread across the blended rate, since F_Gov resources don't timesheet
  // against PR tickets the way PR resources do.
  it('returns true for F_Gov (recovered indirectly via the blended rate)', () => {
    expect(deriveIsChargeable('F_Gov')).toBe(true)
  })
  it('returns false for BAU and Hypercare (genuinely non-recoverable)', () => {
    expect(deriveIsChargeable('BAU')).toBe(false)
    expect(deriveIsChargeable('Hypercare')).toBe(false)
  })
  it('returns false for null/undefined', () => {
    expect(deriveIsChargeable(null)).toBe(false)
    expect(deriveIsChargeable(undefined)).toBe(false)
  })
})

describe('withDerivedChargeable', () => {
  it('injects is_chargeable = true when the update sets planview_code to PR or F_Gov', () => {
    expect(withDerivedChargeable({ planview_code: 'PR' })).toEqual({
      planview_code: 'PR',
      is_chargeable: true,
    })
    expect(withDerivedChargeable({ planview_code: 'F_Gov' })).toEqual({
      planview_code: 'F_Gov',
      is_chargeable: true,
    })
  })
  it('injects is_chargeable = false when the update sets planview_code to BAU/Hypercare', () => {
    expect(withDerivedChargeable({ planview_code: 'BAU' })).toEqual({
      planview_code: 'BAU',
      is_chargeable: false,
    })
    expect(withDerivedChargeable({ planview_code: 'Hypercare' })).toEqual({
      planview_code: 'Hypercare',
      is_chargeable: false,
    })
  })
  it('leaves the payload untouched when planview_code is not part of the update', () => {
    expect(withDerivedChargeable({ day_rate: 50000 })).toEqual({ day_rate: 50000 })
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
  it('returns Hypercare style', () => {
    expect(getPlanBadgeStyle('Hypercare')).toEqual({
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
