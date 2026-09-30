// Source scan: the native engine must not know any supplier, any date, or the
// tentative column (settled rules 8 and 12). Checked against the source text
// itself so a hardcoded rule can't slip in through a path the unit tests
// happen not to exercise.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
}

const ENGINE = read('../engagementEngine.ts')

/** The native builder only — the same file also holds the legacy one. */
const BUILDER = (() => {
  const source = read('../../../queries/resourceTimelineBuild.ts')
  const start = source.indexOf('export function buildEngagementTimeline')
  expect(start).toBeGreaterThan(-1)
  return source.slice(start)
})()

const SOURCES: [string, string][] = [
  ['engagementEngine.ts', ENGINE],
  ['buildEngagementTimeline', BUILDER],
]

const SUPPLIER_NAMES = [
  'CG',
  'TCS',
  'RMG',
  'EPAM',
  'HT',
  'HCL',
  'NH',
  'LT',
  'TAAS',
  'Capgemini',
  'Tata',
  'Royal Mail',
  'Happy Team',
  'North Highland',
  'Lean Tree',
]

describe.each(SOURCES)('%s', (_label, source) => {
  it('contains no ISO date literal', () => {
    expect(source.match(/\d{4}-\d{2}-\d{2}/g) ?? []).toEqual([])
  })

  it('contains no supplier name', () => {
    const found = SUPPLIER_NAMES.filter((name) => new RegExp(`\\b${name}\\b`).test(source))
    expect(found).toEqual([])
  })

  it('never references roll_on_tentative', () => {
    expect(source).not.toMatch(/roll_?on_?tentative/i)
  })

  it('never reads roll_on_estimated', () => {
    expect(source).not.toMatch(/roll_?on_?estimated/i)
  })
})
