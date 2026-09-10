import { describe, expect, it } from 'vitest'
import { getAllNamedPersonRows, getIncludedCostRows, isNamedPerson } from '../rowPopulations'
import type { PopulationRow } from '../rowPopulations'

/* ══════════════════════════════════════════════════════════════════════
   getAllNamedPersonRows answers "who is on this export" — the Platform
   Schedule's headcount population. Everyone Finance would expect to see on
   a SOW reconciliation, plus anyone else relevant to the platform whatever
   supplier or business unit they come from. It is NOT filtered by
   isIncludedInBaseCost; that is the deliberate difference from cost.
══════════════════════════════════════════════════════════════════════ */

const row = (over: Partial<PopulationRow>): PopulationRow => ({
  planview_code: 'PR',
  resource_id: 'res-1',
  ...over,
})

describe('getAllNamedPersonRows', () => {
  it('counts a named person under every planview code, including BAU and NPC', () => {
    const rows = [
      row({ planview_code: 'PR' }),
      row({ planview_code: 'F_Gov' }),
      row({ planview_code: 'BAU' }),
      row({ planview_code: 'NPC' }),
    ]
    expect(getAllNamedPersonRows(rows)).toHaveLength(4)
  })

  it('counts a named person whose planview code is missing entirely', () => {
    // Headcount asks "is there a person here", nothing about coding. A row
    // with no code is a data gap, not a reason to make someone disappear.
    expect(getAllNamedPersonRows([row({ planview_code: null })])).toHaveLength(1)
    expect(getAllNamedPersonRows([row({ planview_code: undefined })])).toHaveLength(1)
  })

  it('EXCLUDES vacant / TBC seats — a budgeted seat is not a person', () => {
    const vacant = row({ resource_id: null })
    expect(getAllNamedPersonRows([vacant])).toHaveLength(0)
  })

  it('is not isIncludedInBaseCost in disguise — the populations genuinely differ', () => {
    // The conflation guard, at the function level. A BAU person is headcount
    // without cost; a vacant PR seat is cost without headcount. If either
    // function is ever reimplemented in terms of the other, one of these two
    // assertions breaks.
    const bauPerson = row({ planview_code: 'BAU', resource_id: 'res-bau' })
    const vacantPrSeat = row({ planview_code: 'PR', resource_id: null })
    const rows = [bauPerson, vacantPrSeat]

    expect(getAllNamedPersonRows(rows)).toEqual([bauPerson])
    expect(getIncludedCostRows(rows)).toEqual([vacantPrSeat])
    // Neither population contains the other on this data.
    expect(getAllNamedPersonRows(rows)).not.toEqual(getIncludedCostRows(rows))
  })

  it('preserves input order and returns the original row objects', () => {
    const a = row({ resource_id: 'a' })
    const b = row({ resource_id: null })
    const c = row({ resource_id: 'c', planview_code: 'NPC' })
    expect(getAllNamedPersonRows([a, b, c])).toEqual([a, c])
  })

  it('returns an empty array rather than throwing on no rows', () => {
    expect(getAllNamedPersonRows([])).toEqual([])
  })
})

describe('isNamedPerson', () => {
  it('is true only when the allocation has a resource behind it', () => {
    expect(isNamedPerson(row({ resource_id: 'res-1' }))).toBe(true)
    expect(isNamedPerson(row({ resource_id: null }))).toBe(false)
  })

  it('ignores planview code entirely', () => {
    for (const code of ['PR', 'F_Gov', 'BAU', 'NPC', null, undefined]) {
      expect(isNamedPerson(row({ planview_code: code, resource_id: 'res-1' }))).toBe(true)
      expect(isNamedPerson(row({ planview_code: code, resource_id: null }))).toBe(false)
    }
  })
})
