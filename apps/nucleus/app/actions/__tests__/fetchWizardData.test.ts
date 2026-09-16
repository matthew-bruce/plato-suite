// Ordering of the Add Resource wizard's pickers.
//
// The disciplines dropdown ordered by discipline_name until now, which is not
// an order anyone chose: the disciplines table carries a deliberate taxonomy
// sequence gapped by 10s, and alphabetical scattered it — the list opened with
// "AI / ML Engineering" and "Agile Coaching" and buried Backend Engineering in
// the middle. Same shape of defect as display_order going unread by the
// exports: the column existed, was populated, and nothing asked for it.
//
// These assert the ORDER BY the query issues rather than a sorted result,
// because that is where the bug lived — the fake returns rows in a deliberately
// wrong order so a test that only checked the output could not pass by luck.

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface Recorded { table: string; order: [string, unknown][] }
const recorded: Recorded[] = []

/** Rows come back in an order NO correct sort would produce. */
const ROWS: Record<string, unknown[]> = {
  suppliers: [
    { supplier_id: 's3', supplier_name: 'Capgemini', supplier_colour: '#003C82', sort_order: 3 },
    { supplier_id: 's1', supplier_name: 'Royal Mail Group', supplier_colour: '#E2001A', sort_order: 1 },
  ],
  teams: [{ team_id: 't1', team_name: 'Pluto' }],
  disciplines: [
    { discipline_id: 'd2', discipline_name: 'Frontend Engineering', sort_order: 20 },
    { discipline_id: 'd1', discipline_name: 'Backend Engineering', sort_order: 10 },
    { discipline_id: 'd3', discipline_name: 'Architecture', sort_order: 80 },
  ],
}

function builder(table: string) {
  const rec: Recorded = { table, order: [] }
  recorded.push(rec)
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: ROWS[table] ?? [], error: null }).then(resolve),
    select: () => chain,
    order: (col: string, opts?: unknown) => {
      rec.order.push([col, opts])
      return chain
    },
  }
  return chain
}

vi.mock('@plato/schema/server', () => ({
  getSupabaseServerComponentClient: async () => ({ from: (t: string) => builder(t) }),
}))

const { fetchWizardData } = await import('../schedule-wizard')

beforeEach(() => {
  recorded.length = 0
})

/** The ORDER BY columns the query for one table asked for. */
async function orderColumnsFor(table: string): Promise<string[]> {
  await fetchWizardData()
  return recorded.filter((r) => r.table === table).flatMap((r) => r.order.map(([c]) => c))
}

describe('fetchWizardData ordering', () => {
  it('orders disciplines by sort_order, not discipline_name', async () => {
    const cols = await orderColumnsFor('disciplines')
    expect(cols).toEqual(['sort_order'])
    expect(cols).not.toContain('discipline_name')
  })

  it('selects sort_order, so there is something to order by', async () => {
    // The Resource Timeline had the matching bug of never fetching the column,
    // which made its ordering unfixable at the sort site.
    let selected = ''
    vi.resetModules()
    const spy = {
      from: () => {
        const chain: Record<string, unknown> = {
          then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
          select: (cols: string) => {
            if (cols.includes('discipline_id')) selected = cols
            return chain
          },
          order: () => chain,
        }
        return chain
      },
    }
    vi.doMock('@plato/schema/server', () => ({
      getSupabaseServerComponentClient: async () => spy,
    }))
    const mod = await import('../schedule-wizard')
    await mod.fetchWizardData()
    expect(selected).toContain('sort_order')
  })

  it('still orders suppliers by sort_order — the established convention', async () => {
    expect(await orderColumnsFor('suppliers')).toEqual(['sort_order'])
  })

  it('leaves teams alphabetical — teams have no sort_order column', async () => {
    expect(await orderColumnsFor('teams')).toEqual(['team_name'])
  })

  it('passes every row through, preserving the database’s order', async () => {
    // The action must not re-sort in memory and quietly undo the ORDER BY.
    const data = await fetchWizardData()
    expect(data.disciplines.map((d) => d.discipline_name)).toEqual([
      'Frontend Engineering', 'Backend Engineering', 'Architecture',
    ])
  })
})
