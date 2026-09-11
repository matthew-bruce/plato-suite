import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import * as teamSheetModule from '../teamScheduleSheet'
import { buildTeamScheduleSheet, teamScheduleColumns, columnLetter } from '../teamScheduleSheet'
import { buildSupplierScheduleSheet, SUPPLIER_SCHEDULE_COLUMNS } from '../supplierScheduleSheet'
import { darkenForWhiteText, mutedOnBand, rgbToHsl } from '../richText'
import { contrastRatio } from '../../schedule/ui'
import { buildSampleExportWorkbook, SCOPED_SHEET_FIXTURE } from './exportFormulaSample'
import {
  NOT_APPLICABLE,
  commercialBasePence,
  proratedDays,
  totalFte,
} from '../scheduleVariantRows'
import type { VariantAllocationRow } from '../scheduleVariantRows'

const VAT = 1.07082
const BLENDED = 60_500

const PLUTO_ROWS = SCOPED_SHEET_FIXTURE.filter((r) =>
  r.teams.some((t) => t.teamId === 't-pluto'),
)
const CAPGEMINI_ROWS = SCOPED_SHEET_FIXTURE.filter((r) => r.supplier_name === 'Capgemini')

function buildTeamSheet() {
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
    blendedDayRatePence: BLENDED,
  })
  return { ws, result, columns: teamScheduleColumns() }
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
    expect(stats).toContain('All figures include VAT')
  })

  // Replaces the old "N included in platform cost", which measured commercial
  // cost inclusion — a question this file no longer asks.
  it('reports how many of the named people are cross-charged, PR-only', () => {
    const { ws } = buildTeamSheet()
    const stats = String(ws.getCell(3, 1).value)
    // Of the 5 Pluto rows: person-1 (PR, twice), person-2 (F_Gov),
    // person-3 (BAU), person-4 (NPC) → 4 named people, 1 cross-charged.
    expect(stats).toContain('4 named people')
    expect(stats).toContain('1 of 4 cross-charged')
  })

  it('states that its figures are VAT-inclusive, since the blended rate already is', () => {
    const { ws } = buildTeamSheet()
    let found = false
    ws.eachRow((r) => {
      r.eachCell((c) => {
        if (typeof c.value === 'string' && c.value.includes('blended day rate already includes VAT')) {
          found = true
        }
      })
    })
    expect(found).toBe(true)
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

  it('gives an NPC row no cross-charge figure — its only cost group', () => {
    const { ws, result, columns } = buildTeamSheet()
    const at = (key: string) =>
      cellFor(ws, columns, result.firstDataRow, PLUTO_ROWS, 'a-npc', key)
    expect(at('xcQuarter').value).toBe(NOT_APPLICABLE)
    expect(at('xcSprint').value).toBe(NOT_APPLICABLE)
    expect(at('xcMonth').value).toBe(NOT_APPLICABLE)
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

  it('totals every cost column it has — all of which are cross-charge', () => {
    const { ws, result, columns } = buildTeamSheet()
    for (const key of ['xcSprint', 'xcMonth', 'xcQuarter']) {
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
    // The old line claimed all costs included VAT. They do not: VAT is set
    // per resource, so the file shows both sides rather than asserting one.
    expect(stats).not.toContain('All costs include VAT')
    expect(stats).toContain('Ex-VAT and inc-VAT shown separately')
  })

  it('prices the NPC resource for real — the divergence from Team Schedule', () => {
    const { ws, result } = buildSupplierSheet()
    const base = cellFor(
      ws, SUPPLIER_SCHEDULE_COLUMNS, result.firstDataRow, CAPGEMINI_ROWS, 'a-npc', 'base',
    )
    expect(typeof base.value).toBe('number')
    expect(base.value as number).toBeGreaterThan(0)
  })

  // The same fixture row, rendered by both sheets, on purpose disagreeing.
  it('disagrees with the Team Schedule about that exact row', () => {
    const supplier = buildSupplierSheet()
    const team = buildTeamSheet()

    const onSupplier = cellFor(
      supplier.ws, SUPPLIER_SCHEDULE_COLUMNS, supplier.result.firstDataRow,
      CAPGEMINI_ROWS, 'a-npc', 'total',
    ).value
    // The Team Schedule's only cost group is cross-charge, and NPC is not
    // cross-charged — so the same person is money here and nothing there.
    const onTeam = cellFor(
      team.ws, team.columns, team.result.firstDataRow, PLUTO_ROWS, 'a-npc', 'xcQuarter',
    ).value

    expect(onTeam).toBe(NOT_APPLICABLE)
    expect(typeof onSupplier).toBe('number')
  })

  it('carries no cross-charge column at all', () => {
    const keys = SUPPLIER_SCHEDULE_COLUMNS.map((c) => c.key)
    expect(keys).not.toContain('xcQuarter')
    expect(keys).not.toContain('xcSprint')
    // Team is a column here precisely because this file spans teams.
    expect(keys).toContain('team')
  })

  it('carries exactly the four commercial columns, in SOW-reading order', () => {
    const commercial = SUPPLIER_SCHEDULE_COLUMNS.filter((c) => c.group).map((c) => c.key)
    expect(commercial).toEqual(['dayRate', 'base', 'vat', 'total'])
  })

  it('drops Sprint and Month, which a SOW reconciliation has no use for', () => {
    const keys = SUPPLIER_SCHEDULE_COLUMNS.map((c) => c.key)
    expect(keys).not.toContain('sprint')
    expect(keys).not.toContain('month')
    const headers = SUPPLIER_SCHEDULE_COLUMNS.map((c) => c.header.toLowerCase())
    for (const h of headers) {
      expect(h).not.toContain('sprint')
      expect(h).not.toContain('month')
    }
  })

  it('labels its ex-VAT columns explicitly', () => {
    const header = (key: string) =>
      SUPPLIER_SCHEDULE_COLUMNS.find((c) => c.key === key)?.header
    expect(header('dayRate')).toBe('Day rate (ex VAT)')
    expect(header('base')).toBe('Base (ex VAT)')
    expect(header('total')).toBe('Total (inc VAT)')
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
    blendedDayRatePence: BLENDED,
  })
  return { ws, result, columns: teamScheduleColumns(), rows }
}

describe('Team Schedule prorates a split resource to the scoped team', () => {
  it('shows 32.0 Total days for Paul Williams on Cygnus, not his full 64', () => {
    const { ws, result, columns, rows } = buildCygnusSheet([PAUL_WILLIAMS])
    const days = cellFor(ws, columns, result.firstDataRow, rows, 'paul-williams', 'days')
    expect(days.value).toBe(32)
    // The raw record is untouched — proration is a presentation of it.
    expect(PAUL_WILLIAMS.capacity_days).toBe(64)
  })

  // The Team Schedule no longer carries a commercial figure to check this
  // against, but the arithmetic the page shows is still pinned here: prorated
  // days times rate times utilisation is £16,704, exactly what the
  // Cygnus-filtered page reports as Base for him.
  it('prorates to the £16,704 base the Cygnus-filtered page shows', () => {
    const base = commercialBasePence(PAUL_WILLIAMS, proratedDays(PAUL_WILLIAMS, 't-cygnus'))
    expect(base).toBe(58_000 * 32 * 0.9)
    expect(base).toBe(1_670_400)
    // Not his full period, which would be double.
    expect(commercialBasePence(PAUL_WILLIAMS, 64)).toBe(base * 2)
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
    expect(at('xcSprint')).toBe(Math.round(BLENDED * 10 * 0.5 * 0.9) / 100)
    expect(at('xcMonth')).toBe(Math.round(BLENDED * 21 * 0.5 * 0.9) / 100)
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

    const quarter = cellFor(ws, columns, result.firstDataRow, rows, 'unsplit', 'xcQuarter')
    expect(quarter.value).toBe(Math.round(BLENDED * 64 * 1.0) / 100)
    expect(totalFte([UNSPLIT_RESOURCE], 't-cygnus')).toBe(1)
  })

  it('makes the Totals row the cost of running the team, not of everyone who touches it', () => {
    const { ws, result, columns, rows } = buildCygnusSheet([PAUL_WILLIAMS, UNSPLIT_RESOURCE])
    // Every row feeding the SUM is already prorated, so the total is too.
    const quarterCol = columns.findIndex((c) => c.key === 'xcQuarter') + 1
    const paul = cellFor(ws, columns, result.firstDataRow, rows, 'paul-williams', 'xcQuarter')
      .value as number
    const whole = cellFor(ws, columns, result.firstDataRow, rows, 'unsplit', 'xcQuarter')
      .value as number

    expect(paul).toBe(Math.round(BLENDED * 32 * 0.9) / 100)
    expect(whole).toBe(Math.round(BLENDED * 64 * 1.0) / 100)
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
    blendedDayRatePence: BLENDED,
  })
  return { ws, result, columns: teamScheduleColumns(), rows }
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

  it('charges the 30% team for 30 days of it, not a 50/50 guess', () => {
    // Pinned on the underlying arithmetic as well as the rendered cell, so
    // the split itself is checked and not just the cross-charge rate.
    expect(commercialBasePence(UNEVEN_SPLIT_RESOURCE, proratedDays(UNEVEN_SPLIT_RESOURCE, 't-cygnus')))
      .toBe(62_000 * 30 * 0.8)

    const { ws, result, columns, rows } = buildTeamScheduleForScope(
      't-cygnus', 'Cygnus', [UNEVEN_SPLIT_RESOURCE],
    )
    const quarter = cellFor(ws, columns, result.firstDataRow, rows, 'uneven-split', 'xcQuarter')
    expect(quarter.value).toBe(Math.round(BLENDED * 30 * 0.8) / 100)
  })

  it('charges the 70% team for 70 days of it', () => {
    expect(commercialBasePence(UNEVEN_SPLIT_RESOURCE, proratedDays(UNEVEN_SPLIT_RESOURCE, 't-pluto')))
      .toBe(62_000 * 70 * 0.8)

    const { ws, result, columns, rows } = buildTeamScheduleForScope(
      't-pluto', 'Pluto', [UNEVEN_SPLIT_RESOURCE],
    )
    const quarter = cellFor(ws, columns, result.firstDataRow, rows, 'uneven-split', 'xcQuarter')
    expect(quarter.value).toBe(Math.round(BLENDED * 70 * 0.8) / 100)
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
    'charges $teamName for its own $days days, independent of the other two teams',
    ({ teamId, teamName, days }) => {
      expect(commercialBasePence(THREE_WAY_SPLIT_RESOURCE, days)).toBe(50_000 * days)

      const { ws, result, columns, rows } = buildTeamScheduleForScope(teamId, teamName, [
        THREE_WAY_SPLIT_RESOURCE,
      ])
      const quarter = cellFor(ws, columns, result.firstDataRow, rows, 'three-way-split', 'xcQuarter')
      expect(quarter.value).toBe(Math.round(BLENDED * days) / 100)
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

  it('shows his full commercial base, twice the Cygnus-scoped day count', () => {
    const { ws, result, rows } = buildPaulSupplierSheet()
    const at = (key: string) =>
      cellFor(ws, SUPPLIER_SCHEDULE_COLUMNS, result.firstDataRow, rows, 'paul-williams', key)
        .value as number

    // His whole period, at his whole rate — what Capgemini invoices for.
    expect(at('base')).toBe((58_000 * 64 * 0.9) / 100)
    // Exactly twice the days Cygnus is charged for, which is the whole point
    // of the divergence: the same person, two questions, two answers.
    expect(at('days')).toBe(64)
    expect(proratedDays(PAUL_WILLIAMS, 't-cygnus')).toBe(32)
  })

  it('keeps his day rate as the contracted rate, never prorated', () => {
    // A rate is not a quantity; only the day count is a share of anything.
    const { ws, result, rows } = buildPaulSupplierSheet()
    const rate = cellFor(
      ws, SUPPLIER_SCHEDULE_COLUMNS, result.firstDataRow, rows, 'paul-williams', 'dayRate',
    )
    expect(rate.value).toBe(580)
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

/* ══════════════════════════════════════════════════════════════════════
   Supplier Schedule VAT model.

   VAT is a per-resource fact, not a file-wide assumption. The live Schedule
   page shows it as separate Base and +VAT columns whose difference is £0 for
   an exempt resource, and this file has to say the same thing — SOWs are
   quoted ex VAT, but the inc-VAT figure is what hits a budget.

   Both fixtures are the real screenshot figures:
     Paul Williams  — exempt:    Base £16,704.00 = +VAT £16,704.00, VAT £0
     Prakash Setty  — chargeable: Base £28,800.00, +VAT £30,839.62,
                                  VAT £2,039.62 (the difference, not a rate)
══════════════════════════════════════════════════════════════════════ */

/** Exempt: vat_applies false, so Base and Total must match exactly. */
const VAT_EXEMPT_RESOURCE: VariantAllocationRow = {
  ...PAUL_WILLIAMS,
  allocation_id: 'vat-exempt',
  resource_id: 'vat-exempt-person',
  vat_applies: false,
  // 64 days × £580 × 90% = £33,408 ex VAT.
  teams: [{ teamId: 't-cygnus', teamName: 'Cygnus', capacitySplit: 1 }],
}

/** Chargeable: Prakash Setty's real figures — £28,800 base, £30,839.62 inc. */
const VAT_CHARGEABLE_RESOURCE: VariantAllocationRow = {
  ...PAUL_WILLIAMS,
  allocation_id: 'vat-chargeable',
  resource_id: 'prakash',
  resource_name: 'Prakash Setty',
  utilisation_percent: 100,
  capacity_days: 64,
  day_rate: 45_000, // £450 × 64 × 100% = £28,800.00 ex VAT
  vat_applies: true,
  teams: [{ teamId: 't-cygnus', teamName: 'Cygnus', capacitySplit: 1 }],
}

function buildVatSupplierSheet(rows: VariantAllocationRow[]) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Capgemini')
  const result = buildSupplierScheduleSheet({
    ws,
    rows,
    supplierName: 'Capgemini',
    periodName: 'Q3 FY 26/27',
    dateRange: '01 Oct 2026 – 31 Dec 2026',
    exportedAt: 'Exported 11 Sep 2026 at 09:00',
    vatMultiplier: VAT,
  })
  return { ws, result, rows }
}

describe('Supplier Schedule VAT model', () => {
  it('gives a VAT-exempt resource £0 VAT, with Base equal to Total', () => {
    const { ws, result, rows } = buildVatSupplierSheet([VAT_EXEMPT_RESOURCE])
    const at = (key: string) =>
      cellFor(ws, SUPPLIER_SCHEDULE_COLUMNS, result.firstDataRow, rows, 'vat-exempt', key)
        .value as number

    expect(at('base')).toBe((58_000 * 64 * 0.9) / 100)
    expect(at('vat')).toBe(0)
    expect(at('total')).toBe(at('base'))
  })

  it('gives a VAT-chargeable resource a VAT amount that is Total minus Base', () => {
    const { ws, result, rows } = buildVatSupplierSheet([VAT_CHARGEABLE_RESOURCE])
    const at = (key: string) =>
      cellFor(ws, SUPPLIER_SCHEDULE_COLUMNS, result.firstDataRow, rows, 'vat-chargeable', key)
        .value as number

    // Prakash Setty's real figures from the live page.
    expect(at('base')).toBe(28_800)
    expect(at('total')).toBeCloseTo(30_839.62, 2)
    expect(at('vat')).toBeCloseTo(2_039.62, 2)
    // The VAT column is a subtraction of the other two, never a rate applied
    // on its own — which is what makes the exempt case land on £0 for free.
    expect(at('vat')).toBeCloseTo(at('total') - at('base'), 6)
  })

  it('derives VAT by subtraction for every row, exempt and chargeable alike', () => {
    const { ws, result, rows } = buildVatSupplierSheet([
      VAT_EXEMPT_RESOURCE,
      VAT_CHARGEABLE_RESOURCE,
    ])
    for (const id of ['vat-exempt', 'vat-chargeable']) {
      const at = (key: string) =>
        cellFor(ws, SUPPLIER_SCHEDULE_COLUMNS, result.firstDataRow, rows, id, key).value as number
      expect(at('vat')).toBeCloseTo(at('total') - at('base'), 6)
    }
  })

  it('sums the bottom bar from the per-row columns rather than recomputing', () => {
    const { ws, result } = buildVatSupplierSheet([VAT_EXEMPT_RESOURCE, VAT_CHARGEABLE_RESOURCE])
    const colOf = (key: string) =>
      columnLetter(SUPPLIER_SCHEDULE_COLUMNS.findIndex((c) => c.key === key) + 1)

    // The totals row SUMs the printed columns...
    for (const key of ['base', 'vat', 'total']) {
      const col = SUPPLIER_SCHEDULE_COLUMNS.findIndex((c) => c.key === key) + 1
      const value = ws.getCell(result.totalRow, col).value
      expect(value).toHaveProperty('formula')
      expect((value as { formula: string }).formula).toBe(
        `SUM(${colOf(key)}${result.firstDataRow}:${colOf(key)}${result.lastDataRow})`,
      )
    }

    // ...and the Ex/Inc VAT bar points straight at those totals, so it can
    // only ever agree with the rows a reader can see.
    const text = new Map<string, unknown>()
    ws.eachRow((r) => {
      const label = r.getCell(1).value
      if (typeof label === 'string') text.set(label, r.getCell(2).value)
    })
    expect(text.get('Ex VAT total')).toEqual({ formula: `${colOf('base')}${result.totalRow}` })
    expect(text.get('Inc VAT total')).toEqual({ formula: `${colOf('total')}${result.totalRow}` })
  })

  it('states the VAT rate the figures were actually built with', () => {
    const { ws } = buildVatSupplierSheet([VAT_CHARGEABLE_RESOURCE])
    const labels = new Map<string, unknown>()
    ws.eachRow((r) => {
      const label = r.getCell(1).value
      if (typeof label === 'string') labels.set(label, r.getCell(2).value)
    })
    expect(labels.get('VAT rate applied')).toBe('7.082%')
  })

  it('never sums the day rate column', () => {
    const { ws, result } = buildVatSupplierSheet([VAT_EXEMPT_RESOURCE, VAT_CHARGEABLE_RESOURCE])
    const col = SUPPLIER_SCHEDULE_COLUMNS.findIndex((c) => c.key === 'dayRate') + 1
    expect(ws.getCell(result.totalRow, col).value).toBe(NOT_APPLICABLE)
  })
})

/* ══════════════════════════════════════════════════════════════════════
   Days formatting — one rounding rule, shared with the live page.

   The page used to run toFixed(1) on a prorated figure and print the raw
   value otherwise, which is why one row read "32.0" and the next "64". Both
   media now go through roundDays().
══════════════════════════════════════════════════════════════════════ */

describe('Total days formatting', () => {
  /** 100 days at a 20.5% share → 20.5: a genuinely fractional day count. */
  const FRACTIONAL_DAYS_RESOURCE: VariantAllocationRow = {
    ...PAUL_WILLIAMS,
    allocation_id: 'fractional',
    resource_id: 'fractional-person',
    utilisation_percent: 100,
    capacity_days: 100,
    teams: [{ teamId: 't-cygnus', teamName: 'Cygnus', capacitySplit: 0.205 }],
  }

  /** A whole number on both sides of the proration. */
  const WHOLE_DAYS_RESOURCE: VariantAllocationRow = {
    ...PAUL_WILLIAMS,
    allocation_id: 'whole-days',
    resource_id: 'whole-days-person',
    utilisation_percent: 100,
    capacity_days: 64,
    teams: [{ teamId: 't-cygnus', teamName: 'Cygnus', capacitySplit: 1 }],
  }

  it('keeps the decimal on a genuinely fractional day count', () => {
    const { ws, result, columns, rows } = buildCygnusSheet([FRACTIONAL_DAYS_RESOURCE])
    const days = cellFor(ws, columns, result.firstDataRow, rows, 'fractional', 'days')
    expect(days.value).toBe(20.5)
  })

  it('leaves a whole day count whole — no trailing .0', () => {
    const { ws, result, columns, rows } = buildCygnusSheet([WHOLE_DAYS_RESOURCE])
    const days = cellFor(ws, columns, result.firstDataRow, rows, 'whole-days', 'days')
    expect(days.value).toBe(64)
    expect(Number.isInteger(days.value as number)).toBe(true)
  })

  it('rounds a long proration float to one decimal rather than printing it raw', () => {
    // A third of a period is 21.333…, which General format would otherwise
    // spill across the column.
    const third: VariantAllocationRow = {
      ...PAUL_WILLIAMS,
      allocation_id: 'third',
      resource_id: 'third-person',
      capacity_days: 64,
      teams: [{ teamId: 't-cygnus', teamName: 'Cygnus', capacitySplit: 1 / 3 }],
    }
    const { ws, result, columns, rows } = buildCygnusSheet([third])
    const days = cellFor(ws, columns, result.firstDataRow, rows, 'third', 'days')
    expect(days.value).toBe(21.3)
  })

  it('uses General format, not a "0.#" that would print a trailing point', () => {
    const { ws, result, columns, rows } = buildCygnusSheet([WHOLE_DAYS_RESOURCE])
    const days = cellFor(ws, columns, result.firstDataRow, rows, 'whole-days', 'days')
    expect(days.numFmt).toBe('General')
  })

  it('applies the same rule on the Supplier Schedule', () => {
    const { ws, result, rows } = buildVatSupplierSheet([VAT_CHARGEABLE_RESOURCE])
    const days = cellFor(
      ws, SUPPLIER_SCHEDULE_COLUMNS, result.firstDataRow, rows, 'vat-chargeable', 'days',
    )
    expect(days.value).toBe(64)
    expect(days.numFmt).toBe('General')
  })
})

/* ══════════════════════════════════════════════════════════════════════
   Structural proof that the Team Schedule cannot emit commercial content.

   Asserting the generated cells are empty is not enough — that only says
   this fixture produced nothing, not that nothing could. These read the
   module's own source and its exported surface, so a commercial writer
   reintroduced behind any condition fails here even if no test fixture
   happens to trigger it.
══════════════════════════════════════════════════════════════════════ */

describe('Team Schedule never calls a commercial cost writer', () => {
  const teamModuleSource = readFileSync(
    new URL('../teamScheduleSheet.ts', import.meta.url),
    'utf8',
  )

  it('imports no commercial money function at all', () => {
    // These are the only functions that can turn a supplier day_rate into a
    // figure. If the Team Schedule module references any of them, it can
    // produce commercial content — regardless of whether it currently does.
    for (const fn of [
      'commercialCostPence',
      'commercialBasePence',
      'supplierRowMoney',
      'supplierCommercialFigures',
      'teamCommercialFigures',
    ]) {
      expect(teamModuleSource).not.toContain(fn)
    }
  })

  it('has no cost-visibility branching left in it', () => {
    for (const token of ['costVisibility', 'CostVisibility', 'showsCommercialCost', 'showsInternalCost']) {
      expect(teamModuleSource).not.toContain(token)
    }
  })

  it('does not read day_rate off a row anywhere', () => {
    // The single field every commercial figure ultimately comes from.
    expect(teamModuleSource).not.toContain('day_rate')
  })

  it('exports no commercial helper of its own', () => {
    const exported = Object.keys(teamSheetModule)
    for (const name of exported) {
      expect(name.toLowerCase()).not.toContain('commercial')
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════
   Supplier colour accent on the Supplier Schedule header.

   The stripe is the identification cue and works for any colour, because a
   border does not have to be legible as text. The title only takes the
   brand colour where it actually reads on the near-black header band — most
   of the current palette is dark (navy, deep blue, charcoal) and would be
   close to invisible.

   The palette below mirrors suppliers.supplier_colour as it stands. It is a
   fixture, not a source of truth: production reads the column. Its job is to
   prove the RULE holds across every colour in real use, and the last test in
   this block asserts the invariant that matters — whatever colour is chosen,
   it is legible — which stays true even if every value here changes.
══════════════════════════════════════════════════════════════════════ */

const LIVE_SUPPLIER_PALETTE: { name: string; colour: string }[] = [
  { name: 'Royal Mail Group', colour: '#E2001A' },
  { name: 'North Highland', colour: '#1A2B5B' },
  { name: 'Happy Team', colour: '#FF8C00' },
  { name: 'Capgemini', colour: '#003C82' },
  { name: 'Tata Consultancy Services', colour: '#9B0A6E' },
  { name: 'Lean Tree', colour: '#3ABFB8' },
  { name: 'EPAM', colour: '#3D3D3D' },
  { name: 'TAAS', colour: '#7C3AED' },
  { name: 'HCL', colour: '#1976F2' },
]

function buildColourSheet(colour: string | null, supplierName = 'Capgemini') {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('S')
  const result = buildSupplierScheduleSheet({
    ws,
    rows: CAPGEMINI_ROWS,
    supplierName,
    periodName: 'Q3 FY 26/27',
    dateRange: '01 Oct 2026 – 31 Dec 2026',
    exportedAt: 'Exported 11 Sep 2026 at 09:00',
    vatMultiplier: VAT,
    supplierColour: colour,
  })
  return { ws, result }
}

/** The group-band row sits immediately above the column headers. */
function dividerRow(result: { firstDataRow: number }) {
  return result.firstDataRow - 2
}

/* ══════════════════════════════════════════════════════════════════════
   Supplier colour treatment.

   Three surfaces, deliberately different:
     masthead — the brand colour, darkened ONLY if white text would not
                clear WCAG AA on it, so most suppliers keep theirs;
     divider  — the TRUE, undarkened brand colour, always, so the authentic
                colour is on every tab even when the masthead was adjusted;
     tab      — the TRUE colour again, on Excel's own sheet-tab strip.

   This replaced a thin left-edge border, which was legible in property
   assertions and invisible in the actual file.
══════════════════════════════════════════════════════════════════════ */

describe('Supplier Schedule colour treatment', () => {
  it('fills the masthead with the brand colour when white text already clears AA', () => {
    // TCS magenta is 7.89:1 against white — no adjustment needed.
    const { ws } = buildColourSheet('#9B0A6E')
    const fill = ws.getCell(2, 1).fill as ExcelJS.FillPattern
    expect(fill.fgColor?.argb).toBe('FF9B0A6E')
  })

  it('darkens a pale brand colour for the masthead, preserving hue and saturation', () => {
    // Happy Team orange is 2.33:1 against white — must come down.
    const { ws } = buildColourSheet('#FF8C00')
    const fill = ws.getCell(2, 1).fill as ExcelJS.FillPattern
    const used = `#${fill.fgColor?.argb?.slice(2)}`
    expect(used.toUpperCase()).not.toBe('#FF8C00')
    expect(contrastRatio('FFFFFFFF', used)).toBeGreaterThanOrEqual(4.5)

    // Same hue, same saturation — only lightness moved.
    const brand = rgbToHsl('#FF8C00')!
    const adjusted = rgbToHsl(used)!
    // Within a degree of hue and a point of saturation — the hex round-trip
    // costs a little precision, the hue is not repurposed.
    expect(adjusted.h).toBeCloseTo(brand.h, 0)
    expect(adjusted.s).toBeCloseTo(brand.s, 1)
    expect(adjusted.l).toBeLessThan(brand.l)
  })

  it('gives the divider band the TRUE brand colour even when the masthead was darkened', () => {
    const { ws, result } = buildColourSheet('#FF8C00')
    const masthead = (ws.getCell(2, 1).fill as ExcelJS.FillPattern).fgColor?.argb
    const divider = (ws.getCell(dividerRow(result), 8).fill as ExcelJS.FillPattern).fgColor?.argb

    expect(divider).toBe('FFFF8C00')
    // The whole point: the authentic colour is present even though the
    // masthead above it could not use it.
    expect(masthead).not.toBe(divider)
  })

  it('sets the Excel tab colour to the TRUE brand colour', () => {
    const { ws } = buildColourSheet('#FF8C00')
    expect(ws.properties.tabColor?.argb).toBe('FFFF8C00')
  })

  it('leaves data rows white — no tint, leaving room for in-row colour later', () => {
    const { ws, result } = buildColourSheet('#9B0A6E')
    for (let r = result.firstDataRow; r <= result.lastDataRow; r++) {
      for (let c = 1; c <= SUPPLIER_SCHEDULE_COLUMNS.length; c++) {
        const fill = ws.getCell(r, c).fill as ExcelJS.FillPattern | undefined
        // Either no fill at all, or an explicitly white one — never a tint.
        if (fill?.fgColor?.argb) expect(fill.fgColor.argb).toBe('FFFFFFFF')
      }
    }
  })

  it('draws no left-edge border — the scaffolding that under-delivered is gone', () => {
    const { ws } = buildColourSheet('#9B0A6E')
    expect(ws.getCell(2, 1).border?.left).toBeUndefined()
  })

  it('falls back to the neutral dark band when a supplier has no colour', () => {
    const { ws } = buildColourSheet(null)
    const fill = ws.getCell(2, 1).fill as ExcelJS.FillPattern
    expect(fill.fgColor?.argb).toBe('FF2A2A2D')
    expect(ws.properties.tabColor).toBeUndefined()
  })

  // The rule must be formulaic, not tuned to the suppliers that happen to
  // need it today. A synthetic colour belonging to no real supplier proves
  // the computation generalises.
  it('darkens an arbitrary failing colour to clear 4.5:1, independent of any real supplier', () => {
    for (const synthetic of ['#FFFF00', '#00FF00', '#7FFFD4', '#FFC0CB', '#F5F5DC', '#FFFFFF']) {
      expect(contrastRatio('FFFFFFFF', synthetic)).toBeLessThan(4.5)
      const adjusted = darkenForWhiteText(synthetic)
      expect(contrastRatio('FFFFFFFF', adjusted)).toBeGreaterThanOrEqual(4.5)

      // Hue survives the adjustment (a pure grey has no hue to preserve).
      const before = rgbToHsl(synthetic)!
      const after = rgbToHsl(adjusted)!
      if (before.s > 0.01) expect(after.h).toBeCloseTo(before.h, 0)
    }
  })

  it('darkens no further than it must', () => {
    // HCL blue is 4.27:1 — just under. The result should be a nudge, not a
    // plunge to near-black.
    const adjusted = darkenForWhiteText('#1976F2')
    expect(contrastRatio('FFFFFFFF', adjusted)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('FFFFFFFF', adjusted)).toBeLessThan(5.5)
  })

  // The masthead is the one surface free to adjust its fill, so it is held to
  // full AA for every supplier without exception.
  it.each(LIVE_SUPPLIER_PALETTE)('renders $name\u2019s masthead title at AA', ({ colour }) => {
    const { ws } = buildColourSheet(colour)
    const masthead = `#${(ws.getCell(2, 1).fill as ExcelJS.FillPattern).fgColor?.argb?.slice(2)}`
    const titleInk = ws.getCell(2, 1).font?.color?.argb ?? 'FFFFFFFF'
    expect(contrastRatio(titleInk, masthead)).toBeGreaterThanOrEqual(4.5)
  })

  // The divider cannot adjust its fill — it must carry the TRUE brand colour
  // — so it takes the better of white and dark ink and lives with what that
  // colour allows. Eight of the nine clear AA; HCL's blue tops out at 4.27:1
  // with white (3.35:1 with dark), which is the accepted cost of showing the
  // authentic colour there rather than a darkened stand-in.
  it.each(LIVE_SUPPLIER_PALETTE)('picks the better ink for $name\u2019s divider', ({ colour }) => {
    const { ws, result } = buildColourSheet(colour)
    const dCell = ws.getCell(dividerRow(result), 8)
    const dividerFill = `#${(dCell.fill as ExcelJS.FillPattern).fgColor?.argb?.slice(2)}`
    const ink = dCell.font?.color?.argb ?? 'FFFFFFFF'

    const white = contrastRatio('FFFFFFFF', dividerFill)
    const dark = contrastRatio('FF2A2A2D', dividerFill)
    // Whatever was chosen IS the better of the two — never the worse one.
    expect(contrastRatio(ink, dividerFill)).toBeCloseTo(Math.max(white, dark), 6)
    expect(contrastRatio(ink, dividerFill)).toBeGreaterThanOrEqual(3)
  })

  it('clears full AA on the divider for every supplier except HCL', () => {
    // Pinned by name so the one exception is a known, reviewed fact rather
    // than something a future reader discovers in a file.
    const belowAA = LIVE_SUPPLIER_PALETTE.filter(({ colour }) => {
      const best = Math.max(
        contrastRatio('FFFFFFFF', colour),
        contrastRatio('FF2A2A2D', colour),
      )
      return best < 4.5
    }).map((s) => s.name)
    expect(belowAA).toEqual(['HCL'])
  })

  it.each(LIVE_SUPPLIER_PALETTE)('gives $name its exact true colour on the tab', ({ colour }) => {
    const { ws } = buildColourSheet(colour)
    expect(ws.properties.tabColor?.argb).toBe(`FF${colour.slice(1).toUpperCase()}`)
  })

  // The masthead's quiet lines — the eyebrow, the date range, the exported-at
  // stamp — are the defect a property test missed once already. They were a
  // literal grey chosen against the near-black default band, which collapsed
  // to 1.5:1 on a saturated brand fill while every assertion about them still
  // passed: each cell had exactly the colour the code said it should. Only the
  // rendered sheet showed it. These tests measure against the fill instead.
  const SECONDARY_CELLS: readonly [string, number, (colCount: number) => number][] = [
    ['eyebrow', 1, () => 1],
    ['date range', 2, (colCount) => Math.max(1, colCount - 2)],
    ['exported-at', 4, () => 1],
  ]

  it.each(LIVE_SUPPLIER_PALETTE)(
    'renders every secondary masthead line at AA for $name',
    ({ colour }) => {
      const { ws } = buildColourSheet(colour)
      const masthead = `#${(ws.getCell(2, 1).fill as ExcelJS.FillPattern).fgColor?.argb?.slice(2)}`
      for (const [, row, col] of SECONDARY_CELLS) {
        const cell = ws.getCell(row, col(SUPPLIER_SCHEDULE_COLUMNS.length))
        expect(cell.value).toBeTruthy()
        expect(contrastRatio(cell.font?.color?.argb ?? 'FFFFFFFF', masthead))
          .toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it('does not use the white-ground caption grey on a coloured masthead', () => {
    // #8F9495 is the footnote colour and belongs on white. Finding it on a
    // brand band means the fixed-grey rule has crept back in.
    const { ws } = buildColourSheet('#E2001A')
    for (const [, row, col] of SECONDARY_CELLS) {
      expect(ws.getCell(row, col(SUPPLIER_SCHEDULE_COLUMNS.length)).font?.color?.argb)
        .not.toBe('FF8F9495')
    }
  })

  it('still mutes secondary text where the band has contrast to spare', () => {
    // Navy has 13.6:1 of headroom, so the quiet lines must actually read as
    // quieter — if this ever equals the title ink, the muting has silently
    // degraded to "just use the ink" everywhere.
    const { ws } = buildColourSheet('#1A2B5B')
    const titleInk = ws.getCell(2, 1).font?.color?.argb
    const eyebrowInk = ws.getCell(1, 1).font?.color?.argb
    expect(titleInk).toBe('FFFFFFFF')
    expect(eyebrowInk).not.toBe(titleInk)
    expect(contrastRatio(eyebrowInk!, '#1A2B5B')).toBeGreaterThanOrEqual(4.5)
  })

  it('gives up muting rather than legibility on a band with no headroom', () => {
    // A fill where white only just clears AA has nothing to spend. Falling
    // back to the full ink is the intended degradation — the alternative is
    // an unreadable line.
    const tight = darkenForWhiteText('#FF8C00')
    expect(contrastRatio('FFFFFFFF', tight)).toBeLessThan(5)
    expect(mutedOnBand(tight, 'FFFFFFFF')).toBe('FFFFFFFF')
  })

  it('mutes the default dark band to within a shade of the old literal grey', () => {
    // The files that were already right must not visibly change. The computed
    // tone lands close enough to #8F9495 that the default band looks the same.
    const { ws } = buildColourSheet(null)
    const eyebrow = ws.getCell(1, 1).font?.color?.argb
    expect(contrastRatio(eyebrow!, '#2A2A2D')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(eyebrow!, '#8F9495')).toBeLessThan(1.2)
  })

  it('adjusts only the suppliers that need it — the rule discriminates', () => {
    const adjusted = LIVE_SUPPLIER_PALETTE.filter(
      (s) => darkenForWhiteText(s.colour).toUpperCase() !== s.colour.toUpperCase(),
    ).map((s) => s.name)
    // Happy Team, Lean Tree and HCL fail 4.5:1 against white; the rest pass.
    expect(adjusted).toEqual(['Happy Team', 'Lean Tree', 'HCL'])
  })
})

describe('Team Schedule takes no supplier colour treatment', () => {
  it('keeps the neutral dark masthead — a team has no owning supplier', () => {
    const { ws } = buildTeamSheet()
    const fill = ws.getCell(2, 1).fill as ExcelJS.FillPattern
    expect(fill.fgColor?.argb).toBe('FF2A2A2D')
    expect(ws.getCell(2, 1).font?.color?.argb).toBe('FFFFFFFF')
  })

  it('sets no Excel tab colour', () => {
    const { ws } = buildTeamSheet()
    expect(ws.properties.tabColor).toBeUndefined()
  })

  it('never passes a supplier colour through its sheet module', () => {
    const source = readFileSync(new URL('../teamScheduleSheet.ts', import.meta.url), 'utf8')
    expect(source).not.toContain('supplierColour')
    expect(source).not.toContain('darkenForWhiteText')
  })
})
