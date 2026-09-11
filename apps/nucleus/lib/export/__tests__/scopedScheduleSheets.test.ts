import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { buildTeamScheduleSheet, teamScheduleColumns, columnLetter } from '../teamScheduleSheet'
import { buildSupplierScheduleSheet, SUPPLIER_SCHEDULE_COLUMNS } from '../supplierScheduleSheet'
import { buildSampleExportWorkbook, SCOPED_SHEET_FIXTURE } from './exportFormulaSample'
import {
  NOT_APPLICABLE,
  commercialBasePence,
  proratedDays,
  totalFte,
} from '../scheduleVariantRows'
import type { VariantAllocationRow } from '../scheduleVariantRows'
import type { CostVisibility } from '../exportVariants'

const VAT = 1.07082
const BLENDED = 60_500

const PLUTO_ROWS = SCOPED_SHEET_FIXTURE.filter((r) =>
  r.teams.some((t) => t.teamId === 't-pluto'),
)
const CAPGEMINI_ROWS = SCOPED_SHEET_FIXTURE.filter((r) => r.supplier_name === 'Capgemini')

function buildTeamSheet(costVisibility: CostVisibility = 'both') {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Pluto')
  const result = buildTeamScheduleSheet({
    ws,
    rows: PLUTO_ROWS,
    teamName: 'Pluto',
    teamScope: 't-pluto',
    periodName: 'Q3 FY 26/27',
    dateRange: '01 Oct 2026 – 31 Dec 2026',
    exportedAt: 'Exported 10 Sep 2026 at 09:00',
    vatMultiplier: VAT,
    blendedDayRatePence: BLENDED,
    costVisibility,
  })
  return { ws, result, columns: teamScheduleColumns(costVisibility) }
}

function buildSupplierSheet() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Capgemini')
  const result = buildSupplierScheduleSheet({
    ws,
    rows: CAPGEMINI_ROWS,
    supplierName: 'Capgemini',
    periodName: 'Q3 FY 26/27',
    dateRange: '01 Oct 2026 – 31 Dec 2026',
    exportedAt: 'Exported 10 Sep 2026 at 09:00',
    vatMultiplier: VAT,
  })
  return { ws, result }
}

/** The cell in a built sheet for a given allocation and column key. */
function cellFor(
  ws: ExcelJS.Worksheet,
  columns: readonly { key: string }[],
  firstDataRow: number,
  rows: readonly { allocation_id: string }[],
  allocationId: string,
  key: string,
): ExcelJS.Cell {
  const rowOffset = rows.findIndex((r) => r.allocation_id === allocationId)
  const colIndex = columns.findIndex((c) => c.key === key) + 1
  return ws.getCell(firstDataRow + rowOffset, colIndex)
}

describe('Team Schedule sheet', () => {
  it('writes one row per allocation record, not per person', () => {
    const { result } = buildTeamSheet()
    const rowCount = result.lastDataRow - result.firstDataRow + 1
    expect(rowCount).toBe(PLUTO_ROWS.length)
    // A. Patel holds two of them.
    const patelRows = PLUTO_ROWS.filter((r) => r.resource_id === 'person-1')
    expect(patelRows).toHaveLength(2)
  })

  it('leads with the team name, not the quarter', () => {
    const { ws } = buildTeamSheet()
    expect(ws.getCell(1, 1).value).toBe('TEAM SCHEDULE')
    expect(ws.getCell(2, 1).value).toBe('Pluto')
    // The quarter is present, but as secondary information to the right.
    expect(ws.getCell(2, 1).font?.size).toBeGreaterThan(16)
  })

  it('states no single working-days figure anywhere in the header', () => {
    // Working days vary by resource location, so any one number would be
    // wrong for part of the file.
    const { ws } = buildTeamSheet()
    for (let row = 1; row <= 5; row++) {
      for (let col = 1; col <= 20; col++) {
        const value = ws.getCell(row, col).value
        if (typeof value === 'string') {
          expect(value.toLowerCase()).not.toContain('working day')
        }
      }
    }
  })

  it('states the cross-charge rate once, in the stats line', () => {
    const { ws } = buildTeamSheet()
    const stats = String(ws.getCell(3, 1).value)
    expect(stats).toContain('£605/day, Current Rate')
    expect(stats).toContain('All costs include VAT')
    expect(stats).toContain('included in platform cost')
  })

  it('gives a PR row a cross-charge figure and an F_Gov row an em dash', () => {
    const { ws, result, columns } = buildTeamSheet()
    const at = (id: string, key: string) =>
      cellFor(ws, columns, result.firstDataRow, PLUTO_ROWS, id, key)

    // a-pr is 64 raw days at a 50% Pluto share, so Pluto is recharged for 32.
    expect(at('a-pr', 'xcQuarter').value).toBe((BLENDED * 32) / 100)
    expect(at('a-fgov', 'xcQuarter').value).toBe(NOT_APPLICABLE)
    expect(at('a-bau', 'xcQuarter').value).toBe(NOT_APPLICABLE)
    expect(at('a-npc', 'xcQuarter').value).toBe(NOT_APPLICABLE)
  })

  it('still prices F_Gov commercially — its cost is real, only not recharged', () => {
    const { ws, result, columns } = buildTeamSheet()
    const commercial = cellFor(ws, columns, result.firstDataRow, PLUTO_ROWS, 'a-fgov', 'commQuarter')
    expect(typeof commercial.value).toBe('number')
    expect(commercial.value as number).toBeGreaterThan(0)
  })

  it('withholds an NPC row’s commercial figure and its day rate', () => {
    const { ws, result, columns } = buildTeamSheet()
    const at = (key: string) =>
      cellFor(ws, columns, result.firstDataRow, PLUTO_ROWS, 'a-npc', key)
    expect(at('commQuarter').value).toBe(NOT_APPLICABLE)
    expect(at('dayRate').value).toBe(NOT_APPLICABLE)
  })

  it('prints the team split the way the live page’s badges read', () => {
    const { ws, result, columns } = buildTeamSheet()
    expect(
      cellFor(ws, columns, result.firstDataRow, PLUTO_ROWS, 'a-pr', 'teamSplit').value,
    ).toBe('Pluto 50%, Cygnus 50%')
    // A single team at full allocation carries no information worth printing.
    expect(
      cellFor(ws, columns, result.firstDataRow, PLUTO_ROWS, 'a-fgov', 'teamSplit').value,
    ).toBe('')
  })

  it('shows the supplier short code on the supplier’s own brand colour', () => {
    const { ws, result, columns } = buildTeamSheet()
    const chip = cellFor(ws, columns, result.firstDataRow, PLUTO_ROWS, 'a-pr', 'supplier')
    expect(chip.value).toBe('CG')
    // Text is the brand hex itself; the ground is its pale tint.
    expect(chip.font?.color?.argb).toBe('FF003C82')
    const fill = chip.fill as ExcelJS.FillPattern
    expect(fill.fgColor?.argb).toMatch(/^FF[0-9A-F]{6}$/)
    expect(fill.fgColor?.argb).not.toBe('FF003C82')
  })

  it('totals the cost columns but never the day rate column', () => {
    const { ws, result, columns } = buildTeamSheet()
    const dayRateCol = columns.findIndex((c) => c.key === 'dayRate') + 1
    expect(ws.getCell(result.totalRow, dayRateCol).value).toBe(NOT_APPLICABLE)

    for (const key of ['commSprint', 'commQuarter', 'xcSprint', 'xcQuarter']) {
      const col = columns.findIndex((c) => c.key === key) + 1
      const value = ws.getCell(result.totalRow, col).value
      expect(value).toHaveProperty('formula')
      const letter = columnLetter(col)
      expect((value as { formula: string }).formula).toBe(
        `SUM(${letter}${result.firstDataRow}:${letter}${result.lastDataRow})`,
      )
    }
  })

  it('carries the F_Gov / NPC footnote', () => {
    const { ws } = buildTeamSheet()
    let found = false
    ws.eachRow((r) => {
      r.eachCell((c) => {
        if (typeof c.value === 'string' && c.value.includes('are not cross-charged')) found = true
      })
    })
    expect(found).toBe(true)
  })

  it('reports team size in people and FTE, collapsing the transition to one', () => {
    const { ws } = buildTeamSheet()
    const text: string[] = []
    ws.eachRow((r) => {
      r.eachCell((c) => {
        if (typeof c.value === 'string') text.push(c.value)
      })
    })
    // person-1 (twice), person-2, person-3, person-4 → 4 people.
    expect(text).toContain('Team size: 4 named people')
    // 100 + 100 capped at 100 for person-1, + 80 + 50 + 100 → 3.3
    expect(text).toContain('Total FTE: 3.3')
  })

  it('drops both cost groups’ columns when only internal is asked for', () => {
    const internal = teamScheduleColumns('internal').map((c) => c.key)
    expect(internal).not.toContain('commQuarter')
    expect(internal).not.toContain('dayRate')
    expect(internal).toContain('xcQuarter')

    const commercial = teamScheduleColumns('commercial').map((c) => c.key)
    expect(commercial).toContain('dayRate')
    expect(commercial).not.toContain('xcQuarter')
  })
})

describe('Supplier Schedule sheet', () => {
  it('leads with the supplier name under a SUPPLIER SCHEDULE eyebrow', () => {
    const { ws } = buildSupplierSheet()
    expect(ws.getCell(1, 1).value).toBe('SUPPLIER SCHEDULE')
    expect(ws.getCell(2, 1).value).toBe('Capgemini')
  })

  it('says commercial cost only in its stats line', () => {
    const { ws } = buildSupplierSheet()
    const stats = String(ws.getCell(3, 1).value)
    expect(stats).toContain('Commercial cost only')
    expect(stats).toContain('named resources across the platform')
    expect(stats).toContain('All costs include VAT')
  })

  it('prices the NPC resource for real — the divergence from Team Schedule', () => {
    const { ws, result } = buildSupplierSheet()
    const quarter = cellFor(
      ws,
      SUPPLIER_SCHEDULE_COLUMNS,
      result.firstDataRow,
      CAPGEMINI_ROWS,
      'a-npc',
      'quarter',
    )
    expect(typeof quarter.value).toBe('number')
    expect(quarter.value as number).toBeGreaterThan(0)
  })

  // The same fixture row, rendered by both sheets, on purpose disagreeing.
  it('disagrees with the Team Schedule about that exact row', () => {
    const supplier = buildSupplierSheet()
    const team = buildTeamSheet()

    const onSupplier = cellFor(
      supplier.ws,
      SUPPLIER_SCHEDULE_COLUMNS,
      supplier.result.firstDataRow,
      CAPGEMINI_ROWS,
      'a-npc',
      'quarter',
    ).value
    const onTeam = cellFor(
      team.ws,
      team.columns,
      team.result.firstDataRow,
      PLUTO_ROWS,
      'a-npc',
      'commQuarter',
    ).value

    expect(onTeam).toBe(NOT_APPLICABLE)
    expect(typeof onSupplier).toBe('number')
  })

  it('carries no cross-charge column at all', () => {
    const keys = SUPPLIER_SCHEDULE_COLUMNS.map((c) => c.key)
    expect(keys).not.toContain('xcQuarter')
    expect(keys).toContain('quarter')
    // Team is a column here precisely because this file spans teams.
    expect(keys).toContain('team')
  })

  it('reports people, FTE and the number of teams covered', () => {
    const { ws } = buildSupplierSheet()
    const text: string[] = []
    ws.eachRow((r) => {
      r.eachCell((c) => {
        if (typeof c.value === 'string') text.push(c.value)
      })
    })
    expect(text.some((t) => t.startsWith('Supplier size:'))).toBe(true)
    expect(text.some((t) => t.startsWith('Total FTE:'))).toBe(true)
    expect(text.some((t) => t.startsWith('Teams covered:'))).toBe(true)
  })
})

/* ══════════════════════════════════════════════════════════════════════
   Proration to the scoped team.

   An export has to present a figure the way the live app presents it. The
   Schedule page, filtered to one team, shows a split resource's PROPORTIONAL
   days and cost and says so in the label. A team-scoped export that showed
   the full period instead would credit the team with a whole person it only
   half has — and, being a spreadsheet, would be the version believed.

   The fixture is real: Paul Williams, 64 raw period days, 50% Cygnus / 50%
   Pluto, 90% utilisation, £580/day. Cygnus's view shows 32.0 days and
   £16,704 base (580 × 32 × 0.9), not 64 days and £33,408.
══════════════════════════════════════════════════════════════════════ */

const PAUL_WILLIAMS: VariantAllocationRow = {
  allocation_id: 'paul-williams',
  resource_id: 'paul',
  resource_name: 'Paul Williams',
  role_title: 'Engineer',
  planview_code: 'PR',
  supplier_name: 'Capgemini',
  supplier_abbreviation: 'CG',
  supplier_colour: '#003C82',
  resource_location: 'onshore',
  utilisation_percent: 90,
  capacity_days: 64,
  day_rate: 58_000,
  vat_applies: true,
  teams: [
    { teamId: 't-cygnus', teamName: 'Cygnus', capacitySplit: 0.5 },
    { teamId: 't-pluto', teamName: 'Pluto', capacitySplit: 0.5 },
  ],
}

/** Same shape, but wholly on Cygnus — the control for the unsplit case. */
const UNSPLIT_RESOURCE: VariantAllocationRow = {
  ...PAUL_WILLIAMS,
  allocation_id: 'unsplit',
  resource_id: 'unsplit-person',
  resource_name: 'S. Whole',
  utilisation_percent: 100,
  teams: [{ teamId: 't-cygnus', teamName: 'Cygnus', capacitySplit: 1 }],
}

function buildCygnusSheet(rows: VariantAllocationRow[]) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Cygnus')
  const result = buildTeamScheduleSheet({
    ws,
    rows,
    teamName: 'Cygnus',
    teamScope: 't-cygnus',
    periodName: 'Q3 FY 26/27',
    dateRange: '01 Oct 2026 – 31 Dec 2026',
    exportedAt: 'Exported 10 Sep 2026 at 09:00',
    vatMultiplier: VAT,
    blendedDayRatePence: BLENDED,
    costVisibility: 'both',
  })
  return { ws, result, columns: teamScheduleColumns('both'), rows }
}

describe('Team Schedule prorates a split resource to the scoped team', () => {
  it('shows 32.0 Total days for Paul Williams on Cygnus, not his full 64', () => {
    const { ws, result, columns, rows } = buildCygnusSheet([PAUL_WILLIAMS])
    const days = cellFor(ws, columns, result.firstDataRow, rows, 'paul-williams', 'days')
    expect(days.value).toBe(32)
    // The raw record is untouched — proration is a presentation of it.
    expect(PAUL_WILLIAMS.capacity_days).toBe(64)
  })

  it('produces a Quarter commercial figure of 580 × 32 × 0.9, not × 64', () => {
    const base = commercialBasePence(PAUL_WILLIAMS, proratedDays(PAUL_WILLIAMS, 't-cygnus'))
    // £16,704 — exactly what the Cygnus-filtered Schedule page shows.
    expect(base).toBe(58_000 * 32 * 0.9)
    expect(base).toBe(1_670_400)

    const { ws, result, columns, rows } = buildCygnusSheet([PAUL_WILLIAMS])
    const quarter = cellFor(ws, columns, result.firstDataRow, rows, 'paul-williams', 'commQuarter')
    // The sheet shows it VAT-inclusive, as its own stats line promises.
    expect(quarter.value).toBe(Math.round(base * VAT) / 100)
  })

  it('prorates the cross-charge quarter on the same basis', () => {
    const { ws, result, columns, rows } = buildCygnusSheet([PAUL_WILLIAMS])
    const xc = cellFor(ws, columns, result.firstDataRow, rows, 'paul-williams', 'xcQuarter')
    expect(xc.value).toBe(Math.round(BLENDED * 32 * 0.9) / 100)
  })

  it('prorates the sprint and month conventions too — half a person, half a sprint', () => {
    const { ws, result, columns, rows } = buildCygnusSheet([PAUL_WILLIAMS])
    const at = (key: string) =>
      cellFor(ws, columns, result.firstDataRow, rows, 'paul-williams', key).value
    expect(at('commSprint')).toBe(Math.round(58_000 * 10 * 0.5 * 0.9 * VAT) / 100)
    expect(at('commMonth')).toBe(Math.round(58_000 * 21 * 0.5 * 0.9 * VAT) / 100)
  })

  it('leaves the day rate alone — it is a rate, not a quantity', () => {
    const { ws, result, columns, rows } = buildCygnusSheet([PAUL_WILLIAMS])
    const rate = cellFor(ws, columns, result.firstDataRow, rows, 'paul-williams', 'dayRate')
    expect(rate.value).toBe(580)
  })

  it('counts him as 0.45 FTE to Cygnus, not 0.9', () => {
    expect(totalFte([PAUL_WILLIAMS], 't-cygnus')).toBeCloseTo(0.45, 10)
    const { ws } = buildCygnusSheet([PAUL_WILLIAMS])
    const text: string[] = []
    ws.eachRow((r) => {
      r.eachCell((c) => {
        if (typeof c.value === 'string') text.push(c.value)
      })
    })
    expect(text).toContain('Total FTE: 0.45')
    // Still one whole named person on the team — headcount is not prorated.
    expect(text).toContain('Team size: 1 named person')
  })

  it('leaves an unsplit resource at their full raw period days', () => {
    const { ws, result, columns, rows } = buildCygnusSheet([UNSPLIT_RESOURCE])
    const days = cellFor(ws, columns, result.firstDataRow, rows, 'unsplit', 'days')
    expect(days.value).toBe(64)

    const quarter = cellFor(ws, columns, result.firstDataRow, rows, 'unsplit', 'commQuarter')
    expect(quarter.value).toBe(Math.round(58_000 * 64 * 1.0 * VAT) / 100)
    expect(totalFte([UNSPLIT_RESOURCE], 't-cygnus')).toBe(1)
  })

  it('makes the Totals row the cost of running the team, not of everyone who touches it', () => {
    const { ws, result, columns, rows } = buildCygnusSheet([PAUL_WILLIAMS, UNSPLIT_RESOURCE])
    // Every row feeding the SUM is already prorated, so the total is too.
    const quarterCol = columns.findIndex((c) => c.key === 'commQuarter') + 1
    const paul = cellFor(ws, columns, result.firstDataRow, rows, 'paul-williams', 'commQuarter')
      .value as number
    const whole = cellFor(ws, columns, result.firstDataRow, rows, 'unsplit', 'commQuarter')
      .value as number

    expect(paul).toBe(Math.round(58_000 * 32 * 0.9 * VAT) / 100)
    expect(whole).toBe(Math.round(58_000 * 64 * 1.0 * VAT) / 100)
    // Paul contributes half of what he would have before the fix.
    expect(paul).toBeLessThan(whole)

    const totalCell = ws.getCell(result.totalRow, quarterCol).value
    expect(totalCell).toHaveProperty('formula')
    const letter = columnLetter(quarterCol)
    expect((totalCell as { formula: string }).formula).toBe(
      `SUM(${letter}${result.firstDataRow}:${letter}${result.lastDataRow})`,
    )
  })
})

/**
 * Same as buildCygnusSheet above, but for an arbitrary team — Paul Williams's
 * fixture happens to be an even 50/50 split, which would pass even if
 * proration silently defaulted to "half of everything" instead of genuinely
 * reading each team's own capacity_split. The uneven and three-way fixtures
 * below need a sheet builder that isn't hardcoded to Cygnus.
 */
function buildTeamScheduleForScope(
  teamId: string,
  teamName: string,
  rows: VariantAllocationRow[],
) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(teamName)
  const result = buildTeamScheduleSheet({
    ws,
    rows,
    teamName,
    teamScope: teamId,
    periodName: 'Q3 FY 26/27',
    dateRange: '01 Oct 2026 – 31 Dec 2026',
    exportedAt: 'Exported 10 Sep 2026 at 09:00',
    vatMultiplier: VAT,
    blendedDayRatePence: BLENDED,
    costVisibility: 'both',
  })
  return { ws, result, columns: teamScheduleColumns('both'), rows }
}

/* ══════════════════════════════════════════════════════════════════════
   Uneven and three-way splits.

   Paul Williams above is exactly 50/50, which is the one shape that can't
   distinguish "reads this team's real capacity_split" from "always halves
   it" — both produce the same answer. These fixtures use splits that are
   NOT 50/50 (and, for the second, more than two teams) so a regression that
   reintroduced a hardcoded halving, or that dropped/double-counted capacity
   across more than two team assignments, would fail here even though it
   passed the Paul Williams tests.
══════════════════════════════════════════════════════════════════════ */

/** 100 raw days, 80% utilisation, split 30% Cygnus / 70% Pluto — not 50/50. */
const UNEVEN_SPLIT_RESOURCE: VariantAllocationRow = {
  allocation_id: 'uneven-split',
  resource_id: 'uneven-person',
  resource_name: 'R. Kapoor',
  role_title: 'Engineer',
  planview_code: 'PR',
  supplier_name: 'Capgemini',
  supplier_abbreviation: 'CG',
  supplier_colour: '#003C82',
  resource_location: 'nearshore',
  utilisation_percent: 80,
  capacity_days: 100,
  day_rate: 62_000,
  vat_applies: true,
  teams: [
    { teamId: 't-cygnus', teamName: 'Cygnus', capacitySplit: 0.3 },
    { teamId: 't-pluto', teamName: 'Pluto', capacitySplit: 0.7 },
  ],
}

describe('Team Schedule prorates an uneven (30/70) split correctly per team', () => {
  it('gives the 30% team 30 days — not an even half of the 100 raw days', () => {
    const { ws, result, columns, rows } = buildTeamScheduleForScope(
      't-cygnus',
      'Cygnus',
      [UNEVEN_SPLIT_RESOURCE],
    )
    const days = cellFor(ws, columns, result.firstDataRow, rows, 'uneven-split', 'days')
    expect(days.value).toBe(30)
  })

  it('gives the 70% team 70 days, the OTHER team’s share, not its own reused', () => {
    const { ws, result, columns, rows } = buildTeamScheduleForScope(
      't-pluto',
      'Pluto',
      [UNEVEN_SPLIT_RESOURCE],
    )
    const days = cellFor(ws, columns, result.firstDataRow, rows, 'uneven-split', 'days')
    expect(days.value).toBe(70)
  })

  it('prices the 30% team’s Quarter at 62,000 × 30 × 0.8, not a 50/50 guess', () => {
    const base = commercialBasePence(
      UNEVEN_SPLIT_RESOURCE,
      proratedDays(UNEVEN_SPLIT_RESOURCE, 't-cygnus'),
    )
    expect(base).toBe(62_000 * 30 * 0.8)

    const { ws, result, columns, rows } = buildTeamScheduleForScope(
      't-cygnus',
      'Cygnus',
      [UNEVEN_SPLIT_RESOURCE],
    )
    const quarter = cellFor(ws, columns, result.firstDataRow, rows, 'uneven-split', 'commQuarter')
    expect(quarter.value).toBe(Math.round(base * VAT) / 100)
  })

  it('prices the 70% team’s Quarter at 62,000 × 70 × 0.8', () => {
    const base = commercialBasePence(
      UNEVEN_SPLIT_RESOURCE,
      proratedDays(UNEVEN_SPLIT_RESOURCE, 't-pluto'),
    )
    expect(base).toBe(62_000 * 70 * 0.8)

    const { ws, result, columns, rows } = buildTeamScheduleForScope(
      't-pluto',
      'Pluto',
      [UNEVEN_SPLIT_RESOURCE],
    )
    const quarter = cellFor(ws, columns, result.firstDataRow, rows, 'uneven-split', 'commQuarter')
    expect(quarter.value).toBe(Math.round(base * VAT) / 100)
  })

  it('prorates cross-charge the same way on both sides of the split', () => {
    const cygnus = buildTeamScheduleForScope('t-cygnus', 'Cygnus', [UNEVEN_SPLIT_RESOURCE])
    const pluto = buildTeamScheduleForScope('t-pluto', 'Pluto', [UNEVEN_SPLIT_RESOURCE])
    const xc = (built: typeof cygnus) =>
      cellFor(built.ws, built.columns, built.result.firstDataRow, built.rows, 'uneven-split', 'xcQuarter')
        .value

    expect(xc(cygnus)).toBe(Math.round(BLENDED * 30 * 0.8) / 100)
    expect(xc(pluto)).toBe(Math.round(BLENDED * 70 * 0.8) / 100)
  })

  // FTE contribution must scale with THIS team's share of utilisation, not
  // a flat half — 0.3 × 0.8 = 0.24, not 0.5 × 0.8 = 0.4.
  it('gives the 30% team an FTE contribution of 0.24, and the 70% team 0.56', () => {
    expect(totalFte([UNEVEN_SPLIT_RESOURCE], 't-cygnus')).toBeCloseTo(0.24, 10)
    expect(totalFte([UNEVEN_SPLIT_RESOURCE], 't-pluto')).toBeCloseTo(0.56, 10)
  })

  it('sums the two teams’ prorated days back to the resource’s full 100 raw days', () => {
    const cygnusDays = proratedDays(UNEVEN_SPLIT_RESOURCE, 't-cygnus')
    const plutoDays = proratedDays(UNEVEN_SPLIT_RESOURCE, 't-pluto')
    expect(cygnusDays + plutoDays).toBe(UNEVEN_SPLIT_RESOURCE.capacity_days)
  })
})

/** 100 raw days, 100% utilisation, split 20% / 35% / 45% across three teams. */
const THREE_WAY_SPLIT_RESOURCE: VariantAllocationRow = {
  allocation_id: 'three-way-split',
  resource_id: 'three-way-person',
  resource_name: 'M. Osei',
  role_title: 'Architect',
  planview_code: 'PR',
  supplier_name: 'Capgemini',
  supplier_abbreviation: 'CG',
  supplier_colour: '#003C82',
  resource_location: 'offshore',
  utilisation_percent: 100,
  capacity_days: 100,
  day_rate: 50_000,
  vat_applies: true,
  teams: [
    { teamId: 't-alpha', teamName: 'Alpha', capacitySplit: 0.2 },
    { teamId: 't-beta', teamName: 'Beta', capacitySplit: 0.35 },
    { teamId: 't-gamma', teamName: 'Gamma', capacitySplit: 0.45 },
  ],
}

describe('Team Schedule prorates a three-way split independently on each team', () => {
  const THREE_TEAMS = [
    { teamId: 't-alpha', teamName: 'Alpha', share: 0.2, days: 20 },
    { teamId: 't-beta', teamName: 'Beta', share: 0.35, days: 35 },
    { teamId: 't-gamma', teamName: 'Gamma', share: 0.45, days: 45 },
  ]

  it.each(THREE_TEAMS)(
    'gives $teamName ($share share) $days of the 100 raw days',
    ({ teamId, teamName, days }) => {
      const { ws, result, columns, rows } = buildTeamScheduleForScope(teamId, teamName, [
        THREE_WAY_SPLIT_RESOURCE,
      ])
      const cell = cellFor(ws, columns, result.firstDataRow, rows, 'three-way-split', 'days')
      expect(cell.value).toBe(days)
    },
  )

  it.each(THREE_TEAMS)(
    'prices $teamName’s Quarter at 50,000 × $days × 1.0, independent of the other two teams',
    ({ teamId, teamName, days }) => {
      const base = commercialBasePence(THREE_WAY_SPLIT_RESOURCE, days)
      expect(base).toBe(50_000 * days)

      const { ws, result, columns, rows } = buildTeamScheduleForScope(teamId, teamName, [
        THREE_WAY_SPLIT_RESOURCE,
      ])
      const quarter = cellFor(ws, columns, result.firstDataRow, rows, 'three-way-split', 'commQuarter')
      expect(quarter.value).toBe(Math.round(base * VAT) / 100)
    },
  )

  it.each(THREE_TEAMS)('gives $teamName an FTE contribution equal to its own $share share', ({ teamId, share }) => {
    // utilisation_percent is 100 here, so the FTE contribution IS the share —
    // a distinct case from the uneven fixture above, where utilisation < 100
    // and FTE is share × utilisation, not share alone.
    expect(totalFte([THREE_WAY_SPLIT_RESOURCE], teamId)).toBeCloseTo(share, 10)
  })

  // The sanity check the three-way case exists for: proration across MORE
  // than two team assignments must neither drop nor double-count capacity.
  // Two teams summing correctly (the uneven fixture above) doesn't prove a
  // third assignment is read at all — a bug that only looked at teams[0] and
  // teams[1], say, would still pass a two-team check.
  it('sums all three teams’ prorated days back to the resource’s full 100 raw days', () => {
    const totalAcrossTeams = THREE_TEAMS.reduce(
      (sum, t) => sum + proratedDays(THREE_WAY_SPLIT_RESOURCE, t.teamId),
      0,
    )
    expect(totalAcrossTeams).toBe(THREE_WAY_SPLIT_RESOURCE.capacity_days)
  })

  it('independently confirms each team’s own capacity_days share sums correctly, not just the total', () => {
    // Belt-and-braces over the reduce above: compute each share via the raw
    // capacitySplit on the fixture itself (not via proratedDays, so this
    // doesn't just re-test the same code path twice) and confirm it matches
    // both the expected constant and what proratedDays returns.
    for (const t of THREE_TEAMS) {
      const assignment = THREE_WAY_SPLIT_RESOURCE.teams.find((team) => team.teamId === t.teamId)
      expect(assignment).toBeDefined()
      const expectedDays = THREE_WAY_SPLIT_RESOURCE.capacity_days! * (assignment?.capacitySplit ?? 0)
      expect(expectedDays).toBe(t.days)
      expect(proratedDays(THREE_WAY_SPLIT_RESOURCE, t.teamId)).toBe(expectedDays)
    }
  })
})

describe('Supplier Schedule is deliberately NOT prorated by team', () => {
  function buildPaulSupplierSheet() {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Capgemini')
    const rows = [PAUL_WILLIAMS]
    const result = buildSupplierScheduleSheet({
      ws,
      rows,
      supplierName: 'Capgemini',
      periodName: 'Q3 FY 26/27',
      dateRange: '01 Oct 2026 – 31 Dec 2026',
      exportedAt: 'Exported 10 Sep 2026 at 09:00',
      vatMultiplier: VAT,
    })
    return { ws, result, rows }
  }

  // This file answers "what do I pay this supplier", not "what does this cost
  // this team". Paul is one person Capgemini invoices for in full, however his
  // time is divided internally — so the team-proration fix must not reach here.
  it('shows Paul Williams’s full 64 days regardless of his 50/50 split', () => {
    const { ws, result, rows } = buildPaulSupplierSheet()
    const days = cellFor(ws, SUPPLIER_SCHEDULE_COLUMNS, result.firstDataRow, rows, 'paul-williams', 'days')
    expect(days.value).toBe(64)
  })

  it('shows his full commercial quarter, twice the Cygnus-scoped figure', () => {
    const { ws, result, rows } = buildPaulSupplierSheet()
    const quarter = cellFor(
      ws,
      SUPPLIER_SCHEDULE_COLUMNS,
      result.firstDataRow,
      rows,
      'paul-williams',
      'quarter',
    ).value as number
    expect(quarter).toBe(Math.round(58_000 * 64 * 0.9 * VAT) / 100)

    const team = buildCygnusSheet([PAUL_WILLIAMS])
    const teamQuarter = cellFor(
      team.ws,
      team.columns,
      team.result.firstDataRow,
      team.rows,
      'paul-williams',
      'commQuarter',
    ).value as number
    // The two files disagree, on purpose, by exactly his team share.
    expect(teamQuarter).toBeCloseTo(quarter / 2, 1)
  })

  it('reports his full 0.9 FTE, unprorated', () => {
    expect(totalFte([PAUL_WILLIAMS])).toBeCloseTo(0.9, 10)
  })
})

describe('the two new sheets are genuinely covered by the doubled-"=" guard', () => {
  // noDoubledFormulaEquals walks every sheet in this same sample workbook.
  // This asserts the new sheets actually contribute formula cells to it, so
  // that guard cannot pass vacuously for them.
  it('contributes formula cells from both scoped sheets to the sample workbook', () => {
    const { cells } = buildSampleExportWorkbook()
    expect(cells.teamScheduleTotals.length).toBeGreaterThan(0)
    expect(cells.supplierScheduleTotals.length).toBeGreaterThan(0)
  })

  it('writes none of them with a leading "="', () => {
    const { workbook, cells } = buildSampleExportWorkbook()
    for (const ref of [...cells.teamScheduleTotals, ...cells.supplierScheduleTotals]) {
      const [sheetName, address] = ref.split('!')
      const value = workbook.getWorksheet(sheetName)?.getCell(address).value
      expect(value).toHaveProperty('formula')
      expect((value as { formula: string }).formula.startsWith('=')).toBe(false)
    }
  })
})
