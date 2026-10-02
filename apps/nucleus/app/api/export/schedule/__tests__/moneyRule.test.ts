// The money rule end to end (docs/decisions/036-money-rounding.md): one set of
// Q3 FY 26/27 rows pushed through every surface that shows Total Platform
// Cost, and every one of them must land on the same penny.
//
// Before the rule the same rows produced three totals — £2,892,442.35 on the
// page (float VAT multiplier), .43 on the export Summary, .37 in the export's
// detail sheet (no per-row rounding). Now: .43 everywhere.

import { describe, it, expect, vi, beforeAll } from 'vitest'
import ExcelJS from 'exceljs'
import { computeRowMoneyPence } from '@plato/schema'
import { fakeSupabase, type FakeTables } from './fakeSupabase'
import {
  Q3_REF_ALLOCATIONS,
  Q3_REF_APPLIED_RATE_PENCE,
  Q3_REF_COST_ITEMS,
  Q3_REF_EXPECTED,
  Q3_REF_SUPPLIERS,
  Q3_REF_VAT_RATE,
} from '@/lib/schedule/__tests__/fixtures/q3Fy2627Reference'
import {
  allocationBasePence,
  computeScheduleTotals,
  includedAllocations,
} from '@/lib/schedule/scheduleTotals'
import { calcCostItemVat } from '@/lib/schedule/costItems'
import { computeFooterTotals } from '@/lib/schedule/footerTotals'
import { buildCopyView, type ExportRow } from '@/lib/schedule/exportView'
import { isIncludedInBaseCost } from '@/lib/schedule/ui'
import { periodRecoveryVariance } from '@/lib/schedule/recoveryVariance'
import { evaluateFormula, excelRound, type Grid } from '@/lib/export/__tests__/helpers/evaluateSheetFormula'

const tables: FakeTables & { platform_cost_items?: unknown[] } = {}

vi.mock('@plato/schema/server', () => ({
  getSupabaseServerComponentClient: async () => fakeSupabase(tables).client,
  resolveAppliedCostConfigurationByCode: async () => ({
    // As the database returns numeric(10,5): a string.
    vat_uplift_percent: '7.08200',
    blended_day_rate_override: Q3_REF_APPLIED_RATE_PENCE,
  }),
}))

const { GET } = await import('@/app/api/export/schedule/route')

const PERIOD_ID = '10cfda7c-8c57-4da3-9dab-b8210032b030'

/** The rows as the schedule query hands them to the page: base_total_pence
 *  and vat_total_pence (inc VAT) derived by computeRowMoneyPence. */
const PAGE_ROWS = Q3_REF_ALLOCATIONS.map((a) => {
  const money = computeRowMoneyPence({
    capacityDays: a.capacity_days,
    dayRatePence: a.day_rate,
    utilisationPercent: a.utilisation_percent,
    vatApplies: a.vat_applies,
    vatRateMilliPct: Q3_REF_VAT_RATE,
  })
  return { ...a, base_total_pence: money.basePence, vat_total_pence: money.incVatPence, teams: [] }
})

/** The page's KPI card — SchedulePageClient's `totals` memo, longhand: each
 *  costed row's vat_total_pence, ad-hoc through calcCostItemVat, ETP/SS as-is. */
function kpiTotalPence(): number {
  const allocs = PAGE_ROWS.filter((r) => isIncludedInBaseCost(r.planview_code)).reduce(
    (s, r) => s + r.vat_total_pence,
    0,
  )
  const adhoc = Q3_REF_COST_ITEMS.filter((i) => i.cost_item_category === 'ADHOC').reduce(
    (s, i) => s + calcCostItemVat(i.amount_pence, i.vat_applies, Q3_REF_VAT_RATE),
    0,
  )
  const etpSs = Q3_REF_COST_ITEMS.filter(
    (i) => i.cost_item_category === 'ETP' || i.cost_item_category === 'SHARED_SERVICES',
  ).reduce((s, i) => s + i.amount_pence, 0)
  return allocs + adhoc + etpSs
}

function routeTables(): FakeTables & { platform_cost_items: unknown[] } {
  return {
    periods: [
      {
        locked: false,
        period_name: 'Q3 FY 26/27',
        period_start_date: '2026-10-01',
        period_end_date: '2026-12-31',
      },
    ],
    resource_period_allocations: Q3_REF_ALLOCATIONS.map((a, i) => {
      const supplier = Q3_REF_SUPPLIERS[a.supplier_name]
      return {
        allocation_id: a.allocation_id,
        resource_id: a.resource_id,
        role_title: 'Role',
        planview_code: a.planview_code,
        day_rate: a.day_rate,
        utilisation_percent: a.utilisation_percent,
        capacity_days: a.capacity_days,
        vat_applies: a.vat_applies,
        resource_location: a.resource_location,
        display_order: i,
        resources: a.resource_id
          ? { resource_name: `Person ${i + 1}`, resource_location: a.resource_location }
          : null,
        suppliers: {
          supplier_id: `s-${supplier.abbreviation}`,
          supplier_name: a.supplier_name,
          supplier_abbreviation: supplier.abbreviation,
          sort_order: supplier.sortOrder,
          supplier_colour: supplier.colour,
        },
      }
    }),
    resource_team_assignments: [],
    platform_cost_items: Q3_REF_COST_ITEMS.map((i, n) => ({ ...i, sort_order: n + 1 })),
  }
}

async function exportWorkbook(variant: 'rate-calculator' | 'platform-schedule') {
  Object.assign(tables, routeTables())
  const res = await GET(
    new Request(`http://localhost/api/export/schedule?periodId=${PERIOD_ID}&variant=${variant}`),
  )
  expect(res.status).toBe(200)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await res.arrayBuffer())
  return wb
}

/** The Summary tab's hero figure: the cell under the TOTAL PLATFORM COST label. */
function summaryTotalPence(wb: ExcelJS.Workbook): number {
  const ws = wb.getWorksheet('Summary')!
  for (let r = 1; r <= 20; r++) {
    if (ws.getCell(r, 1).value === 'TOTAL PLATFORM COST') {
      return Math.round((ws.getCell(r + 1, 1).value as number) * 100)
    }
  }
  throw new Error('no TOTAL PLATFORM COST on the Summary tab')
}

const formulaOf = (cell: ExcelJS.Cell): string | null => {
  const v = cell.value as { formula?: string } | null
  return v && typeof v === 'object' && 'formula' in v ? (v.formula ?? null) : null
}

/**
 * Recalculates the detail sheet the way Excel will: every row's L and M from
 * its own formula (only the two per-row shapes the route writes are
 * accepted), then the SUBTOTAL row's +VAT formula over the result.
 */
function detailSheetTotalPence(wb: ExcelJS.Workbook): number {
  const ws = wb.worksheets.find((w) => w.name.startsWith('Web'))!
  const grid: Grid = new Map()
  const num = (ref: string) => {
    const v = grid.get(ref)
    if (typeof v !== 'number') throw new Error(`${ref} is not a number: ${String(v)}`)
    return v
  }

  let subtotalRow = 0
  ws.eachRow((row, r) => {
    if (row.getCell(1).value === 'SUBTOTAL') subtotalRow = r
    for (const col of ['E', 'H', 'I', 'J', 'L', 'M']) {
      const v = ws.getCell(`${col}${r}`).value
      if (typeof v === 'number' || typeof v === 'string') grid.set(`${col}${r}`, v)
    }
  })
  // The VAT multiplier lives in column I of a config row; resolved on demand.
  ws.eachRow((_row, r) => {
    const l = formulaOf(ws.getCell(`L${r}`))
    if (l && r !== subtotalRow) {
      const m = l.match(/^ROUND\(\(H(\d+)\*I\1\)\*J\1,2\)$/)
      if (!m || Number(m[1]) !== r) throw new Error(`row ${r}: unexpected base formula ${l}`)
      grid.set(`L${r}`, excelRound(num(`H${r}`) * num(`I${r}`) * num(`J${r}`), 2))
    }
  })
  ws.eachRow((_row, r) => {
    const m = formulaOf(ws.getCell(`M${r}`))
    if (!m || r === subtotalRow) return
    const vat = m.match(/^ROUND\(L(\d+)\*\$I\$(\d+),2\)$/)
    if (vat) {
      grid.set(`M${r}`, excelRound(num(`L${r}`) * Number(ws.getCell(`I${vat[2]}`).value), 2))
    } else if (m === `L${r}`) {
      grid.set(`M${r}`, grid.get(`L${r}`) ?? '')
    } else {
      throw new Error(`row ${r}: unexpected +VAT formula ${m}`)
    }
  })

  const subtotal = formulaOf(ws.getCell(`M${subtotalRow}`))!
  return Math.round(evaluateFormula(subtotal, grid) * 100)
}

/** The Raw Data tab's literal +VAT values, costed rows and cost items. */
function rawDataTotalPence(wb: ExcelJS.Workbook): number {
  const ws = wb.getWorksheet('Raw Data')!
  let pence = 0
  ws.eachRow((row, r) => {
    if (r === 1) return
    const code = row.getCell(5).value
    const m = row.getCell(13).value
    if (typeof m !== 'number') return
    const isCostItem = code === '' || code === null
    if (isCostItem || isIncludedInBaseCost(code as string)) pence += Math.round(m * 100)
  })
  return pence
}

describe('Q3 FY 26/27 — the pinned reference figures', () => {
  const totals = computeScheduleTotals(Q3_REF_ALLOCATIONS, Q3_REF_COST_ITEMS, Q3_REF_VAT_RATE)

  it('base (ex VAT) is £2,592,876.42', () => {
    const base = includedAllocations(Q3_REF_ALLOCATIONS).reduce((s, a) => s + allocationBasePence(a), 0)
    expect(base).toBe(Q3_REF_EXPECTED.basePence)
  })

  it('Total Platform Cost (inc VAT, inc ad-hoc) is £2,892,442.43', () => {
    expect(totals.resourcesVatPence).toBe(Q3_REF_EXPECTED.resourcesIncVatPence)
    expect(totals.totalPlatformPence).toBe(Q3_REF_EXPECTED.totalPlatformPence)
  })

  it('PR days are 4,920', () => {
    expect(totals.xChargeableDays).toBe(Q3_REF_EXPECTED.prDays)
  })

  it('recovery variance at £605/day is £84,157.57', () => {
    const variance = periodRecoveryVariance(
      Q3_REF_APPLIED_RATE_PENCE,
      totals.totalPlatformPence,
      totals.xChargeableDays,
    )
    expect(Math.round(variance.totalVariance * 100)).toBe(Q3_REF_EXPECTED.recoveryVariancePence)
  })

  it('regression: the old float multiplier lands 8p short on these rows', () => {
    // 1 + 7.082 / 100 is 1.0708199999999999 in IEEE double, so the eight rows
    // whose VAT sits exactly on a half-penny rounded DOWN.
    const oldMultiplier = 1 + 7.082 / 100
    const oldResources = includedAllocations(Q3_REF_ALLOCATIONS).reduce((s, a) => {
      const base = Math.round(a.day_rate * (a.capacity_days ?? 0) * (a.utilisation_percent / 100))
      return s + (a.vat_applies ? Math.round(base * oldMultiplier) : base)
    }, 0)
    const oldTotal = oldResources + totals.adhocVatPence + totals.etpSsPence
    expect(oldTotal).toBe(Q3_REF_EXPECTED.oldPageTotalPence)
    expect(totals.totalPlatformPence - oldTotal).toBe(8)
  })
})

describe('every surface produces the same total from the same rows', () => {
  let rateCalculator: ExcelJS.Workbook
  let platformSchedule: ExcelJS.Workbook

  beforeAll(async () => {
    rateCalculator = await exportWorkbook('rate-calculator')
    platformSchedule = await exportWorkbook('platform-schedule')
  })

  const expected = Q3_REF_EXPECTED.totalPlatformPence
  const options = { activeTeamFilter: null, includeCostItems: true, vatRate: Q3_REF_VAT_RATE }

  it('the page footer', () => {
    expect(computeFooterTotals(PAGE_ROWS, Q3_REF_COST_ITEMS, options).vatPence).toBe(expected)
  })

  it('the KPI card', () => {
    expect(kpiTotalPence()).toBe(expected)
  })

  it('the Copy view — its totals and the sum of its own lines', () => {
    const view = buildCopyView(PAGE_ROWS as unknown as ExportRow[], Q3_REF_COST_ITEMS, options)
    expect(view.totals.vatPence).toBe(expected)
    const lines = view.lines.reduce(
      (s, l) => (l.kind === 'costItem' || l.countsTowardCost ? s + l.vatPence : s),
      0,
    )
    expect(lines).toBe(expected)
  })

  it('the Rate Calculator export — Summary, detail sheet and Raw Data', () => {
    expect(summaryTotalPence(rateCalculator)).toBe(expected)
    expect(detailSheetTotalPence(rateCalculator)).toBe(expected)
    expect(rawDataTotalPence(rateCalculator)).toBe(expected)
  })

  it('the Platform Schedule export — Summary, detail sheet and Raw Data', () => {
    expect(summaryTotalPence(platformSchedule)).toBe(expected)
    expect(detailSheetTotalPence(platformSchedule)).toBe(expected)
    expect(rawDataTotalPence(platformSchedule)).toBe(expected)
  })
})
