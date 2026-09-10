import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { toArgb, squareRich } from '../richText'

/* ══════════════════════════════════════════════════════════════════════
   The exported workbook's rich-text runs (a coloured square + label in one
   cell) carried a double alpha-prefix bug: squareRich() unconditionally
   prepended "FF" to whatever colour it was given. That's correct for a bare
   6-digit RGB value, but the Planview Code Split rows pass a colour that is
   ALREADY an 8-digit ARGB literal (e.g. 'FF1B5E20', from the planviewRows
   table in route.ts) — prepending "FF" again produced a 10-character value
   ("FFFF1B5E20"), invalid OOXML that Excel tolerates but openpyxl and
   markitdown both refuse to open.
══════════════════════════════════════════════════════════════════════ */

describe('toArgb', () => {
  it('prefixes a bare 6-digit hex with FF', () => {
    expect(toArgb('#0D47A1')).toBe('FF0D47A1')
    expect(toArgb('0D47A1')).toBe('FF0D47A1')
  })

  it('leaves an already-prefixed 8-digit ARGB value alone — no double prefix', () => {
    // This is the exact case that broke: an 8-digit literal like the
    // planviewRows table's 'FF1B5E20' passed straight through, not
    // "FF" + "FF1B5E20".
    expect(toArgb('FF1B5E20')).toBe('FF1B5E20')
    expect(toArgb('FF0D47A1')).toBe('FF0D47A1')
  })

  it('always returns exactly 8 uppercase hex characters, never 10', () => {
    const inputs = ['#0D47A1', '0D47A1', 'FF1B5E20', '#FF1B5E20', 'e2001a', '#e2001a']
    for (const input of inputs) {
      const result = toArgb(input)
      expect(result).toMatch(/^[0-9A-F]{8}$/)
    }
  })

  it('is case-insensitive and normalises to upper case', () => {
    expect(toArgb('ff1b5e20')).toBe('FF1B5E20')
    expect(toArgb('#0d47a1')).toBe('FF0D47A1')
  })

  it('falls back to a safe default for anything unrecognisable, rather than emitting invalid XML', () => {
    expect(toArgb('not-a-colour')).toBe('FF888888')
    expect(toArgb('')).toBe('FF888888')
    expect(toArgb('12345')).toBe('FF888888') // 5 hex chars — neither valid shape
  })
})

describe('squareRich', () => {
  it('normalises both the square colour and the text colour', () => {
    // Mirrors route.ts's actual call for a Planview Code Split row:
    // squareRich(pv.font, pv.label, pv.font) — the same already-8-digit
    // value passed as both the square colour and the text colour.
    const value = squareRich('FF1B5E20', 'PR  Platform Request', 'FF1B5E20')
    expect(value.richText[0].font.color.argb).toBe('FF1B5E20')
    expect(value.richText[1].font.color.argb).toBe('FF1B5E20')
    for (const run of value.richText) {
      expect(run.font.color.argb).toMatch(/^[0-9A-F]{8}$/)
    }
  })

  it('normalises a bare supplier hex too', () => {
    const value = squareRich('#003C82', 'Capgemini', 'FF2A2A2D')
    expect(value.richText[0].font.color.argb).toBe('FF003C82')
    expect(value.richText[1].font.color.argb).toBe('FF2A2A2D')
  })
})

/* ══════════════════════════════════════════════════════════════════════
   The check that would have caught this originally: actually open the
   generated file with openpyxl, not just inspect the string in isolation.
   Best-effort — skipped (not failed) when python3/openpyxl aren't present
   in the environment running the suite, since that's outside this repo's
   control.
══════════════════════════════════════════════════════════════════════ */

function openpyxlAvailable(): boolean {
  try {
    execFileSync('python3', ['-c', 'import openpyxl'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

describe.skipIf(!openpyxlAvailable())('the generated file opens cleanly in openpyxl', () => {
  it('a workbook using squareRich exactly as route.ts does loads without error', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Summary')

    // The exact bug-reproducing call: an already-8-digit ARGB colour passed
    // as both the square and the text colour, as route.ts's Planview Code
    // Split rows do (squareRich(pv.font, pv.label, pv.font)).
    ws.getCell(1, 1).value = squareRich('FF1B5E20', 'PR  Platform Request — recoverable', 'FF1B5E20')
    ws.getCell(2, 1).value = squareRich('FF0D47A1', 'F_Gov  Factory Governance', 'FF0D47A1')
    ws.getCell(3, 1).value = squareRich('FF888888', 'BAU  Business as Usual', 'FF888888')

    // And the supplier-square call: a bare "#RRGGBB" as the square colour,
    // a fixed 8-digit literal as the text colour.
    ws.getCell(4, 1).value = squareRich('#003C82', 'Capgemini', 'FF2A2A2D')

    const dir = mkdtempSync(join(tmpdir(), 'richtext-test-'))
    const path = join(dir, 'rich-text-check.xlsx')
    try {
      const buffer = await wb.xlsx.writeBuffer()
      await writeFile(path, Buffer.from(buffer as ArrayBuffer))

      // Fails (non-zero exit / thrown) on invalid OOXML, exactly as it did
      // against the unfixed file — this is the same check that first
      // surfaced the bug.
      expect(() =>
        execFileSync('python3', [
          '-c',
          `from openpyxl import load_workbook; wb = load_workbook(${JSON.stringify(path)}); assert wb['Summary']['A1'].value is not None`,
        ]),
      ).not.toThrow()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
