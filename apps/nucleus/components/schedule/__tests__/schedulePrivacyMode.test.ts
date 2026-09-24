// Source-content regression tests for the Edit-mode Privacy Mode gap: Day
// Rate, Base and +VAT (and the other cells found sharing the same "is this
// cell sensitive" oversight during the sweep) rendered fully visible and
// editable in Edit mode regardless of Privacy Mode.
//
// There is no DOM-rendering test setup for this codebase's React components
// (no jsdom/testing-library — see the equivalent note in
// lib/resource-timeline/__tests__/exportHtml.test.ts, which pins its own
// generated/source markup the same way), so these pin the relevant source
// text directly, the same technique that file's "styling stays in sync"
// suite already uses on a live .module.css file.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = fileURLToPath(new URL('.', import.meta.url))
const source = readFileSync(new URL('../SchedulePageClient.tsx', `file://${testDir}`), 'utf8')

/** Text between two anchor comments/markers, exclusive of the markers themselves. */
function between(text: string, start: string, end: string): string {
  const startIdx = text.indexOf(start)
  if (startIdx === -1) throw new Error(`Start marker not found: ${start}`)
  const from = startIdx + start.length
  const endIdx = text.indexOf(end, from)
  if (endIdx === -1) throw new Error(`End marker not found: ${end}`)
  return text.slice(from, endIdx)
}

describe('AllocationRow edit-mode cells respect Privacy Mode', () => {
  // Isolate just the editingSchedule return branch, not the read-only one
  // below it, so a false pass can't come from the non-edit rendering (which
  // was never the bug) instead of the edit-mode one (which was).
  const editingBranch = between(source, 'if (editingSchedule) {', 'return (\n    <div\n      className={`${styles.allocationRow} ${styles.scheduleRow}`}')

  it('Day Rate becomes a blurred, read-only figure under Privacy Mode instead of a live input', () => {
    const dayRateCell = between(editingBranch, '{/* 10 Day Rate', '{/* 11 Base')
    expect(dayRateCell).toContain('isPrivate ? (')
    expect(dayRateCell).toContain('formatMoney(row.day_rate, { decimals: 2 })')
    expect(dayRateCell).toContain('...blurStyle')
  })

  it('Base applies the blur in edit mode, same as outside it', () => {
    const baseCell = between(editingBranch, '{/* 11 Base', '{/* 12 +VAT')
    expect(baseCell).toContain('...blurStyle')
  })

  it('+VAT drops the checkbox and blurs the figure under Privacy Mode', () => {
    const vatCell = between(editingBranch, '{/* 12 +VAT', '{/* 13 Confirmed')
    expect(vatCell).toContain('isPrivate ? (')
    expect(vatCell).toContain('...blurStyle')
  })
})

describe('other edit-mode money inputs found sharing the same gap', () => {
  it('AdHocRow (Ad-hoc Quarterly Expenses "Edit items") blurs its amount input under Privacy Mode', () => {
    const fn = between(source, 'function AdHocRow(', 'function BandTotal(')
    // Isolate the editing-mode return (after the `if (!editing) { ... }`
    // early return above it) so a pass can't come from the read-only render.
    const editingReturn = fn.slice(fn.indexOf('return (\n    <div\n      className={styles.scheduleRow}'))
    expect(editingReturn).toContain('isPrivate ? (')
    expect(editingReturn).toContain('formatMoney(item.amount_pence)')
  })

  it('EtpSsEditRow (ETP & Shared Services "Edit items") has Privacy Mode handling at all, and blurs its amount input', () => {
    const fn = between(source, 'function EtpSsEditRow(', 'function AdHocRow(')
    expect(fn).toContain('usePrivacyMode()')
    expect(fn).toContain('isPrivate ? (')
    expect(fn).toContain('formatMoney(item.amount_pence)')
  })

  it("AppliedBlendedRateCard's own inline rate editor cannot be opened while Privacy Mode is on", () => {
    const fn = between(source, 'function AppliedBlendedRateCard(', 'function KpiCard(')
    expect(fn).toContain('if (editState.kind === \'locked\' || isPrivate) return')
  })

  it('the Advised Blended Rate KPI card is blurred, closing the one summary card that was never wired up', () => {
    const fn = between(source, 'function KpiStrip(', 'function AppliedBlendedRateCard(')
    const card = between(fn, 'label="Advised Blended Rate"', '/>')
    expect(card).toContain('blur={isPrivate}')
  })

  it('the team run-rate bar blurs its cost figures — it had no Privacy Mode handling at all before', () => {
    const fn = between(source, 'function TeamRunRateBar(', 'const HEADERS')
    expect(fn).toContain('usePrivacyMode()')
    expect(fn.match(/blurStyle/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
  })
})
