// End-to-end tests for the export route handler itself.
//
// This is the layer that had no coverage. Every other export test starts at a
// sheet builder with rows already shaped, which leaves the route's own wiring
// — variant dispatch, which query parameters it reads, what it returns when
// one is missing, whether the workbook it writes actually contains sheets —
// untested. A Team Schedule regression shipped past a fully green suite
// because of exactly that gap.
//
// The Next.js problem this had to solve: the route calls
// getSupabaseServerComponentClient(), which reaches for next/headers cookies()
// and throws outside a request scope. Rather than faking a request scope, the
// module boundary is mocked — the route's contract with @plato/schema/server
// is "give me a client and a cost config", and both are supplied here. The
// route is otherwise the real thing, imported by the same '@/...' specifier
// the app uses (see vitest.config.ts, added for this).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'
import { fakeSupabase, type FakeTables } from './fakeSupabase'

const supabaseState: { tables: FakeTables } = { tables: {} }

vi.mock('@plato/schema/server', () => ({
  getSupabaseServerComponentClient: async () => fakeSupabase(supabaseState.tables).client,
  resolveCostConfigurationByCode: async () => ({
    vat_uplift_percent: 7.082,
    blended_day_rate_override: 60_500,
  }),
}))

const { GET } = await import('@/app/api/export/schedule/route')

const PERIOD_ID = '11111111-1111-1111-1111-111111111111'
const TEAM_PLUTO = 'team-pluto'
const TEAM_CYGNUS = 'team-cygnus'

const PERIOD = {
  period_name: 'Q3 FY 26/27',
  period_start_date: '2026-10-01',
  period_end_date: '2026-12-31',
}

/** One allocation row in the shape the route's select() produces. */
function alloc(over: Partial<Record<string, unknown>> = {}) {
  return {
    allocation_id: 'a1',
    resource_id: 'r1',
    role_title: 'Engineer',
    planview_code: 'PR',
    day_rate: 600,
    utilisation_percent: 100,
    capacity_days: 64,
    vat_applies: true,
    resource_location: 'onshore',
    resources: { resource_name: 'A. Patel', resource_location: 'onshore' },
    suppliers: {
      supplier_id: 's-cg',
      supplier_name: 'Capgemini',
      supplier_abbreviation: 'CG',
      sort_order: 4,
      supplier_colour: '#003C82',
    },
    ...over,
  }
}

function assignment(over: Partial<Record<string, unknown>> = {}) {
  return {
    resource_id: 'r1',
    allocation_id: 'a1',
    team_id: TEAM_PLUTO,
    capacity_split: 1,
    teams: { team_name: 'Pluto' },
    ...over,
  }
}

function url(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  return new Request(`http://localhost/api/export/schedule?${qs}`)
}

/** Reads the returned .xlsx back, so assertions are about the real file. */
async function workbookFrom(res: Response): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await res.arrayBuffer())
  return wb
}

beforeEach(() => {
  supabaseState.tables = {
    periods: [PERIOD],
    resource_period_allocations: [
      alloc(),
      alloc({
        allocation_id: 'a2',
        resource_id: 'r2',
        role_title: 'Architect',
        planview_code: 'F_GOV',
        resources: { resource_name: 'B. Okafor', resource_location: 'nearshore' },
        suppliers: {
          supplier_id: 's-tcs',
          supplier_name: 'Tata Consultancy Services',
          supplier_abbreviation: 'TCS',
          sort_order: 5,
          supplier_colour: '#9B0A6E',
        },
      }),
    ],
    resource_team_assignments: [
      assignment(),
      assignment({ resource_id: 'r2', allocation_id: 'a2', team_id: TEAM_CYGNUS, teams: { team_name: 'Cygnus' } }),
    ],
  }
})

describe('GET /api/export/schedule — Team Schedule', () => {
  it('returns a real .xlsx for a team in the period', async () => {
    const res = await GET(url({ periodId: PERIOD_ID, variant: 'team-schedule', teamId: TEAM_PLUTO }))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    const wb = await workbookFrom(res)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Pluto'])
    // Not merely present — actually populated. An empty sheet is the failure
    // mode a status-code-only assertion would wave through.
    expect(wb.worksheets[0].actualRowCount).toBeGreaterThan(5)
  })

  it('names the file after the team', async () => {
    const res = await GET(url({ periodId: PERIOD_ID, variant: 'team-schedule', teamId: TEAM_PLUTO }))
    expect(res.headers.get('Content-Disposition')).toContain('Pluto')
  })

  it('rejects a missing teamId rather than producing an unscoped file', async () => {
    const res = await GET(url({ periodId: PERIOD_ID, variant: 'team-schedule' }))
    expect(res.status).toBe(400)
  })

  it('rejects a teamId that has no rows in this period', async () => {
    const res = await GET(url({ periodId: PERIOD_ID, variant: 'team-schedule', teamId: 'team-nope' }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/export/schedule — Supplier Schedule', () => {
  it('returns one tab per supplier with resources, needing no supplier parameter', async () => {
    const res = await GET(url({ periodId: PERIOD_ID, variant: 'supplier-schedule' }))

    expect(res.status).toBe(200)
    const wb = await workbookFrom(res)
    // sort_order ascending: Capgemini (4) before TCS (5).
    expect(wb.worksheets.map((w) => w.name)).toEqual(['CG', 'TCS'])
    for (const ws of wb.worksheets) expect(ws.actualRowCount).toBeGreaterThan(5)
  })

  it('ignores a stray supplierId instead of scoping to it', async () => {
    // The parameter is gone; a stale bookmark carrying one must still get the
    // whole workbook rather than a 400 or a single tab.
    const res = await GET(url({ periodId: PERIOD_ID, variant: 'supplier-schedule', supplierId: 's-cg' }))
    expect(res.status).toBe(200)
    expect((await workbookFrom(res)).worksheets).toHaveLength(2)
  })

  it('404s when the period has no supplier rows at all', async () => {
    supabaseState.tables.resource_period_allocations = []
    const res = await GET(url({ periodId: PERIOD_ID, variant: 'supplier-schedule' }))
    expect(res.status).toBe(404)
  })
})

describe('GET /api/export/schedule — shared guards', () => {
  it('400s without a periodId', async () => {
    expect((await GET(new Request('http://localhost/api/export/schedule'))).status).toBe(400)
  })

  it('404s for a period that does not exist', async () => {
    supabaseState.tables.periods = []
    const res = await GET(url({ periodId: PERIOD_ID, variant: 'team-schedule', teamId: TEAM_PLUTO }))
    expect(res.status).toBe(404)
  })

  it('still builds the unscoped variants', async () => {
    for (const variant of ['rate-calculator', 'platform-schedule']) {
      const res = await GET(url({ periodId: PERIOD_ID, variant }))
      expect(res.status, variant).toBe(200)
      expect((await workbookFrom(res)).worksheets.length, variant).toBeGreaterThan(1)
    }
  })
})

describe('GET /api/export/schedule — manual row order', () => {
  /*
   * The Schedule page lets rows be dragged into a manual order, persisted as
   * resource_period_allocations.display_order and applied within a supplier
   * group (see packages/schema/src/queries/schedule.ts, which sorts by
   * supplier, then display_order ASC NULLS LAST, then resource name).
   *
   * The export ignored it completely: display_order was not in the route's
   * SELECT list at all, so every file came out alphabetical and disagreed with
   * the screen it was taken from. These fixtures use an order that is neither
   * alphabetical nor insertion order, so matching it cannot happen by luck.
   */
  const ORDERED = [
    { name: 'Zoe Adams', order: 1 },
    { name: 'Adam Zeller', order: 2 },
    { name: 'Mia Novak', order: 3 },
  ]

  beforeEach(() => {
    supabaseState.tables.resource_period_allocations = ORDERED.map((p, i) =>
      alloc({
        allocation_id: `ord-${i}`,
        resource_id: `ord-r${i}`,
        display_order: p.order,
        resources: { resource_name: p.name, resource_location: 'onshore' },
      }),
    )
    supabaseState.tables.resource_team_assignments = ORDERED.map((_, i) =>
      assignment({ resource_id: `ord-r${i}`, allocation_id: `ord-${i}` }),
    )
  })

  /** The Name column's values, in sheet order. */
  function namesIn(ws: ExcelJS.Worksheet): string[] {
    const out: string[] = []
    ws.eachRow((r) => {
      const v = r.getCell(1).value
      if (typeof v === 'string' && ORDERED.some((p) => p.name === v)) out.push(v)
    })
    return out
  }

  it('honours display_order on the Team Schedule', async () => {
    const res = await GET(url({ periodId: PERIOD_ID, variant: 'team-schedule', teamId: TEAM_PLUTO }))
    const wb = await workbookFrom(res)
    expect(namesIn(wb.worksheets[0])).toEqual(['Zoe Adams', 'Adam Zeller', 'Mia Novak'])
  })

  it('honours display_order on the Supplier Schedule', async () => {
    const res = await GET(url({ periodId: PERIOD_ID, variant: 'supplier-schedule' }))
    const wb = await workbookFrom(res)
    expect(namesIn(wb.worksheets[0])).toEqual(['Zoe Adams', 'Adam Zeller', 'Mia Novak'])
  })

  it('is not merely alphabetical, and not merely insertion order', async () => {
    // Guards the guard: if the fixture were sorted either way, the two tests
    // above would pass without the route doing anything.
    const alphabetical = [...ORDERED].map((p) => p.name).sort()
    expect(alphabetical).not.toEqual(['Zoe Adams', 'Adam Zeller', 'Mia Novak'])
    const shuffled = [...ORDERED].reverse()
    supabaseState.tables.resource_period_allocations = shuffled.map((p, i) =>
      alloc({
        allocation_id: `sh-${i}`,
        resource_id: `sh-r${i}`,
        display_order: p.order,
        resources: { resource_name: p.name, resource_location: 'onshore' },
      }),
    )
    supabaseState.tables.resource_team_assignments = shuffled.map((_, i) =>
      assignment({ resource_id: `sh-r${i}`, allocation_id: `sh-${i}` }),
    )
    const res = await GET(url({ periodId: PERIOD_ID, variant: 'supplier-schedule' }))
    // Same answer from the opposite insertion order: the sort is doing it.
    expect(namesIn((await workbookFrom(res)).worksheets[0]))
      .toEqual(['Zoe Adams', 'Adam Zeller', 'Mia Novak'])
  })

  it('falls back to resource name where display_order is unset', async () => {
    supabaseState.tables.resource_period_allocations = ORDERED.map((p, i) =>
      alloc({
        allocation_id: `nul-${i}`,
        resource_id: `nul-r${i}`,
        display_order: null,
        resources: { resource_name: p.name, resource_location: 'onshore' },
      }),
    )
    supabaseState.tables.resource_team_assignments = ORDERED.map((_, i) =>
      assignment({ resource_id: `nul-r${i}`, allocation_id: `nul-${i}` }),
    )
    const res = await GET(url({ periodId: PERIOD_ID, variant: 'supplier-schedule' }))
    expect(namesIn((await workbookFrom(res)).worksheets[0]))
      .toEqual(['Adam Zeller', 'Mia Novak', 'Zoe Adams'])
  })
})
