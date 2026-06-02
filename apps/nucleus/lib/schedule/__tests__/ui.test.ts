import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  getUtilColour,
  isIncludedInBaseCost,
  isChargeableRow,
  getLocationColour,
  getPlanBadgeStyle,
  getTextColour,
  withAlpha,
  sortAllocations,
  pickDefaultPeriodId,
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
    expect(getPlanBadgeStyle('PR')).toEqual({ background: '#DBEAFE', color: '#1D40B0' })
  })
  it('returns F_Gov style', () => {
    expect(getPlanBadgeStyle('F_Gov')).toEqual({ background: '#FEF3C7', color: '#92400E' })
  })
  it('falls back for null', () => {
    expect(getPlanBadgeStyle(null).color).toBeTruthy()
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
      { period_id: 'p3', period_status: 'closed' },
    ])
    expect(out).toBe('p2')
  })
  it('falls back to most-recent closed when no active', () => {
    // Input is start-date-desc; first closed is most recent.
    const out = pickDefaultPeriodId([
      { period_id: 'future-draft', period_status: 'draft' },
      { period_id: 'recent-closed', period_status: 'closed' },
      { period_id: 'older-closed', period_status: 'closed' },
    ])
    expect(out).toBe('recent-closed')
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
      { period_id: 'closed', period_status: 'closed' },
    ])
    expect(out).toBe('closed')
  })
})
