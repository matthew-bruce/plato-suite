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

  /* ── Timestamp (single instance shared by filename and hero row) ── */
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const exportedAt = `Exported ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} at ${pad(now.getHours())}:${pad(now.getMinutes())}`

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

  // Raw Data tab — created third so tab order is Summary → Rate Calculator → Raw Data.
  const ws3 = wb.addWorksheet(sanitiseSheetName('Raw Data'))
  ws3.columns = [
    { width: 30 }, { width: 25 }, { width: 14 }, { width: 20 }, { width: 10 },
    { width: 25 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 12 },
    { width: 11 }, { width: 14 }, { width: 14 },
  ]

  const HEADER_ARGB = 'FF404044'
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

  const planviewStyles: Record<string, { bg: string; fg: string }> = {
    PR: { bg: 'FFE8F5E9', fg: 'FF1B5E20' },
    F_Gov: { bg: 'FFE3F2FD', fg: 'FF0D47A1' },
    BAU: { bg: 'FFF0F0F0', fg: 'FF888888' },
  }

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

      /* ── Row background: vacant > BAU > supplier tint ── */
      const isBau = alloc.planview_code === 'BAU'
      const isVacant = !alloc.resource_id

      let rowArgb: string
      if (isVacant) {
        rowArgb = 'FFFEF9E7'
      } else if (isBau) {
        rowArgb = 'FFF5F5F5'
      } else {
        rowArgb = supplierTint(alloc.supplier_colour ?? '#888888')
      }
      setRowFill(ws, rowNum, rowArgb, NUM_COLS)

      /* ── Column E — planview badge ── */
      const ps = planviewStyles[alloc.planview_code ?? '']
      if (ps) {
        const planviewCell = ws.getCell(`E${rowNum}`)
        applyFill(planviewCell, ps.bg)
        planviewCell.font = { bold: true, color: { argb: ps.fg }, size: 10 }
      }

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

      /* ── BAU rows — L/M not platform-borne, shown as em dash ── */
      if (isBau) {
        ws.getCell(`L${rowNum}`).value = '—'
        ws.getCell(`M${rowNum}`).value = '—'
        ws.getCell(`L${rowNum}`).font = { color: { argb: 'FFBBBBBB' }, size: 10 }
        ws.getCell(`M${rowNum}`).font = { color: { argb: 'FFBBBBBB' }, size: 10 }
      }

      if (alloc.vat_applies && !isBau) vatRows.push(rowNum)
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
     Tab 2 (created first for tab order): write the Summary content
  ══════════════════════════════════════════════════════════════════ */
  const ref = `'${tabName}'` // cross-sheet reference prefix

  let s2Row = 1

  // Hero band
  for (let c = 1; c <= 5; c++) applyFill(ws2.getCell(s2Row, c), HEADER_ARGB)
  ws2.getCell(s2Row, 1).value = period.period_name
  ws2.getCell(s2Row, 1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 }
  s2Row++
  for (let c = 1; c <= 5; c++) applyFill(ws2.getCell(s2Row, c), HEADER_ARGB)
  ws2.getCell(s2Row, 1).value = 'WEB PLATFORM — COST SCHEDULE'
  ws2.getCell(s2Row, 1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
  s2Row++
  // Exported-at row — dark background, grey italic timestamp
  for (let c = 1; c <= 5; c++) applyFill(ws2.getCell(s2Row, c), 'FF2A2A2D')
  ws2.getCell(s2Row, 1).value = exportedAt
  ws2.getCell(s2Row, 1).font = { italic: true, color: { argb: 'FF8F9495' }, size: 10 }
  s2Row += 2

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

  // ETP is a cost_item_category, not a planview code — excluded here.
  const planviewMeta: Record<string, { label: string; fill: string; font: string }> = {
    PR: { label: 'PR  —  Platform Request · recoverable', fill: 'FFE8F5E9', font: 'FF1B5E20' },
    F_Gov: { label: 'F_GOV  —  Factory Governance · overhead', fill: 'FFE3F2FD', font: 'FF0D47A1' },
    BAU: { label: 'BAU  —  Business as Usual · not platform-borne', fill: 'FFF5F5F5', font: 'FF888888' },
  }
  for (const code of ['PR', 'F_Gov', 'BAU'] as const) {
    const meta = planviewMeta[code]
    for (let c = 1; c <= 4; c++) applyFill(ws2.getCell(s2Row, c), meta.fill)
    ws2.getCell(s2Row, 1).value = meta.label
    ws2.getCell(s2Row, 1).font = { bold: true, color: { argb: meta.font } }
    ws2.getCell(s2Row, 2).value = {
      formula: `=SUMIF(${ref}!E${FIRST_DATA_ROW}:E${lastResourceRow},"${code}",${ref}!L${FIRST_DATA_ROW}:L${lastResourceRow})`,
    }
    ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
    ws2.getCell(s2Row, 2).font = { bold: true, color: { argb: meta.font } }
    ws2.getCell(s2Row, 3).value = {
      formula: `=SUMIF(${ref}!E${FIRST_DATA_ROW}:E${lastResourceRow},"${code}",${ref}!M${FIRST_DATA_ROW}:M${lastResourceRow})`,
    }
    ws2.getCell(s2Row, 3).numFmt = '£#,##0.00'
    ws2.getCell(s2Row, 3).font = { bold: true, color: { argb: meta.font } }
    ws2.getCell(s2Row, 4).value = {
      formula: `=COUNTIF(${ref}!E${FIRST_DATA_ROW}:E${lastResourceRow},"${code}")`,
    }
    ws2.getCell(s2Row, 4).font = { color: { argb: meta.font } }
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
  const summaryAdvisedRow = s2Row
  ws2.getCell(s2Row, 1).value = 'Advised Rate (incl. ETP & SS)'
  ws2.getCell(s2Row, 2).value = {
    formula: `=IF('${tabName}'!I${xChargeableRowNum}=0,0,'${tabName}'!M${subtotalRowNum}/'${tabName}'!I${xChargeableRowNum})`,
  }
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  // Yellow accent.
  for (let c = 1; c <= 3; c++) applyFill(ws2.getCell(s2Row, c), 'FFFFFDE7')
  ws2.getCell(s2Row, 1).font = { bold: true, color: { argb: 'FF5A4000' }, size: 10 }
  ws2.getCell(s2Row, 1).border = { left: { style: 'medium', color: { argb: 'FFFDDA24' } } }
  ws2.getCell(s2Row, 2).font = { bold: true, color: { argb: 'FF5A4000' }, size: 10 }
  s2Row++

  // Current Rate — the rate agreed with Finance, read from the DB override.
  const summaryCurrentRow = s2Row
  ws2.getCell(s2Row, 1).value = 'Current Rate'
  ws2.getCell(s2Row, 2).value =
    blendedDayRateOverridePence !== null ? blendedDayRateOverridePence / 100 : 0
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  ws2.getCell(s2Row, 3).value = '(agreed with Finance)'
  ws2.getCell(s2Row, 3).font = { italic: true, color: { argb: LABEL_ARGB } }
  // Green accent.
  for (let c = 1; c <= 2; c++) applyFill(ws2.getCell(s2Row, c), 'FFE8F5E9')
  ws2.getCell(s2Row, 1).font = { bold: true, color: { argb: 'FF1B5E20' }, size: 10 }
  ws2.getCell(s2Row, 1).border = { left: { style: 'medium', color: { argb: 'FF66BB6A' } } }
  ws2.getCell(s2Row, 2).font = { bold: true, color: { argb: 'FF1B5E20' }, size: 10 }
  s2Row++

  // Shortfall — per-day under-recovery and the quarterly figure at the current rate.
  const shortfallRowNum = s2Row
  ws2.getCell(s2Row, 1).value = '▲ Shortfall'
  ws2.getCell(s2Row, 2).value = { formula: `=B${summaryAdvisedRow}-B${summaryCurrentRow}` }
  ws2.getCell(s2Row, 2).numFmt = '£#,##0.00'
  ws2.getCell(s2Row, 3).value = {
    formula: `="Under-recovery at current rate — "&TEXT((B${summaryAdvisedRow}-B${summaryCurrentRow})*'${tabName}'!I${xChargeableRowNum},"£#,##0")&" over the quarter"`,
  }
  // Static fill removed — conditional formatting owns the shortfall cell colour.
  ws2.getCell(s2Row, 1).font = { bold: true, color: { argb: 'FF721C24' }, size: 10 }
  ws2.getCell(s2Row, 1).border = { left: { style: 'medium', color: { argb: 'FFE2001A' } } }
  ws2.getCell(s2Row, 2).font = { bold: true, color: { argb: 'FF721C24' }, size: 10 }
  ws2.getCell(s2Row, 3).font = { italic: true, color: { argb: 'FF721C24' } }
  s2Row += 2

  /* ══════════════════════════════════════════════════════════════════
     Resource location breakdown
  ══════════════════════════════════════════════════════════════════ */
  const tab1 = `'${tabName}'`
  const locRange = `${tab1}!G${FIRST_DATA_ROW}:G${lastResourceRow}`

  writeSectionHeader(ws2, s2Row, 'RESOURCE LOCATION BREAKDOWN', 5)
  s2Row++

  const locHeaderRow = ws2.getRow(s2Row)
  ;['Location', 'Resources', '% of Total', 'Base Cost', '+VAT Cost'].forEach((h, i) => {
    const cell = locHeaderRow.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true, size: 10 }
    applyFill(cell, 'FFF5F5F5')
  })
  s2Row++

  const locations: { name: string; fill: string }[] = [
    { name: 'Onshore', fill: 'FFF0F4FF' },
    { name: 'Nearshore', fill: 'FFFFF8F0' },
    { name: 'Offshore', fill: 'FFF0FFF4' },
  ]
  const locDataStart = s2Row
  for (const loc of locations) {
    for (let c = 1; c <= 5; c++) applyFill(ws2.getCell(s2Row, c), loc.fill)
    ws2.getCell(s2Row, 1).value = loc.name
    ws2.getCell(s2Row, 2).value = { formula: `=COUNTIF(${locRange},"${loc.name}")` }
    ws2.getCell(s2Row, 2).alignment = { horizontal: 'center' }
    ws2.getCell(s2Row, 3).value = {
      formula: `=IF(COUNTA(${locRange})=0,0,COUNTIF(${locRange},"${loc.name}")/COUNTA(${locRange}))`,
    }
    ws2.getCell(s2Row, 3).numFmt = '0.0%'
    ws2.getCell(s2Row, 3).alignment = { horizontal: 'center' }
    ws2.getCell(s2Row, 4).value = {
      formula: `=SUMIF(${locRange},"${loc.name}",${tab1}!L${FIRST_DATA_ROW}:L${lastResourceRow})`,
    }
    ws2.getCell(s2Row, 4).numFmt = '£#,##0'
    ws2.getCell(s2Row, 4).alignment = { horizontal: 'right' }
    ws2.getCell(s2Row, 5).value = {
      formula: `=SUMIF(${locRange},"${loc.name}",${tab1}!M${FIRST_DATA_ROW}:M${lastResourceRow})`,
    }
    ws2.getCell(s2Row, 5).numFmt = '£#,##0'
    ws2.getCell(s2Row, 5).alignment = { horizontal: 'right' }
    s2Row++
  }
  const locDataEnd = s2Row - 1

  // Location total row
  for (let c = 1; c <= 5; c++) applyFill(ws2.getCell(s2Row, c), 'FFF5F5F5')
  ws2.getCell(s2Row, 1).value = 'Total'
  ws2.getCell(s2Row, 1).font = { bold: true }
  ws2.getCell(s2Row, 2).value = { formula: `=SUM(B${locDataStart}:B${locDataEnd})` }
  ws2.getCell(s2Row, 2).font = { bold: true }
  ws2.getCell(s2Row, 2).alignment = { horizontal: 'center' }
  ws2.getCell(s2Row, 4).value = { formula: `=SUM(D${locDataStart}:D${locDataEnd})` }
  ws2.getCell(s2Row, 4).numFmt = '£#,##0'
  ws2.getCell(s2Row, 4).font = { bold: true }
  ws2.getCell(s2Row, 4).alignment = { horizontal: 'right' }
  ws2.getCell(s2Row, 5).value = { formula: `=SUM(E${locDataStart}:E${locDataEnd})` }
  ws2.getCell(s2Row, 5).numFmt = '£#,##0'
  ws2.getCell(s2Row, 5).font = { bold: true }
  ws2.getCell(s2Row, 5).alignment = { horizontal: 'right' }
  s2Row += 2

  /* ── Supplier × location cross-table ── */
  writeSectionHeader(ws2, s2Row, 'BY SUPPLIER', 5)
  s2Row++

  const xHeaderRow = ws2.getRow(s2Row)
  ;['Supplier', 'Onshore', 'Nearshore', 'Offshore', 'Total'].forEach((h, i) => {
    const cell = xHeaderRow.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true, size: 10 }
    applyFill(cell, 'FFF5F5F5')
  })
  s2Row++

  // Suppliers in sort_order, carrying their tint colour.
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

  const sRange = `${tab1}!F${FIRST_DATA_ROW}:F${lastResourceRow}`
  const lRange = `${tab1}!G${FIRST_DATA_ROW}:G${lastResourceRow}`
  const xDataStart = s2Row
  for (const supplierName of orderedSuppliers) {
    const tint = supplierTint(supplierColourMap.get(supplierName) ?? '#888888')
    for (let c = 1; c <= 5; c++) applyFill(ws2.getCell(s2Row, c), tint)
    ws2.getCell(s2Row, 1).value = supplierName
    ws2.getCell(s2Row, 2).value = {
      formula: `=COUNTIFS(${sRange},"${supplierName}",${lRange},"Onshore")`,
    }
    ws2.getCell(s2Row, 3).value = {
      formula: `=COUNTIFS(${sRange},"${supplierName}",${lRange},"Nearshore")`,
    }
    ws2.getCell(s2Row, 4).value = {
      formula: `=COUNTIFS(${sRange},"${supplierName}",${lRange},"Offshore")`,
    }
    ws2.getCell(s2Row, 5).value = { formula: `=SUM(B${s2Row}:D${s2Row})` }
    for (let c = 2; c <= 5; c++) ws2.getCell(s2Row, c).alignment = { horizontal: 'center' }
    s2Row++
  }
  const xDataEnd = s2Row - 1

  // Cross-table total row
  for (let c = 1; c <= 5; c++) applyFill(ws2.getCell(s2Row, c), 'FFF5F5F5')
  ws2.getCell(s2Row, 1).value = 'Total'
  ws2.getCell(s2Row, 1).font = { bold: true }
  for (let c = 2; c <= 5; c++) {
    const colLetter = String.fromCharCode(64 + c)
    ws2.getCell(s2Row, c).value = { formula: `=SUM(${colLetter}${xDataStart}:${colLetter}${xDataEnd})` }
    ws2.getCell(s2Row, c).font = { bold: true }
    ws2.getCell(s2Row, c).alignment = { horizontal: 'center' }
  }

  /* ── Conditional formatting: shortfall cell on Summary tab ── */
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
