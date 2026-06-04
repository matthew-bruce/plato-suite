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
  resource_id: string | null
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

function deriveFilename(periodName: string, stamp: string): string {
  // Match "Q<n> FY <yy>/<yy>" pattern
  const match = periodName.match(/Q(\d)\s+FY\s+(\d{2}\/\d{2})/)
  if (!match) return `Rate_Calculator_Web_${stamp}.xlsx`
  const q = match[1]
  const fy = match[2].replace('/', '-')
  return `Rate_Calculator_FY${fy}_Q${q}_Web_${stamp}.xlsx`
}

// "Q4 FY 25/26" → { quarterLabel: "Q4", fyShort: "25-26" }
function derivePeriodLabels(periodName: string): { quarterLabel: string; fyShort: string } {
  const match = periodName.match(/Q(\d)\s+FY\s+(\d{2}\/\d{2})/)
  if (!match) return { quarterLabel: periodName, fyShort: '' }
  return { quarterLabel: `Q${match[1]}`, fyShort: match[2].replace('/', '-') }
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

// Blends the supplier hex colour with white at 12% intensity to produce a subtle tint.
function supplierTint(hex: string): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return 'FFFFFFFF'
  const r = Math.round(parseInt(clean.slice(0, 2), 16) * 0.12 + 255 * 0.88)
  const g = Math.round(parseInt(clean.slice(2, 4), 16) * 0.12 + 255 * 0.88)
  const b = Math.round(parseInt(clean.slice(4, 6), 16) * 0.12 + 255 * 0.88)
  return `FF${r.toString(16).padStart(2, '0').toUpperCase()}${g.toString(16).padStart(2, '0').toUpperCase()}${b.toString(16).padStart(2, '0').toUpperCase()}`
}

function applyFill(cell: ExcelJS.Cell, argb: string): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

// Solid mid-grey section header band spanning the given column count.
function writeSectionHeader(
  ws: ExcelJS.Worksheet,
  rowNum: number,
  label: string,
  colCount = 13,
): void {
  for (let c = 1; c <= colCount; c++) {
    const cell = ws.getCell(rowNum, c)
    applyFill(cell, 'FF5A5A5E')
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
  }
  ws.getCell(rowNum, 1).value = label
}

// Full-colour supplier band header row inserted before each supplier's resource rows.
function writeSupplierBandRow(
  ws: ExcelJS.Worksheet,
  rowNum: number,
  supplierName: string,
  supplierColour: string,
  resourceCount: number,
  avgDayRate: number,
): void {
  const argb = 'FF' + supplierColour.replace('#', '')
  for (let c = 1; c <= 13; c++) {
    ws.getCell(rowNum, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
  }
  const labelCell = ws.getCell(rowNum, 1)
  labelCell.value = `${supplierName.toUpperCase()}  ·  ${resourceCount} resource${resourceCount !== 1 ? 's' : ''}`
  labelCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }

  const rateCell = ws.getCell(rowNum, 13)
  rateCell.value = `avg/day  £${avgDayRate.toFixed(2)}`
  rateCell.font = { bold: false, color: { argb: 'CCFFFFFF' }, size: 10 }
  rateCell.alignment = { horizontal: 'right' }

  ws.getRow(rowNum).height = 16
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
        resource_id: r.resource_id ?? null,
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

  /* ── Timestamp in UK timezone (server runs UTC) ── */
  const pad = (n: number) => String(n).padStart(2, '0')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const nowUtc = new Date()
  const ukParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(nowUtc)
  const get = (type: string) => ukParts.find((p) => p.type === type)?.value ?? '00'
  const stamp = `${get('year')}${get('month')}${get('day')}_${get('hour')}${get('minute')}`
  const exportedAt = `Exported ${parseInt(get('day'))} ${months[parseInt(get('month')) - 1]} ${get('year')} at ${get('hour')}:${get('minute')}`

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
  ws2.views = [{ showGridLines: false }]
  ws2.columns = [
    { width: 28 }, // A
    { width: 14 }, // B
    { width: 14 }, // C
    { width: 9 },  // D
    { width: 9 },  // E
    { width: 9 },  // F
    { width: 9 },  // G
    { width: 9 },  // H
  ]

  const { quarterLabel, fyShort } = derivePeriodLabels(period.period_name)
  const tab1Name = sanitiseSheetName(`Web - ${quarterLabel} FY${fyShort}`)
  const ws = wb.addWorksheet(tab1Name)
  ws.views = [{ showGridLines: false }]

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

  // Raw Data tab — created third so tab order is Summary → Rate Calculator → Raw Data.
  const ws3 = wb.addWorksheet(sanitiseSheetName('Raw Data'))
  ws3.columns = [
    { width: 30 }, { width: 25 }, { width: 14 }, { width: 20 }, { width: 10 },
    { width: 25 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 12 },
    { width: 11 }, { width: 14 }, { width: 14 },
  ]

  const HEADER_ARGB = 'FF404044'
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

  /* ── Group allocations by supplier (preserving existing sort order) ── */
  type SupplierGroup = { supplierName: string | null; colour: string | null; rows: AllocationRow[] }
  const supplierGroupsOrdered: SupplierGroup[] = []
  const supplierIndexMap = new Map<string | null, number>()
  for (const alloc of allocations) {
    const key = alloc.supplier_name
    if (!supplierIndexMap.has(key)) {
      supplierIndexMap.set(key, supplierGroupsOrdered.length)
      supplierGroupsOrdered.push({ supplierName: key, colour: alloc.supplier_colour, rows: [] })
    }
    supplierGroupsOrdered[supplierIndexMap.get(key)!].rows.push(alloc)
  }

  /* ── Pass 1: supplier band rows + resource rows (VAT placeholder until VAT row known) ── */
  const vatRows: number[] = []

  const capitalise = (s: string | null): string =>
    s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

  for (const group of supplierGroupsOrdered) {
    // Band header row immediately before this supplier's resource rows.
    const bandRowNum = ws.rowCount + 1
    ws.addRow([])
    const avgRate = group.rows.reduce((sum, r) => sum + r.day_rate / 100, 0) / group.rows.length
    writeSupplierBandRow(
      ws, bandRowNum,
      group.supplierName ?? 'Unknown',
      group.colour ?? '#888888',
      group.rows.length,
      avgRate,
    )

    for (const alloc of group.rows) {
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
        // Placeholder — replaced in pass 2 once VAT row is known
        { formula: `=L${rowNum}` },
      ])

      r.getCell(8).numFmt = '0%'
      r.getCell(10).numFmt = '£#,##0.00'
      r.getCell(12).numFmt = '£#,##0.00'
      r.getCell(13).numFmt = '£#,##0.00'

      /* ── Row background: vacant amber, else supplier tint ── */
      const isVacant = !alloc.resource_id
      const isZeroCost = (alloc.capacity_days ?? 0) === 0 || alloc.utilisation_percent === 0

      const rowArgb = isVacant
        ? 'FFFEF9E7'
        : supplierTint(alloc.supplier_colour ?? '#888888')
      setRowFill(ws, rowNum, rowArgb, NUM_COLS)

      /* ── Column K — Chargeable Yes/No colour ── */
      const isChargeable = alloc.planview_code === 'PR'
      ws.getCell(`K${rowNum}`).font = {
        bold: isChargeable,
        color: { argb: isChargeable ? 'FF1B5E20' : 'FF8F9495' },
        size: 10,
      }

      /* ── Column B — TBC/Vacant italic amber-brown ── */
      if (isVacant) {
        ws.getCell(`B${rowNum}`).font = { italic: true, color: { argb: 'FF8A6000' }, size: 10 }
      }

      /* ── Zero-cost rows — em dash in Total/+VAT (no cost generated) ── */
      if (isZeroCost) {
        ws.getCell(`L${rowNum}`).value = '—'
        ws.getCell(`M${rowNum}`).value = '—'
      }

      if (alloc.vat_applies && !isZeroCost) vatRows.push(rowNum)
    }
  }

  const lastResourceRow = ws.rowCount

  /* ── Ad-hoc cost items (ADHOC category only) ── */
  let lastAdhocRow = lastResourceRow

  if (adhocItems.length > 0) {
    ws.addRow([]) // blank
    const adhocLabelRowNum = ws.rowCount + 1
    ws.addRow([])
    writeSectionHeader(ws, adhocLabelRowNum, 'AD-HOC COSTS')

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
      setRowFill(ws, rowNum, 'FFFAFAFA', NUM_COLS)
      lastAdhocRow = rowNum
    }
  }

  /* ── ETP & Shared Services (one row per ETP / SHARED_SERVICES item) ── */
  let firstEtpRow = 0
  let lastEtpRow = 0

  if (etpSsItems.length > 0) {
    ws.addRow([]) // blank
    const etpLabelRowNum = ws.rowCount + 1
    ws.addRow([])
    writeSectionHeader(ws, etpLabelRowNum, 'ETP & SHARED SERVICES')

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
      setRowFill(ws, rowNum, 'FFFAFAFA', NUM_COLS)
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
  setRowFill(ws, subtotalRowNum, HEADER_ARGB, NUM_COLS)
  subtotalRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  subtotalRow.getCell(12).numFmt = '£#,##0.00'
  subtotalRow.getCell(13).numFmt = '£#,##0.00'
  // L white, M yellow — the VAT-inclusive total is the number Finance acts on.
  ws.getCell(`L${subtotalRowNum}`).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
  ws.getCell(`M${subtotalRowNum}`).font = { bold: true, color: { argb: 'FFFDDA24' }, size: 12 }

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

  /* ── Plain config rows: #F8F8F8 background, grey label font ── */
  for (const plainRowNum of [vatMultiplierRowNum, billableDaysRowNum, utilisationRowNum, xChargeableRowNum]) {
    for (let c = 1; c <= 9; c++) applyFill(ws.getCell(plainRowNum, c), 'FFF8F8F8')
    ws.getCell(plainRowNum, 1).font = { color: { argb: 'FF8F9495' }, size: 10 }
  }

  const dayRateRowNum = ws.rowCount + 1
  const dayRateRow = ws.addRow([
    'Advised Rate', '', '', '', '', '', '', '',
    { formula: `=M${subtotalRowNum}/I${xChargeableRowNum}` },
  ])
  dayRateRow.getCell(9).numFmt = '£#,##0.00'

  const currentRateRowNum = ws.rowCount + 1
  const currentRateRow = ws.addRow([
    'Current Rate', '', '', '', '', '', '', '',
    blendedDayRateOverridePence !== null ? blendedDayRateOverridePence / 100 : 0,
  ])
  currentRateRow.getCell(9).numFmt = '£#,##0.00'

  /* ── Config rate rows: left-border accent styling ── */
  // Advised Rate — yellow accent.
  for (let c = 1; c <= 9; c++) applyFill(ws.getCell(dayRateRowNum, c), 'FFFFFDE7')
  ws.getCell(`A${dayRateRowNum}`).font = { bold: true, color: { argb: 'FF5A4000' }, size: 10 }
  ws.getCell(`A${dayRateRowNum}`).border = { left: { style: 'medium', color: { argb: 'FFFDDA24' } } }
  ws.getCell(`I${dayRateRowNum}`).font = { bold: true, color: { argb: 'FF5A4000' }, size: 10 }

  // Current Rate — green accent.
  for (let c = 1; c <= 9; c++) applyFill(ws.getCell(currentRateRowNum, c), 'FFE8F5E9')
  ws.getCell(`A${currentRateRowNum}`).font = { bold: true, color: { argb: 'FF1B5E20' }, size: 10 }
  ws.getCell(`A${currentRateRowNum}`).border = { left: { style: 'medium', color: { argb: 'FF66BB6A' } } }
  ws.getCell(`I${currentRateRowNum}`).font = { bold: true, color: { argb: 'FF1B5E20' }, size: 10 }

  /* ── Pass 2: back-fill VAT formulas with the now-known VAT multiplier cell ── */
  for (const rowNum of vatRows) {
    const cell = ws.getCell(rowNum, 13) // M column
    cell.value = { formula: `=L${rowNum}*$I$${vatMultiplierRowNum}` }
    cell.numFmt = '£#,##0.00'
  }

  /* ══════════════════════════════════════════════════════════════════
     Tab 2 (created first for tab order): write the Summary content (v4)
  ══════════════════════════════════════════════════════════════════ */
  const ref = `'${tab1Name}'` // cross-sheet reference prefix
  const resRange = (col: string) => `${ref}!${col}${FIRST_DATA_ROW}:${col}${lastResourceRow}`

  /* ── Aggregates computed in TS (literal values — robust to layout) ── */
  const resBaseVat = allocations.reduce((s, a) => {
    const total = (a.utilisation_percent / 100) * (a.capacity_days ?? 0) * (a.day_rate / 100)
    return s + (a.vat_applies ? total * vatMultiplier : total)
  }, 0)
  const adhocTotal = adhocItems.reduce((s, i) => s + i.amount_pence / 100, 0)
  const resourcesAdhocVat = resBaseVat + adhocTotal
  const etpSsTotal = etpSsItems.reduce((s, i) => s + i.amount_pence / 100, 0)
  const grandTotalVat = resourcesAdhocVat + etpSsTotal
  const xChargeableDays = allocations.reduce(
    (s, a) => (a.planview_code === 'PR' ? s + (a.capacity_days ?? 0) : s),
    0,
  )
  const advisedRate = xChargeableDays > 0 ? grandTotalVat / xChargeableDays : 0
  const currentRate = blendedDayRateOverridePence !== null ? blendedDayRateOverridePence / 100 : 0

  /* ── Date range + working-day count for the hero ── */
  const pStart = new Date(period.period_start_date)
  const pEnd = new Date(period.period_end_date)
  const fmtDdMon = (d: Date) => `${pad(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  let workingDays = 0
  for (const cur = new Date(pStart); cur <= pEnd; cur.setUTCDate(cur.getUTCDate() + 1)) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) workingDays++
  }
  const dateRange = `${fmtDdMon(pStart)} – ${fmtDdMon(pEnd)} · ${workingDays} working days`

  /* ── Rich-text coloured square indicator ── */
  const squareRich = (colourHex: string, text: string, textArgb: string, size = 11) => ({
    richText: [
      { text: '■ ', font: { color: { argb: 'FF' + colourHex.replace('#', '') }, size } },
      { text, font: { color: { argb: textArgb }, size } },
    ],
  })

  const DARK = 'FF2A2A2D'
  let s2Row = 1

  /* ── Hero section (rows 1–6) ── */
  // Row 1 — empty dark band
  setRowFill(ws2, s2Row, DARK, 8)
  s2Row++
  // Row 2 — quarter name + date range
  setRowFill(ws2, s2Row, DARK, 8)
  ws2.getCell(s2Row, 1).value = period.period_name
  ws2.getCell(s2Row, 1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 18 }
  ws2.getCell(s2Row, 3).value = dateRange
  ws2.getCell(s2Row, 3).font = { color: { argb: 'FF8F9495' }, size: 10 }
  s2Row++
  // Row 3 — strapline
  setRowFill(ws2, s2Row, DARK, 8)
  ws2.getCell(s2Row, 1).value = 'WEB PLATFORM — COST SCHEDULE'
  ws2.getCell(s2Row, 1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
  s2Row++
  // Row 4 — exported-at
  setRowFill(ws2, s2Row, DARK, 8)
  ws2.getCell(s2Row, 1).value = exportedAt
  ws2.getCell(s2Row, 1).font = { italic: true, color: { argb: 'FF555555' }, size: 10 }
  s2Row++
  // Row 5 — KPI labels
  setRowFill(ws2, s2Row, DARK, 8)
  ws2.getCell(s2Row, 1).value = 'TOTAL PLATFORM COST'
  ws2.getCell(s2Row, 2).value = 'ADVISED RATE'
  ws2.getCell(s2Row, 3).value = 'CURRENT RATE'
  ws2.getCell(s2Row, 4).value = 'VARIANCE'
  for (const col of [1, 2, 3, 4]) {
    ws2.getCell(s2Row, col).font = { bold: true, color: { argb: 'FF8F9495' }, size: 9 }
  }
  s2Row++
  // Row 6 — KPI values
  setRowFill(ws2, s2Row, DARK, 8)
  ws2.getRow(s2Row).height = 22
  ws2.getCell(s2Row, 1).value = grandTotalVat
  ws2.getCell(s2Row, 1).numFmt = '£#,##0'
  ws2.getCell(s2Row, 1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 17 }
  ws2.getCell(s2Row, 2).value = advisedRate
  ws2.getCell(s2Row, 2).numFmt = '£#,##0" / day"'
  ws2.getCell(s2Row, 2).font = { bold: true, color: { argb: 'FFFDDA24' }, size: 17 }
  ws2.getCell(s2Row, 3).value = currentRate
  ws2.getCell(s2Row, 3).numFmt = '£#,##0" / day"'
  ws2.getCell(s2Row, 3).font = { bold: true, color: { argb: 'FF7EC8A4' }, size: 17 }
  ws2.getCell(s2Row, 4).value = advisedRate - currentRate
  ws2.getCell(s2Row, 4).numFmt = '"▲ "£#,##0" / day";"▼ "£#,##0" / day"'
  ws2.getCell(s2Row, 4).font = { bold: true, color: { argb: 'FFF07070' }, size: 17 }
  s2Row++
  // Row 7 — blank separator
  ws2.getRow(s2Row).height = 6
  s2Row += 2

  /* ── Local section + column-header helpers (8-col Summary) ── */
  const sectionHeader = (label: string, argb = 'FF404044', size = 10) => {
    for (let c = 1; c <= 8; c++) {
      applyFill(ws2.getCell(s2Row, c), argb)
      ws2.getCell(s2Row, c).font = { bold: true, color: { argb: 'FFFFFFFF' }, size }
    }
    ws2.getCell(s2Row, 1).value = label
    s2Row++
  }
  const colHeaderRow = (labels: string[], aligns: Record<number, 'left' | 'center' | 'right'> = {}) => {
    for (let c = 1; c <= 8; c++) applyFill(ws2.getCell(s2Row, c), 'FFF5F5F5')
    labels.forEach((h, i) => {
      const cell = ws2.getCell(s2Row, i + 1)
      cell.value = h
      cell.font = { bold: true, color: { argb: 'FF555555' }, size: 10 }
      if (aligns[i + 1]) cell.alignment = { horizontal: aligns[i + 1] }
    })
    s2Row++
  }

  /* ══ SUPPLIER & LOCATION BREAKDOWN ══ */
  sectionHeader('SUPPLIER & LOCATION BREAKDOWN')
  colHeaderRow(
    ['Supplier', 'Base Cost', '+VAT Cost', '% Total', 'Onshore', 'Nearshore', 'Offshore', 'Total'],
    { 2: 'right', 3: 'right', 4: 'center', 5: 'center', 6: 'center', 7: 'center', 8: 'center' },
  )

  // Suppliers in sort_order with colour
  const supplierColourMap = new Map<string, string | null>()
  const supplierOrderMap = new Map<string, number>()
  for (const a of allocations) {
    if (a.supplier_name && !supplierColourMap.has(a.supplier_name)) {
      supplierColourMap.set(a.supplier_name, a.supplier_colour)
      supplierOrderMap.set(a.supplier_name, a.supplier_sort_order ?? Infinity)
    }
  }
  const orderedSuppliers = [...supplierColourMap.keys()].sort(
    (a, b) => (supplierOrderMap.get(a) ?? Infinity) - (supplierOrderMap.get(b) ?? Infinity),
  )

  const supplierDataStart = s2Row
  const supplierTotalRow = supplierDataStart + orderedSuppliers.length
  const sF = resRange('F') // organisation column on Rate Calc
  const sG = resRange('G') // location column
  const sL = resRange('L') // base cost
  const sM = resRange('M') // +VAT cost

  for (const supplierName of orderedSuppliers) {
    const colour = supplierColourMap.get(supplierName) ?? '#888888'
    for (let c = 1; c <= 8; c++) applyFill(ws2.getCell(s2Row, c), supplierTint(colour))
    ws2.getCell(s2Row, 1).value = squareRich(colour, supplierName, 'FF2A2A2D')
    ws2.getCell(s2Row, 2).value = { formula: `=SUMIF(${sF},"${supplierName}",${sL})` }
    ws2.getCell(s2Row, 2).numFmt = '£#,##0'
    ws2.getCell(s2Row, 2).alignment = { horizontal: 'right' }
    ws2.getCell(s2Row, 3).value = { formula: `=SUMIF(${sF},"${supplierName}",${sM})` }
    ws2.getCell(s2Row, 3).numFmt = '£#,##0'
    ws2.getCell(s2Row, 3).alignment = { horizontal: 'right' }
    ws2.getCell(s2Row, 4).value = { formula: `=IF(C${supplierTotalRow}=0,0,C${s2Row}/C${supplierTotalRow})` }
    ws2.getCell(s2Row, 4).numFmt = '0.0%'
    ws2.getCell(s2Row, 4).alignment = { horizontal: 'center' }
    ws2.getCell(s2Row, 5).value = { formula: `=COUNTIFS(${sF},"${supplierName}",${sG},"Onshore")` }
    ws2.getCell(s2Row, 6).value = { formula: `=COUNTIFS(${sF},"${supplierName}",${sG},"Nearshore")` }
    ws2.getCell(s2Row, 7).value = { formula: `=COUNTIFS(${sF},"${supplierName}",${sG},"Offshore")` }
    ws2.getCell(s2Row, 8).value = { formula: `=E${s2Row}+F${s2Row}+G${s2Row}` }
    ws2.getCell(s2Row, 8).font = { bold: true }
    for (let c = 5; c <= 8; c++) ws2.getCell(s2Row, c).alignment = { horizontal: 'center' }
    s2Row++
  }
  const supplierDataEnd = s2Row - 1

  // Supplier total row
  for (let c = 1; c <= 8; c++) applyFill(ws2.getCell(s2Row, c), 'FFF5F5F5')
  ws2.getCell(s2Row, 1).value = 'Supplier total'
  ws2.getCell(s2Row, 1).font = { bold: true }
  ws2.getCell(s2Row, 2).value = { formula: `=SUM(B${supplierDataStart}:B${supplierDataEnd})` }
  ws2.getCell(s2Row, 2).numFmt = '£#,##0'
  ws2.getCell(s2Row, 3).value = { formula: `=SUM(C${supplierDataStart}:C${supplierDataEnd})` }
  ws2.getCell(s2Row, 3).numFmt = '£#,##0'
  ws2.getCell(s2Row, 4).value = '100%'
  for (let c = 5; c <= 8; c++) {
    const cl = String.fromCharCode(64 + c)
    ws2.getCell(s2Row, c).value = { formula: `=SUM(${cl}${supplierDataStart}:${cl}${supplierDataEnd})` }
  }
  for (let c = 1; c <= 8; c++) {
    ws2.getCell(s2Row, c).font = { bold: true }
    if (c >= 2) ws2.getCell(s2Row, c).alignment = { horizontal: c <= 3 ? 'right' : 'center' }
  }
  for (const c of [2, 3, 8]) {
    ws2.getCell(s2Row, c).border = { top: { style: 'thin', color: { argb: 'FF888888' } } }
  }
  s2Row++

  // Location sub-header
  for (let c = 1; c <= 8; c++) {
    applyFill(ws2.getCell(s2Row, c), 'FF5A5A5E')
    ws2.getCell(s2Row, c).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
  }
  ws2.getCell(s2Row, 1).value = 'LOCATION TOTALS'
  s2Row++

  const locMeta: { name: string; fill: string; font: string; col: number }[] = [
    { name: 'Onshore', fill: 'FFF0F4FF', font: 'FF1A2B5B', col: 5 },
    { name: 'Nearshore', fill: 'FFFFF8F0', font: 'FF7A4400', col: 6 },
    { name: 'Offshore', fill: 'FFF0FFF4', font: 'FF1B5E20', col: 7 },
  ]
  for (const loc of locMeta) {
    for (let c = 1; c <= 8; c++) {
      applyFill(ws2.getCell(s2Row, c), loc.fill)
      ws2.getCell(s2Row, c).font = { italic: true, color: { argb: loc.font } }
    }
    ws2.getCell(s2Row, 1).value = `↳ ${loc.name}`
    ws2.getCell(s2Row, 2).value = { formula: `=SUMIF(${sG},"${loc.name}",${sL})` }
    ws2.getCell(s2Row, 2).numFmt = '£#,##0'
    ws2.getCell(s2Row, 2).alignment = { horizontal: 'right' }
    ws2.getCell(s2Row, 3).value = { formula: `=SUMIF(${sG},"${loc.name}",${sM})` }
    ws2.getCell(s2Row, 3).numFmt = '£#,##0'
    ws2.getCell(s2Row, 3).alignment = { horizontal: 'right' }
    ws2.getCell(s2Row, 4).value = { formula: `=IF(C${supplierTotalRow}=0,0,C${s2Row}/C${supplierTotalRow})` }
    ws2.getCell(s2Row, 4).numFmt = '0.0%'
    ws2.getCell(s2Row, 4).alignment = { horizontal: 'center' }
    // Count only appears in this location's own column; the others show a dash
    for (const col of [5, 6, 7]) {
      ws2.getCell(s2Row, col).value =
        col === loc.col ? { formula: `=COUNTIF(${sG},"${loc.name}")` } : '—'
      ws2.getCell(s2Row, col).alignment = { horizontal: 'center' }
    }
    ws2.getCell(s2Row, 8).value = { formula: `=COUNTIF(${sG},"${loc.name}")` }
    ws2.getCell(s2Row, 8).font = { bold: true, italic: true, color: { argb: loc.font } }
    ws2.getCell(s2Row, 8).alignment = { horizontal: 'center' }
    s2Row++
  }

  // Blank separator
  ws2.getRow(s2Row).height = 6
  s2Row += 2

  /* ══ PLANVIEW CODE SPLIT ══ */
  sectionHeader('PLANVIEW CODE SPLIT')
  colHeaderRow(['Code', 'Base Cost', '+VAT Cost', 'Headcount'], { 2: 'right', 3: 'right', 4: 'center' })

  const planviewRows: { code: string; label: string; fill: string; font: string; zero?: boolean }[] = [
    { code: 'PR', label: 'PR  Platform Request — recoverable', fill: 'FFE8F5E9', font: 'FF1B5E20' },
    { code: 'F_Gov', label: 'F_Gov  Factory Governance — overhead', fill: 'FFE3F2FD', font: 'FF0D47A1' },
    { code: 'BAU', label: 'BAU  Business as Usual — not platform-borne', fill: 'FFF5F5F5', font: 'FF888888', zero: true },
  ]
  const sE = resRange('E') // planview column on Rate Calc
  for (const pv of planviewRows) {
    for (let c = 1; c <= 8; c++) {
      applyFill(ws2.getCell(s2Row, c), pv.fill)
      ws2.getCell(s2Row, c).font = { color: { argb: pv.font } }
    }
    ws2.getCell(s2Row, 1).value = squareRich(pv.font, pv.label, pv.font)
    if (pv.zero) {
      ws2.getCell(s2Row, 2).value = 0
      ws2.getCell(s2Row, 3).value = 0
    } else {
      ws2.getCell(s2Row, 2).value = { formula: `=SUMIF(${sE},"${pv.code}",${sL})` }
      ws2.getCell(s2Row, 3).value = { formula: `=SUMIF(${sE},"${pv.code}",${sM})` }
    }
    ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
    ws2.getCell(s2Row, 2).font = { bold: true, color: { argb: pv.font } }
    ws2.getCell(s2Row, 2).alignment = { horizontal: 'right' }
    ws2.getCell(s2Row, 3).numFmt = '£#,##0.00'
    ws2.getCell(s2Row, 3).font = { bold: true, color: { argb: pv.font } }
    ws2.getCell(s2Row, 3).alignment = { horizontal: 'right' }
    ws2.getCell(s2Row, 4).value = { formula: `=COUNTIF(${sE},"${pv.code}")` }
    ws2.getCell(s2Row, 4).font = { bold: true, color: { argb: pv.font } }
    ws2.getCell(s2Row, 4).alignment = { horizontal: 'center' }
    s2Row++
  }

  // Blank separator
  ws2.getRow(s2Row).height = 6
  s2Row += 2

  /* ══ BLENDED RATE SUMMARY ══ */
  sectionHeader('BLENDED RATE SUMMARY')
  colHeaderRow(['Component', 'Value'])

  // Resources + Ad-hoc (inc. VAT) — literal
  ws2.getCell(s2Row, 1).value = 'Resources + Ad-hoc (inc. VAT)'
  ws2.getCell(s2Row, 2).value = resourcesAdhocVat
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  s2Row++
  // ETP & Shared Services — literal
  ws2.getCell(s2Row, 1).value = 'ETP & Shared Services'
  ws2.getCell(s2Row, 2).value = etpSsTotal
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  s2Row++
  // Total row
  const blendedTotalRow = s2Row
  ws2.getCell(s2Row, 1).value = 'Total platform cost (inc. VAT)'
  ws2.getCell(s2Row, 1).font = { bold: true }
  ws2.getCell(s2Row, 2).value = { formula: `=B${s2Row - 2}+B${s2Row - 1}` }
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  ws2.getCell(s2Row, 2).font = { bold: true }
  for (const c of [1, 2]) {
    ws2.getCell(s2Row, c).border = { top: { style: 'thin', color: { argb: 'FF888888' } } }
  }
  s2Row++
  // X-Chargeable Days
  const xChargRow = s2Row
  ws2.getCell(s2Row, 1).value = 'X-Chargeable Days (PR allocations)'
  ws2.getCell(s2Row, 1).font = { color: { argb: 'FF777777' } }
  ws2.getCell(s2Row, 2).value = xChargeableDays
  ws2.getCell(s2Row, 2).font = { color: { argb: 'FF777777' } }
  s2Row++
  // Advised Rate
  const summaryAdvisedRateRow = s2Row
  for (let c = 1; c <= 8; c++) applyFill(ws2.getCell(s2Row, c), 'FFFFFDE7')
  ws2.getCell(s2Row, 1).value = 'Advised Rate'
  ws2.getCell(s2Row, 1).font = { bold: true, color: { argb: 'FF5A4000' } }
  ws2.getCell(s2Row, 1).border = { left: { style: 'medium', color: { argb: 'FFFDDA24' } } }
  ws2.getCell(s2Row, 2).value = { formula: `=IF(B${xChargRow}=0,0,B${blendedTotalRow}/B${xChargRow})` }
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  ws2.getCell(s2Row, 2).font = { bold: true, color: { argb: 'FF5A4000' } }
  ws2.getCell(s2Row, 3).value = 'Cost recovery rate based on current schedule decisions'
  ws2.getCell(s2Row, 3).font = { italic: true, color: { argb: 'FF999999' } }
  s2Row++
  // Current Rate
  const summaryCurrentRateRow = s2Row
  for (let c = 1; c <= 8; c++) applyFill(ws2.getCell(s2Row, c), 'FFE8F5E9')
  ws2.getCell(s2Row, 1).value = 'Current Rate'
  ws2.getCell(s2Row, 1).font = { bold: true, color: { argb: 'FF1B5E20' } }
  ws2.getCell(s2Row, 1).border = { left: { style: 'medium', color: { argb: 'FF66BB6A' } } }
  ws2.getCell(s2Row, 2).value = currentRate
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  ws2.getCell(s2Row, 2).font = { bold: true, color: { argb: 'FF1B5E20' } }
  ws2.getCell(s2Row, 3).value = 'Rate in effect as agreed with Finance and Platform Directors'
  ws2.getCell(s2Row, 3).font = { italic: true, color: { argb: 'FF999999' } }
  s2Row++
  // Shortfall
  const shortfallRowNum = s2Row
  for (let c = 1; c <= 8; c++) applyFill(ws2.getCell(s2Row, c), 'FFFEECEC')
  ws2.getCell(s2Row, 1).value = '▲ Shortfall'
  ws2.getCell(s2Row, 1).font = { bold: true, color: { argb: 'FF721C24' } }
  ws2.getCell(s2Row, 1).border = { left: { style: 'medium', color: { argb: 'FFE2001A' } } }
  ws2.getCell(s2Row, 2).value = { formula: `=B${summaryAdvisedRateRow}-B${summaryCurrentRateRow}` }
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  ws2.getCell(s2Row, 2).font = { bold: true, color: { argb: 'FF721C24' } }
  ws2.getCell(s2Row, 3).value = {
    formula: `="Under-recovery at current rate — "&TEXT(B${shortfallRowNum}*${xChargeableDays},"£#,##0")&" over the quarter"`,
  }
  ws2.getCell(s2Row, 3).font = { italic: true, color: { argb: 'FF721C24' } }
  s2Row += 2

  // Final empty row at the bottom of the sheet
  ws2.getCell(s2Row, 1).value = ''

  /* ── Conditional formatting: shortfall cell (five-tier symmetric) ── */
  const shortfallCf = [
    { operator: 'greaterThan', formulae: ['50'], priority: 1, fill: 'FFFDE8E8', font: 'FF8B0000' },
    { operator: 'greaterThan', formulae: ['20'], priority: 2, fill: 'FFFEF9C3', font: 'FF7A5A00' },
    { operator: 'between', formulae: ['-20', '20'], priority: 3, fill: 'FFE8F5E9', font: 'FF1B5E20' },
    { operator: 'lessThan', formulae: ['-20'], priority: 4, fill: 'FFFEF9C3', font: 'FF7A5A00' },
    { operator: 'lessThan', formulae: ['-50'], priority: 5, fill: 'FFFDE8E8', font: 'FF8B0000' },
  ] as const

  ws2.addConditionalFormatting({
    ref: `B${shortfallRowNum}`,
    rules: shortfallCf.map(({ operator, formulae, priority, fill, font }) => ({
      type: 'cellIs' as const,
      operator,
      formulae: [...formulae],
      priority,
      style: {
        fill: { type: 'pattern' as const, pattern: 'solid' as const, bgColor: { argb: fill } },
        font: { color: { argb: font } },
      },
    })),
  })

  /* ══════════════════════════════════════════════════════════════════
     Raw Data tab — flat, calculated values for copy/paste & pivots
  ══════════════════════════════════════════════════════════════════ */
  const rawHeader = ws3.addRow([
    'Role', 'Resource', 'PO', 'Team', 'Planview',
    'Organisation', 'Location', 'Utilisation', 'Days', 'Day Rate',
    'Chargeable', 'Total', '+VAT',
  ])
  rawHeader.font = { bold: true, color: { argb: 'FF2A2A2D' }, size: 10 }
  setRowFill(ws3, rawHeader.number, 'FFF2F2F2', NUM_COLS)
  ws3.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 13 } }

  for (const alloc of allocations) {
    const total =
      (alloc.utilisation_percent / 100) * (alloc.capacity_days ?? 0) * (alloc.day_rate / 100)
    const vatInclusive = alloc.vat_applies ? total * vatMultiplier : total
    const r = ws3.addRow([
      alloc.role_title ?? '',
      alloc.resource_name,
      'WEB',
      alloc.team_name,
      alloc.planview_code ?? '',
      alloc.supplier_name ?? '',
      capitalise(alloc.resource_location),
      alloc.utilisation_percent / 100,
      alloc.capacity_days ?? 0,
      alloc.day_rate / 100,
      alloc.planview_code === 'PR' ? 'Yes' : 'No',
      total,
      vatInclusive,
    ])
    r.getCell(8).numFmt = '0%'
    r.getCell(10).numFmt = '£#,##0.00'
    r.getCell(12).numFmt = '£#,##0.00'
    r.getCell(13).numFmt = '£#,##0.00'
  }

  for (const item of costItems) {
    const amount = item.amount_pence / 100
    const r = ws3.addRow([
      item.label, '', '', '',
      item.cost_item_category,
      '', '', '', '', '', '',
      amount,
      amount,
    ])
    r.getCell(12).numFmt = '£#,##0.00'
    r.getCell(13).numFmt = '£#,##0.00'
  }

  /* ── Config section (plain, mirrors the original Finance spreadsheet) ── */
  const rawLastDataRow = ws3.rowCount
  const rawSubtotalRow = rawLastDataRow + 3 // two blank rows then SUBTOTAL

  ws3.getCell(rawSubtotalRow, 1).value = 'SUBTOTAL'
  ws3.getCell(rawSubtotalRow, 1).font = { bold: true }
  ws3.getCell(rawSubtotalRow, 12).value = { formula: `=SUBTOTAL(9,L1:L${rawLastDataRow})` }
  ws3.getCell(rawSubtotalRow, 12).numFmt = '£#,##0.00'
  ws3.getCell(rawSubtotalRow, 13).value = { formula: `=SUBTOTAL(9,M1:M${rawLastDataRow})` }
  ws3.getCell(rawSubtotalRow, 13).numFmt = '£#,##0.00'

  const rawVatRow = rawSubtotalRow + 2
  ws3.getCell(rawVatRow, 1).value = 'VAT Multiplier'
  ws3.getCell(rawVatRow, 9).value = vatMultiplier
  ws3.getCell(rawVatRow, 9).numFmt = '0.00000'

  const rawBillableRow = rawSubtotalRow + 3
  ws3.getCell(rawBillableRow, 1).value = 'Total Billable Days'
  ws3.getCell(rawBillableRow, 9).value = { formula: `=SUMIF(K1:K${rawLastDataRow},"Yes",I1:I${rawLastDataRow})` }

  const rawUtilRow = rawSubtotalRow + 4
  ws3.getCell(rawUtilRow, 1).value = 'Utilisation'
  ws3.getCell(rawUtilRow, 9).value = 1

  const rawXChargRow = rawSubtotalRow + 5
  ws3.getCell(rawXChargRow, 1).value = 'X-Chargeable Days'
  ws3.getCell(rawXChargRow, 9).value = { formula: `=I${rawBillableRow}*I${rawUtilRow}` }

  const rawAdvisedRow = rawSubtotalRow + 6
  ws3.getCell(rawAdvisedRow, 1).value = 'Advised Rate'
  ws3.getCell(rawAdvisedRow, 1).font = { bold: true }
  ws3.getCell(rawAdvisedRow, 9).value = { formula: `=M${rawSubtotalRow}/I${rawXChargRow}` }
  ws3.getCell(rawAdvisedRow, 9).numFmt = '£#,##0.00'

  const rawCurrentRow = rawSubtotalRow + 7
  ws3.getCell(rawCurrentRow, 1).value = 'Current Rate'
  ws3.getCell(rawCurrentRow, 1).font = { bold: true }
  ws3.getCell(rawCurrentRow, 9).value =
    blendedDayRateOverridePence !== null ? blendedDayRateOverridePence / 100 : 0
  ws3.getCell(rawCurrentRow, 9).numFmt = '£#,##0.00'

  /* ── Serialise to buffer ── */
  const buffer = await wb.xlsx.writeBuffer()

  const filename = deriveFilename(period.period_name, stamp)

  return new Response(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
