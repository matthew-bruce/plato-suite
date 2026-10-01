import { describe, expect, it } from 'vitest'
import { countHeadcount, type HeadcountRow } from '../headcount'

let seq = 0
function row(resourceId: string | null, supplier = 'TCS'): HeadcountRow & { supplier: string } {
  return { allocation_id: `alloc-${++seq}`, resource_id: resourceId, supplier }
}

/** An Ad-hoc cost item as it sits in the page's cost-item list: no allocation_id. */
const adHocItem = {
  cost_item_id: 'cost-1',
  cost_item_category: 'ADHOC',
  amount_pence: 120_000,
  is_confirmed: true,
} as unknown as HeadcountRow

describe('countHeadcount', () => {
  it('counts each vacant seat, one per row', () => {
    expect(countHeadcount([row(null), row(null), row(null)])).toBe(3)
  })

  it('counts a person with several rows once — a CG→TCS mover is one person', () => {
    expect(countHeadcount([row('p1', 'CG'), row('p1', 'TCS')])).toBe(1)
  })

  it('adds distinct named people and vacant seats together', () => {
    expect(countHeadcount([row('p1'), row('p2'), row('p2'), row(null)])).toBe(3)
  })

  it('never counts an Ad-hoc cost item, even mixed into the same array as allocations', () => {
    const allocations = [row('p1'), row(null)]
    expect(countHeadcount([...allocations, adHocItem])).toBe(countHeadcount(allocations))
    expect(countHeadcount([adHocItem])).toBe(0)
  })

  it('returns 0 for no rows', () => {
    expect(countHeadcount([])).toBe(0)
  })

  it('counts a mover once per supplier when counted per supplier group', () => {
    const rows = [row('mover', 'CG'), row('mover', 'TCS'), row('p2', 'TCS')]
    const bySupplier = (s: string) => countHeadcount(rows.filter((r) => r.supplier === s))
    expect(bySupplier('CG')).toBe(1)
    expect(bySupplier('TCS')).toBe(2)
    expect(countHeadcount(rows)).toBe(2)
  })

  it('reproduces Q3 FY 26/27: 105 rows → 96 distinct named + 4 vacant = 100', () => {
    const rows: HeadcountRow[] = []
    for (let i = 0; i < 91; i++) rows.push(row(`single-${i}`))
    for (let i = 0; i < 5; i++) rows.push(row(`mover-${i}`, 'CG'), row(`mover-${i}`, 'TCS'))
    for (let i = 0; i < 4; i++) rows.push(row(null))
    expect(rows).toHaveLength(105)
    expect(countHeadcount([...rows, adHocItem])).toBe(100)
  })
})
