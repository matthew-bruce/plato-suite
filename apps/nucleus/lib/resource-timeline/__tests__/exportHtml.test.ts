import { describe, expect, it } from 'vitest'
import type { ResourceTimelineData, TimelineResource } from '@plato/schema'
import { buildStandaloneHtml } from '../exportHtml'

function resource(overrides: Partial<TimelineResource> = {}): TimelineResource {
  return {
    resourceId: 'r1',
    name: 'Dipti Borole',
    initials: 'DB',
    discipline: 'Quality Assurance',
    teams: [{ teamName: 'Orion', capacitySplit: 1 }],
    status: 'mover',
    category: 'transitioned',
    categoryLabel: 'Transitioned to TCS',
    segments: [
      {
        supplier: 'CG',
        code: 'REG',
        start: '2026-07-01',
        end: '2026-09-29',
        realStart: false,
        realEnd: true,
        tentative: false,
        flag: null,
        commercialStartMismatch: null,
      },
      {
        supplier: 'TCS',
        code: 'REG',
        start: '2026-10-12',
        end: '2026-12-31',
        realStart: true,
        realEnd: false,
        tentative: false,
        flag: null,
        commercialStartMismatch: null,
      },
    ],
    gaps: [{ start: '2026-09-29', end: '2026-10-12' }],
    joiningDate: '2026-10-05',
    notes: null,
    ...overrides,
  }
}

function data(overrides: Partial<ResourceTimelineData> = {}): ResourceTimelineData {
  return {
    windowStart: '2026-07-01',
    windowEnd: '2026-12-31',
    months: [
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
    ],
    resources: [resource()],
    suppliers: [
      { abbreviation: 'CG', name: 'Capgemini', colour: '#003C82', sortOrder: 4 },
      { abbreviation: 'TCS', name: 'Tata Consultancy Services', colour: '#9B0A6E', sortOrder: 5 },
    ],
    teams: ['Orion'],
    disciplines: ['Quality Assurance'],
    coarsePeriodName: 'Q2 FY 26/27',
    granularPeriodName: 'Q3 FY 26/27',
    ...overrides,
  }
}

const OPTIONS = {
  groupBy: 'team',
  activeSuppliers: ['CG', 'TCS'],
  transitionOnly: false,
  generatedAt: new Date('2026-08-16T09:00:00Z'),
}

describe('buildStandaloneHtml', () => {
  it('produces a complete standalone document', () => {
    const html = buildStandaloneHtml(data(), OPTIONS)

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html.trimEnd().endsWith('</html>')).toBe(true)
    expect(html).toContain('<style>')
    expect(html).toContain('<script>')
  })

  it('makes no external requests — the file must work with no network', () => {
    const html = buildStandaloneHtml(data(), OPTIONS)

    expect(html).not.toMatch(/<script[^>]+src=/i)
    expect(html).not.toMatch(/<link[^>]+stylesheet/i)
    expect(html).not.toMatch(/https?:\/\/(?!placeholder)/)
    expect(html).not.toMatch(/@import/i)
  })

  it('bakes in the derived segments rather than raw rows', () => {
    const html = buildStandaloneHtml(data(), OPTIONS)

    expect(html).toContain('2026-10-12')
    expect(html).toContain('Dipti Borole')
    // Derived, post-computation data — no allocation or period identifiers.
    expect(html).not.toContain('allocation_id')
    expect(html).not.toContain('monthlyDays')
  })

  it('carries the supplier palette so no colour maths runs in the export', () => {
    const html = buildStandaloneHtml(data(), OPTIONS)

    expect(html).toContain('#003C82')
    expect(html).toContain('#003C822e')
  })

  it('escapes a name that would otherwise break out of the script block', () => {
    const html = buildStandaloneHtml(
      data({ resources: [resource({ name: '</script><img src=x onerror=alert(1)>' })] }),
      OPTIONS,
    )

    // The literal closing tag must not survive into the document.
    expect(html).not.toContain('</script><img')
    expect(html).toContain('\\u003c/script')
  })

  it('escapes markup in period names interpolated into the title', () => {
    const html = buildStandaloneHtml(
      data({ coarsePeriodName: 'Q2 <b>FY</b>' }),
      OPTIONS,
    )

    expect(html).toContain('Q2 &lt;b&gt;FY&lt;/b&gt;')
    expect(html).not.toContain('<title>Resource Timeline — Q2 <b>')
  })

  it('preserves the filter state the export was taken with', () => {
    const html = buildStandaloneHtml(data(), {
      ...OPTIONS,
      groupBy: 'category',
      activeSuppliers: ['CG'],
      transitionOnly: true,
    })

    expect(html).toContain('"groupBy":"category"')
    expect(html).toContain('"activeSuppliers":["CG"]')
    expect(html).toContain('"transitionOnly":true')
  })

  it('records when the snapshot was taken so it cannot be mistaken for live', () => {
    const html = buildStandaloneHtml(data(), OPTIONS)

    // Recorded via the header badge, not the (removed, round 3) footer copy.
    expect(html).toContain('16 August 2026')
    expect(html).toContain('snapshot-badge')
  })

  it('has no footer info boxes (Fix 1, round 3)', () => {
    const html = buildStandaloneHtml(data(), OPTIONS)

    expect(html).not.toContain('Standalone snapshot.')
    expect(html).not.toContain('Dates in bars')
    expect(html).not.toContain('class="footer"')
    expect(html).not.toContain('footer-note')
  })

  it('renders the export title in the sans-serif body font, not the site-wide display font (Fix 3, round 3)', () => {
    const html = buildStandaloneHtml(data(), OPTIONS)

    expect(html).toContain('.title-row h1{font-family:var(--rmg-font-body)')
    expect(html).not.toContain('.title-row h1{font-family:var(--rmg-font-display)')
  })

  it('has no legend row markup, CSS, or builder (Fix 2, round 2)', () => {
    const html = buildStandaloneHtml(data(), OPTIONS)

    expect(html).not.toContain('legend-bar')
    expect(html).not.toContain('leg-pill')
    expect(html).not.toContain('buildLegend')
  })

  it('renders the toolbar as a red primary row + grey filter row (Fix 1)', () => {
    const html = buildStandaloneHtml(data(), OPTIONS)

    expect(html).toContain('toolbar-primary')
    expect(html).toContain('toolbar-filter')
    expect(html).toContain('background:var(--rmg-color-red)')
  })

  it('includes an expand/collapse-all control (Fix 3)', () => {
    const html = buildStandaloneHtml(data(), OPTIONS)

    expect(html).toContain('expandAllBtn')
    expect(html).toContain('toggleAllGroups')
    expect(html).toContain('allGroupsExpanded')
  })

  it('computes avatar colour from segment history for the split treatment (Fix 4)', () => {
    const html = buildStandaloneHtml(data(), OPTIONS)

    expect(html).toContain('function avatarColour(r)')
    expect(html).toContain('avatar-split')
    expect(html).toContain('conic-gradient(from 180deg')
  })

  it('renders the group header as plain text, not a pill (Fix 5)', () => {
    const html = buildStandaloneHtml(data(), OPTIONS)

    expect(html).toContain('group-header-text')
    expect(html).not.toContain('group-name-pill')
  })
})
