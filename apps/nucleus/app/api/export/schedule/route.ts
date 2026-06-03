import ExcelJS from 'exceljs'
import { getSupabaseServerClient } from '@plato/schema'

/* ── Query result shapes ──────────────────────────────────────────── */

interface PeriodRow {
  period_name: string
  period_start_date: string
  period_end_date: string
}

interface CostConfigRow {
  vat_uplift_percent: number
  blended_day_rate_override: number | null
}

type CostItemCategory = 'ADHOC' | 'ETP' | 'SHARED_SERVICES'

interface AllocationRow {
  allocation_id: string
  role_title: string | null
  resource_name: string | null
  planview_code: string | null
  supplier_name: string | null
  supplier_sort_order: number | null
  supplier_colour: string | null
  resource_location: string | null
  utilisation_percent: number
  capacity_days: number | null
  day_rate: number
  vat_applies: boolean
  team_name: string
}

interface CostItemRow {
  label: string
  amount_pence: number
  sort_order: number
  cost_item_category: CostItemCategory
}

/* ── Filename derivation ──────────────────────────────────────────── */
// "Q4 FY 25/26" → "Rate_Calculator_FY25-26_Q4_Web.xlsx"

function deriveFilename(periodName: string): string {
  // Match "Q<n> FY <yy>/<yy>" pattern
  const match = periodName.match(/Q(\d)\s+FY\s+(\d{2}\/\d{2})/)
  if (!match) return 'Rate_Calculator_Web.xlsx'
  const q = match[1]
  const fy = match[2].replace('/', '-')
  return `Rate_Calculator_FY${fy}_Q${q}_Web.xlsx`
}

/* ── Cell helpers ──────────────────────────────────────────────────── */

function currency(ws: ExcelJS.Worksheet, row: number, col: number) {
  const cell = ws.getCell(row, col)
  cell.numFmt = '£#,##0.00'
}

function bold(ws: ExcelJS.Worksheet, row: number) {
  ws.getRow(row).font = { bold: true }
}

function bgFill(ws: ExcelJS.Worksheet, row: number, argb: string) {
  const r = ws.getRow(row)
  r.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
  })
}

function setRowFill(ws: ExcelJS.Worksheet, rowNum: number, argb: string, cols: number) {
  for (let c = 1; c <= cols; c++) {
    ws.getCell(rowNum, c).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb },
    }
  }
}

// Blends the supplier hex colour with white at 15% opacity to produce a subtle tint.
function supplierTint(hex: string): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return 'FFFFFFFF'
  const r = Math.round(parseInt(clean.slice(0, 2), 16) * 0.15 + 255 * 0.85)
  const g = Math.round(parseInt(clean.slice(2, 4), 16) * 0.15 + 255 * 0.85)
  const b = Math.round(parseInt(clean.slice(4, 6), 16) * 0.15 + 255 * 0.85)
  return `FF${r.toString(16).padStart(2, '0').toUpperCase()}${g.toString(16).padStart(2, '0').toUpperCase()}${b.toString(16).padStart(2, '0').toUpperCase()}`
}

/* ══════════════════════════════════════════════════════════════════════
   GET /api/export/schedule?periodId=<uuid>
══════════════════════════════════════════════════════════════════════ */

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const periodId = searchParams.get('periodId')
  if (!periodId) {
    return new Response('Missing periodId query parameter', { status: 400 })
  }

  const supabase = getSupabaseServerClient()

  /* ── Query 1: Period ── */
  const { data: periodData, error: periodErr } = await supabase
    .from('periods')
    .select('period_name, period_start_date, period_end_date')
    .eq('period_id', periodId)
    .is('deleted_at', null)
    .maybeSingle()

  if (periodErr) return new Response(periodErr.message, { status: 500 })
  if (!periodData) return new Response('Period not found', { status: 404 })
  const period = periodData as PeriodRow

  /* ── Query 2: Cost configuration ── */
  const { data: ccData } = await supabase
    .from('cost_configurations')
    .select('vat_uplift_percent, blended_day_rate_override')
    .is('deleted_at', null)
    .order('effective_from', { ascending: false })
    .limit(1)

  const costConfig = ccData?.[0] as CostConfigRow | undefined
  const vatUpliftPercent: number = costConfig?.vat_uplift_percent ?? 0
  // Round to exactly 5 dp so the cell reads 1.07082, not 1.0708200000001
  const vatMultiplier = parseFloat((1 + Number(vatUpliftPercent) / 100).toFixed(5))
  const blendedDayRateOverridePence = costConfig?.blended_day_rate_override ?? null

  /* ── Query 3: Resource allocations ── */
  // Uses Supabase client-side joins matching the existing query pattern.
  const { data: rawAllocs, error: allocErr } = await supabase
    .from('resource_period_allocations')
    .select(`
      allocation_id,
      resource_id,
      role_title,
      planview_code,
      day_rate,
      utilisation_percent,
      capacity_days,
      vat_applies,
      resources:resource_id!left ( resource_name, resource_location ),
      suppliers:supplier_id ( supplier_name, sort_order, supplier_colour )
    `)
    .eq('period_id', periodId)
    .is('deleted_at', null)

  if (allocErr) return new Response(allocErr.message, { status: 500 })

  // Gather resource_ids to fetch team assignments
  type RawAllocRow = {
    allocation_id: string
    role_title: string | null
    planview_code: string | null
    day_rate: number
    utilisation_percent: number | string
    capacity_days: number | string | null
    vat_applies: boolean | null
    resource_id?: string | null
    resources: { resource_name: string; resource_location: string | null } | { resource_name: string; resource_location: string | null }[] | null
    suppliers: { supplier_name: string; sort_order: number | null; supplier_colour: string | null } | { supplier_name: string; sort_order: number | null; supplier_colour: string | null }[] | null
  }

  function pickOne<T>(v: T | T[] | null | undefined): T | null {
    if (!v) return null
    return Array.isArray(v) ? (v[0] ?? null) : v
  }

  const rawRows = (rawAllocs ?? []) as unknown as RawAllocRow[]

  // Fetch team assignments for all resources
  const resourceIds = rawRows
    .map((r) => r.resource_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  const teamMap = new Map<string, string>()
  if (resourceIds.length > 0) {
    const { data: teamData } = await supabase
      .from('resource_team_assignments')
      .select('resource_id, capacity_split, teams ( team_name )')
      .in('resource_id', resourceIds)
      .eq('period_id', periodId)
      .is('deleted_at', null)
      .order('capacity_split', { ascending: false })

    for (const r of (teamData ?? []) as unknown as { resource_id: string; teams: { team_name: string } | { team_name: string }[] | null }[]) {
      const team = pickOne(r.teams)
      if (team?.team_name && !teamMap.has(r.resource_id)) {
        teamMap.set(r.resource_id, team.team_name)
      }
    }
  }

  const allocations: AllocationRow[] = rawRows
    .map((r): AllocationRow => {
      const resource = pickOne(r.resources)
      const supplier = pickOne(r.suppliers)
      return {
        allocation_id: r.allocation_id,
        role_title: r.role_title,
        resource_name: resource?.resource_name ?? 'TBC / Vacant',
        planview_code: r.planview_code,
        supplier_name: supplier?.supplier_name ?? null,
        supplier_sort_order: supplier?.sort_order ?? null,
        supplier_colour: supplier?.supplier_colour ?? null,
        resource_location: resource?.resource_location ?? '',
        utilisation_percent: Number(r.utilisation_percent),
        capacity_days: r.capacity_days === null ? null : Number(r.capacity_days),
        day_rate: r.day_rate,
        vat_applies: r.vat_applies ?? true,
        team_name: r.resource_id ? (teamMap.get(r.resource_id) ?? '') : '',
      }
    })
    .sort((a, b) => {
      const sa = a.supplier_sort_order ?? Infinity
      const sb = b.supplier_sort_order ?? Infinity
      if (sa !== sb) return sa - sb
      return (a.resource_name ?? 'ZZZ').localeCompare(b.resource_name ?? 'ZZZ')
    })

  /* ── Query 4: Platform cost items (split by category) ── */
  const { data: costItemsData } = await supabase
    .from('platform_cost_items')
    .select('label, amount_pence, sort_order, cost_item_category')
    .eq('period_id', periodId)
    .is('deleted_at', null)
    .order('sort_order')

  const costItems = (costItemsData ?? []) as CostItemRow[]

  // Split by category so ETP/SS are counted once (in their own section) and
  // never double-counted inside the AD-HOC section.
  const adhocItems = costItems.filter((i) => i.cost_item_category === 'ADHOC')
  const etpSsItems = costItems.filter(
    (i) => i.cost_item_category === 'ETP' || i.cost_item_category === 'SHARED_SERVICES',
  )

  /* ══════════════════════════════════════════════════════════════════
     Build the workbook
  ══════════════════════════════════════════════════════════════════ */
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Plato Suite'
  wb.created = new Date()

  const sanitiseSheetName = (name: string): string =>
    name.replace(/[\\/?*[\]:]/g, '-').slice(0, 31)

  // Tab order follows creation order in ExcelJS: create Summary first so it is
  // the leftmost (first) tab, then the Rate Calculator. Both are written below.
  const ws2 = wb.addWorksheet(sanitiseSheetName('Summary'))
  ws2.columns = [
    { width: 35 }, // A
    { width: 18 }, // B
    { width: 18 }, // C
    { width: 14 }, // D
    { width: 12 }, // E
  ]

  const tabName = sanitiseSheetName(`Rate Calculator - ${period.period_name}`)
  const ws = wb.addWorksheet(tabName)

  // Column widths (A–M)
  ws.columns = [
    { width: 30 }, // A Role
    { width: 25 }, // B Resource
    { width: 14 }, // C PO
    { width: 20 }, // D Team
    { width: 10 }, // E Planview
    { width: 25 }, // F Organisation
    { width: 12 }, // G Location
    { width: 12 }, // H Utilisation
    { width: 10 }, // I Days
    { width: 12 }, // J Day Rate
    { width: 11 }, // K Chargeable
    { width: 14 }, // L Total
    { width: 14 }, // M +VAT
  ]

  const HEADER_ARGB = 'FF404044'
  const SUBTOTAL_ARGB = 'FFF5F5F5'
  const LABEL_ARGB = 'FF8F9495'
  const NUM_COLS = 13

  /* ── Row 1: empty ── */
  ws.addRow([])

  /* ── Row 2: headers ── */
  const headerRow = ws.addRow([
    'Role', 'Resource', 'PO', 'Team', 'Planview',
    'Organisation', 'Location', 'Utilisation', 'Days', 'Day Rate',
    'Chargeable', 'Total', '+VAT',
  ])
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
  setRowFill(ws, headerRow.number, HEADER_ARGB, NUM_COLS)
  headerRow.eachCell((cell) => {
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF606064' } },
    }
  })

  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 13 } }

  const HEADER_ROW = 2
  const FIRST_DATA_ROW = HEADER_ROW + 1 // = 3

  /* ── Pass 1: resource rows (VAT formula placeholder until VAT cell row is known) ── */
  const vatRows: number[] = [] // row numbers that need vat_applies=true formula

  const capitalise = (s: string | null): string =>
    s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

  for (const alloc of allocations) {
    const rowNum = ws.rowCount + 1
    const r = ws.addRow([
      alloc.role_title ?? '',
      alloc.resource_name,
      'WEB', // PO — platform identifier (hardcoded for now)
      alloc.team_name,
      alloc.planview_code ?? '',
      alloc.supplier_name ?? '',
      capitalise(alloc.resource_location),
      alloc.utilisation_percent / 100,
      alloc.capacity_days ?? 0,
      alloc.day_rate / 100,
      { formula: `=IF(E${rowNum}="PR","Yes","No")` },
      { formula: `=(H${rowNum}*I${rowNum})*J${rowNum}` },
      // Placeholder — will be replaced in pass 2 once VAT row is known
      alloc.vat_applies
        ? { formula: `=L${rowNum}` } // temporary; replaced below
        : { formula: `=L${rowNum}` },
    ])

    // Percentage for H, currency for J/L/M
    r.getCell(8).numFmt = '0%'
    r.getCell(10).numFmt = '£#,##0.00'
    r.getCell(12).numFmt = '£#,##0.00'
    r.getCell(13).numFmt = '£#,##0.00'

    if (alloc.supplier_colour) {
      setRowFill(ws, rowNum, supplierTint(alloc.supplier_colour), NUM_COLS)
    } else if ((rowNum - FIRST_DATA_ROW) % 2 === 0) {
      setRowFill(ws, rowNum, 'FFFAFAFA', NUM_COLS)
    }

    if (alloc.vat_applies) vatRows.push(rowNum)
  }

  const lastResourceRow = ws.rowCount

  /* ── Ad-hoc cost items (ADHOC category only) ── */
  let lastAdhocRow = lastResourceRow

  if (adhocItems.length > 0) {
    ws.addRow([]) // blank
    const adhocLabelRow = ws.addRow(['AD-HOC COSTS'])
    adhocLabelRow.getCell(1).font = { italic: true, color: { argb: 'FF8F9495' } }

    for (const item of adhocItems) {
      const rowNum = ws.rowCount + 1
      const r = ws.addRow([
        item.label,
        '', '', '', '', '', '', '', '', '', '',
        item.amount_pence / 100,
        { formula: `=L${rowNum}` },
      ])
      r.getCell(12).numFmt = '£#,##0.00'
      r.getCell(13).numFmt = '£#,##0.00'
      lastAdhocRow = rowNum
    }
  }

  /* ── ETP & Shared Services (one row per ETP / SHARED_SERVICES item) ── */
  let firstEtpRow = 0
  let lastEtpRow = 0

  if (etpSsItems.length > 0) {
    ws.addRow([]) // blank
    const etpLabelRow = ws.addRow(['ETP & SHARED SERVICES'])
    etpLabelRow.getCell(1).font = { italic: true, color: { argb: LABEL_ARGB } }

    for (const item of etpSsItems) {
      const rowNum = ws.rowCount + 1
      const r = ws.addRow([
        item.label,
        '', '', '', '', '', '', '', '', '', '',
        item.amount_pence / 100,
        { formula: `=L${rowNum}` },
      ])
      r.getCell(12).numFmt = '£#,##0.00'
      r.getCell(13).numFmt = '£#,##0.00'
      if (firstEtpRow === 0) firstEtpRow = rowNum
      lastEtpRow = rowNum
    }
  }

  // Last row that carries data — used for all SUBTOTAL/SUMIF ranges. Blank and
  // label rows inside the range are ignored by SUBTOTAL/SUMIF.
  const lastDataRow = Math.max(lastResourceRow, lastAdhocRow, lastEtpRow)

  /* ── Blank spacer ── */
  ws.addRow([])

  /* ── Subtotal row ── */
  const subtotalRowNum = ws.rowCount + 1
  const subtotalRow = ws.addRow([
    'SUBTOTAL',
    '', '', '', '', '', '', '', '', '', '',
    { formula: `=SUBTOTAL(9,L${FIRST_DATA_ROW}:L${lastDataRow})` },
    { formula: `=SUBTOTAL(9,M${FIRST_DATA_ROW}:M${lastDataRow})` },
  ])
  subtotalRow.font = { bold: true }
  setRowFill(ws, subtotalRowNum, SUBTOTAL_ARGB, NUM_COLS)
  subtotalRow.getCell(12).numFmt = '£#,##0.00'
  subtotalRow.getCell(13).numFmt = '£#,##0.00'

  /* ── Two blank rows ── */
  ws.addRow([])
  ws.addRow([])

  /* ── Configuration section ── */
  // VAT Multiplier row — this is the anchor for all vat_applies formulas
  const vatMultiplierRowNum = ws.rowCount + 1
  const vatRow = ws.addRow([
    'VAT Multiplier', '', '', '', '', '', '', '',
    vatMultiplier, // I column
  ])
  vatRow.getCell(1).font = { bold: true }
  vatRow.getCell(9).numFmt = '0.00000'

  const billableDaysRowNum = ws.rowCount + 1
  const billableRow = ws.addRow([
    'Total Billable Days', '', '', '', '', '', '', '',
    { formula: `=SUMIF(K${FIRST_DATA_ROW}:K${lastDataRow},"Yes",I${FIRST_DATA_ROW}:I${lastDataRow})` },
  ])
  billableRow.getCell(1).font = { bold: true }

  const utilisationRowNum = ws.rowCount + 1
  const utilisationRow = ws.addRow([
    'Utilisation', '', '', '', '', '', '', '',
    1,
  ])
  utilisationRow.getCell(1).font = { bold: true }

  const xChargeableRowNum = ws.rowCount + 1
  const xChargeableRow = ws.addRow([
    'X-Chargeable Days', '', '', '', '', '', '', '',
    { formula: `=I${utilisationRowNum}*I${billableDaysRowNum}` },
  ])
  xChargeableRow.getCell(1).font = { bold: true }

  const dayRateRowNum = ws.rowCount + 1
  const dayRateRow = ws.addRow([
    'Advised Rate', '', '', '', '', '', '', '',
    { formula: `=M${subtotalRowNum}/I${xChargeableRowNum}` },
  ])
  dayRateRow.getCell(1).font = { bold: true }
  dayRateRow.getCell(9).numFmt = '£#,##0.00'

  /* ── Pass 2: back-fill VAT formulas with the now-known VAT multiplier cell ── */
  for (const rowNum of vatRows) {
    const cell = ws.getCell(rowNum, 13) // M column
    cell.value = { formula: `=L${rowNum}*$I$${vatMultiplierRowNum}` }
    cell.numFmt = '£#,##0.00'
  }

  /* ══════════════════════════════════════════════════════════════════
     Tab 2 (created first for tab order): write the Summary content
  ══════════════════════════════════════════════════════════════════ */
  const ref = `'${tabName}'` // cross-sheet reference prefix

  let s2Row = 1

  // Quarter overview
  ws2.getCell(s2Row, 1).value = 'QUARTER OVERVIEW'
  ws2.getCell(s2Row, 1).font = { bold: true, size: 11 }
  s2Row++

  ws2.getCell(s2Row, 1).value = 'Period'
  ws2.getCell(s2Row, 2).value = period.period_name
  s2Row++

  ws2.getCell(s2Row, 1).value = 'Start Date'
  ws2.getCell(s2Row, 2).value = new Date(period.period_start_date)
  ws2.getCell(s2Row, 2).numFmt = 'dd/mm/yyyy'
  s2Row++

  ws2.getCell(s2Row, 1).value = 'End Date'
  ws2.getCell(s2Row, 2).value = new Date(period.period_end_date)
  ws2.getCell(s2Row, 2).numFmt = 'dd/mm/yyyy'
  s2Row++

  ws2.getCell(s2Row, 1).value = 'Total BASE (ex-VAT)'
  ws2.getCell(s2Row, 2).value = { formula: `=SUBTOTAL(9,${ref}!L${FIRST_DATA_ROW}:L${lastDataRow})` }
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  s2Row++

  ws2.getCell(s2Row, 1).value = 'Total +VAT'
  ws2.getCell(s2Row, 2).value = { formula: `=SUBTOTAL(9,${ref}!M${FIRST_DATA_ROW}:M${lastDataRow})` }
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  s2Row += 2

  // Supplier breakdown table
  ws2.getCell(s2Row, 1).value = 'SUPPLIER BREAKDOWN'
  ws2.getCell(s2Row, 1).font = { bold: true, size: 11 }
  s2Row++

  const supplierHeaderRow = ws2.getRow(s2Row)
  ;['Supplier', 'Base Cost', '+VAT Cost', '% of Total', 'Resources'].forEach((h, i) => {
    const cell = supplierHeaderRow.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_ARGB } }
  })
  s2Row++

  const uniqueSuppliers = [...new Set(
    allocations.map((a) => a.supplier_name).filter((s): s is string => s !== null && s !== '')
  )]
  const supplierDataStart = s2Row

  for (const supplier of uniqueSuppliers) {
    ws2.getCell(s2Row, 1).value = supplier
    ws2.getCell(s2Row, 2).value = {
      formula: `=SUMIF(${ref}!F${FIRST_DATA_ROW}:F${lastResourceRow},"${supplier}",${ref}!L${FIRST_DATA_ROW}:L${lastResourceRow})`,
    }
    ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
    ws2.getCell(s2Row, 3).value = {
      formula: `=SUMIF(${ref}!F${FIRST_DATA_ROW}:F${lastResourceRow},"${supplier}",${ref}!M${FIRST_DATA_ROW}:M${lastResourceRow})`,
    }
    ws2.getCell(s2Row, 3).numFmt = '£#,##0.00'
    ws2.getCell(s2Row, 4).value = {
      formula: `=IF(SUBTOTAL(9,${ref}!L${FIRST_DATA_ROW}:L${lastDataRow})=0,0,B${s2Row}/SUBTOTAL(9,${ref}!L${FIRST_DATA_ROW}:L${lastDataRow}))`,
    }
    ws2.getCell(s2Row, 4).numFmt = '0.0%'
    ws2.getCell(s2Row, 5).value = {
      formula: `=COUNTIF(${ref}!F${FIRST_DATA_ROW}:F${lastResourceRow},"${supplier}")`,
    }
    s2Row++
  }
  const supplierDataEnd = s2Row - 1

  // Supplier totals row
  ws2.getCell(s2Row, 1).value = 'Total'
  ws2.getCell(s2Row, 1).font = { bold: true }
  ws2.getCell(s2Row, 2).value = { formula: `=SUM(B${supplierDataStart}:B${supplierDataEnd})` }
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  ws2.getCell(s2Row, 2).font = { bold: true }
  ws2.getCell(s2Row, 3).value = { formula: `=SUM(C${supplierDataStart}:C${supplierDataEnd})` }
  ws2.getCell(s2Row, 3).numFmt = '£#,##0.00'
  ws2.getCell(s2Row, 3).font = { bold: true }
  ws2.getCell(s2Row, 5).value = { formula: `=SUM(E${supplierDataStart}:E${supplierDataEnd})` }
  ws2.getCell(s2Row, 5).font = { bold: true }
  s2Row += 2

  // Planview code split
  ws2.getCell(s2Row, 1).value = 'PLANVIEW CODE SPLIT'
  ws2.getCell(s2Row, 1).font = { bold: true, size: 11 }
  s2Row++

  const planviewHeaderRow = ws2.getRow(s2Row)
  ;['Code', 'Base Cost', '+VAT Cost', 'Headcount'].forEach((h, i) => {
    const cell = planviewHeaderRow.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_ARGB } }
  })
  s2Row++

  const planviewDataStart = s2Row
  // ETP is a cost_item_category, not a planview code — excluded here.
  for (const code of ['PR', 'F_Gov', 'BAU'] as const) {
    const displayCode = code === 'F_Gov' ? 'F_GOV' : code
    ws2.getCell(s2Row, 1).value = displayCode
    ws2.getCell(s2Row, 2).value = {
      formula: `=SUMIF(${ref}!E${FIRST_DATA_ROW}:E${lastResourceRow},"${code}",${ref}!L${FIRST_DATA_ROW}:L${lastResourceRow})`,
    }
    ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
    ws2.getCell(s2Row, 3).value = {
      formula: `=SUMIF(${ref}!E${FIRST_DATA_ROW}:E${lastResourceRow},"${code}",${ref}!M${FIRST_DATA_ROW}:M${lastResourceRow})`,
    }
    ws2.getCell(s2Row, 3).numFmt = '£#,##0.00'
    ws2.getCell(s2Row, 4).value = {
      formula: `=COUNTIF(${ref}!E${FIRST_DATA_ROW}:E${lastResourceRow},"${code}")`,
    }
    s2Row++
  }
  s2Row++

  // Blended rate summary
  ws2.getCell(s2Row, 1).value = 'BLENDED RATE SUMMARY'
  ws2.getCell(s2Row, 1).font = { bold: true, size: 11 }
  s2Row++

  ws2.getCell(s2Row, 1).value = 'Advised Rate'
  ws2.getCell(s2Row, 2).value = { formula: `='${tabName}'!I${dayRateRowNum}` }
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  s2Row++

  // ETP & SS total — cross-sheet SUM of the actual ETP/SS rows (no hardcode).
  ws2.getCell(s2Row, 1).value = 'ETP & Shared Services Total'
  ws2.getCell(s2Row, 2).value =
    etpSsItems.length > 0
      ? { formula: `=SUM('${tabName}'!L${firstEtpRow}:L${lastEtpRow})` }
      : 0
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  s2Row++

  // Full platform rate = total +VAT subtotal (incl. ETP & SS) / X-Chargeable Days.
  ws2.getCell(s2Row, 1).value = 'Advised Rate (incl. ETP & SS)'
  ws2.getCell(s2Row, 2).value = {
    formula: `=IF('${tabName}'!I${xChargeableRowNum}=0,0,'${tabName}'!M${subtotalRowNum}/'${tabName}'!I${xChargeableRowNum})`,
  }
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  s2Row++

  // Current Rate — the rate agreed with Finance, read from the DB override.
  ws2.getCell(s2Row, 1).value = 'Current Rate'
  ws2.getCell(s2Row, 2).value =
    blendedDayRateOverridePence !== null ? blendedDayRateOverridePence / 100 : 0
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  ws2.getCell(s2Row, 3).value = '(agreed with Finance)'
  ws2.getCell(s2Row, 3).font = { italic: true, color: { argb: LABEL_ARGB } }

  /* ── Serialise to buffer ── */
  const buffer = await wb.xlsx.writeBuffer()

  const filename = deriveFilename(period.period_name)

  return new Response(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
