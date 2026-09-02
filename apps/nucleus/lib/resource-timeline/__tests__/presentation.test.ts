import { describe, expect, it } from 'vitest'
import type { TimelineResource, TimelineSegment } from '@plato/schema'
import {
  buildGroups,
  buildQuarterSpans,
  disciplineRank,
  filterResources,
  formatMonthLabel,
  memberInGroup,
  percentOf,
  resolveAvatarColours,
  segmentGeometry,
  segmentLabel,
  sortForTeamView,
  supplierStripe,
  supplierTint,
  weekLinePositions,
} from '../presentation'

const WINDOW_START = '2026-07-01'
const WINDOW_END = '2026-12-31'

function seg(overrides: Partial<TimelineSegment> = {}): TimelineSegment {
  return {
    supplier: 'CG',
    code: 'REG',
    start: '2026-07-01',
    end: '2026-09-30',
    realStart: false,
    realEnd: true,
    tentative: false,
    flag: null,
    commercialStartMismatch: null,
    ...overrides,
  }
}

function resource(overrides: Partial<TimelineResource> = {}): TimelineResource {
  return {
    resourceId: 'r1',
    name: 'Test Person',
    initials: 'TP',
    discipline: 'Quality Assurance',
    teams: [{ teamName: 'Sagan', capacitySplit: 1 }],
    status: 'incumbent',
    category: null,
    categoryLabel: 'Not part of Dudley transition',
    segments: [seg()],
    gaps: [],
    joiningDate: null,
    notes: null,
    ...overrides,
  }
}

describe('disciplineRank / sortForTeamView', () => {
  it('ranks the role taxonomy PO → analyst → architect → engineer → QA', () => {
    expect(disciplineRank('Delivery Management')).toBeLessThan(disciplineRank('Analysis'))
    expect(disciplineRank('Analysis')).toBeLessThan(disciplineRank('Architecture'))
    expect(disciplineRank('Architecture')).toBeLessThan(disciplineRank('Backend Engineering'))
    expect(disciplineRank('Backend Engineering')).toBeLessThan(disciplineRank('Quality Assurance'))
  })

  it('puts unknown and missing disciplines last', () => {
    expect(disciplineRank('Something New')).toBeGreaterThan(disciplineRank('Quality Assurance'))
    expect(disciplineRank(null)).toBeGreaterThan(disciplineRank('Quality Assurance'))
  })

  it('sorts by tier, then alphabetically within a tier', () => {
    const sorted = sortForTeamView([
      resource({ name: 'Zoe QA', discipline: 'Quality Assurance' }),
      resource({ name: 'Bob Backend', discipline: 'Backend Engineering' }),
      resource({ name: 'Alice Delivery', discipline: 'Delivery Management' }),
      resource({ name: 'Aaron Backend', discipline: 'Frontend Engineering' }),
    ])

    expect(sorted.map((r) => r.name)).toEqual([
      'Alice Delivery',
      'Aaron Backend',
      'Bob Backend',
      'Zoe QA',
    ])
  })
})

describe('filterResources', () => {
  const base = {
    groupBy: 'team' as const,
    activeSuppliers: new Set(['CG', 'TCS']),
    secondaryFilter: '',
    transitionOnly: false,
  }

  it('drops a resource with no segment under an active supplier', () => {
    const people = [resource({ segments: [seg({ supplier: 'EPAM' })] }), resource()]
    expect(filterResources(people, base)).toHaveLength(1)
  })

  it('cross-filters by skillset in Team view', () => {
    const people = [
      resource({ name: 'A', discipline: 'Quality Assurance' }),
      resource({ name: 'B', discipline: 'Architecture' }),
    ]

    const filtered = filterResources(people, { ...base, secondaryFilter: 'Architecture' })
    expect(filtered.map((r) => r.name)).toEqual(['B'])
  })

  it('cross-filters by team in Skillset view', () => {
    const people = [
      resource({ name: 'A', teams: [{ teamName: 'Sagan', capacitySplit: 1 }] }),
      resource({ name: 'B', teams: [{ teamName: 'Orion', capacitySplit: 1 }] }),
    ]

    const filtered = filterResources(people, {
      ...base,
      groupBy: 'discipline',
      secondaryFilter: 'Orion',
    })
    expect(filtered.map((r) => r.name)).toEqual(['B'])
  })

  it('restricts to people actually in transition when asked', () => {
    const people = [
      resource({ name: 'Incumbent', status: 'incumbent' }),
      resource({ name: 'Mover', status: 'mover' }),
      resource({ name: 'Joiner', status: 'joiner' }),
    ]

    const filtered = filterResources(people, { ...base, transitionOnly: true })
    expect(filtered.map((r) => r.name)).toEqual(['Mover', 'Joiner'])
  })
})

describe('buildGroups', () => {
  it('drops empty groups and relabels a bare Unassigned', () => {
    const people = [resource({ teams: [{ teamName: 'Unassigned', capacitySplit: 1 }] })]
    const groups = buildGroups(people, ['Sagan', 'Unassigned'], 'team')

    expect(groups).toHaveLength(1)
    expect(groups[0]?.displayName).toBe('Unassigned — F_Gov / Overheads')
  })

  it('applies role-taxonomy order only in Team view', () => {
    const people = [
      resource({ name: 'Zoe QA', discipline: 'Quality Assurance' }),
      resource({ name: 'Alice Delivery', discipline: 'Delivery Management' }),
    ]

    expect(buildGroups(people, ['Sagan'], 'team')[0]?.resources.map((r) => r.name)).toEqual([
      'Alice Delivery',
      'Zoe QA',
    ])

    const byDiscipline = buildGroups(people, ['Not part of Dudley transition'], 'category')
    expect(byDiscipline[0]?.resources.map((r) => r.name)).toEqual(['Zoe QA', 'Alice Delivery'])
  })

  it('places a split resource in every one of its teams', () => {
    const person = resource({
      teams: [
        { teamName: 'Sagan', capacitySplit: 0.5 },
        { teamName: 'Orion', capacitySplit: 0.5 },
      ],
    })

    expect(memberInGroup(person, 'Sagan', 'team')).toBe(true)
    expect(memberInGroup(person, 'Orion', 'team')).toBe(true)
    expect(buildGroups([person], ['Sagan', 'Orion'], 'team')).toHaveLength(2)
  })
})

describe('geometry', () => {
  it('maps the window edges to 0 and 100', () => {
    expect(percentOf(WINDOW_START, WINDOW_START, WINDOW_END)).toBe(0)
    expect(percentOf(WINDOW_END, WINDOW_START, WINDOW_END)).toBe(100)
  })

  it('clamps dates outside the window', () => {
    expect(percentOf('2026-01-01', WINDOW_START, WINDOW_END)).toBe(0)
    expect(percentOf('2027-06-01', WINDOW_START, WINDOW_END)).toBe(100)
  })

  it('gives a zero-length segment a visible minimum width', () => {
    const { width } = segmentGeometry(
      seg({ start: '2026-08-13', end: '2026-08-13' }),
      WINDOW_START,
      WINDOW_END,
    )
    expect(width).toBeGreaterThan(0)
  })
})

describe('weekLinePositions', () => {
  it('snaps to the first real Monday, not a 7-day slice from windowStart', () => {
    // 2026-07-01 is a Wednesday — the first week line must land on the
    // following Monday (2026-07-06), not 7 days after windowStart.
    const positions = weekLinePositions(WINDOW_START, WINDOW_END)
    expect(positions[0]).toBeCloseTo(percentOf('2026-07-06', WINDOW_START, WINDOW_END), 5)
  })

  it('excludes windowStart itself when it already falls on a Monday', () => {
    // 2026-07-06 is a Monday — a line exactly at 0% (the row's own edge)
    // would add nothing, so it must be skipped.
    const positions = weekLinePositions('2026-07-06', '2026-08-03')
    expect(positions[0]).not.toBe(0)
    expect(positions.every((p) => p > 0)).toBe(true)
  })

  it('produces one line per real calendar week, strictly increasing', () => {
    const positions = weekLinePositions(WINDOW_START, WINDOW_END)
    // 184 days between windowStart and windowEnd, so roughly 26 week lines.
    expect(positions.length).toBeGreaterThan(24)
    expect(positions.length).toBeLessThan(28)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1])
    }
  })

  it('never returns a boundary line at 0% or 100%', () => {
    const positions = weekLinePositions(WINDOW_START, WINDOW_END)
    expect(positions.every((p) => p > 0 && p < 100)).toBe(true)
  })

  it('returns nothing for a zero-or-negative-length window', () => {
    expect(weekLinePositions(WINDOW_START, WINDOW_START)).toEqual([])
    expect(weekLinePositions(WINDOW_END, WINDOW_START)).toEqual([])
  })
})

describe('segmentLabel', () => {
  it('prints both dates when both boundaries are real', () => {
    const label = segmentLabel(
      seg({ supplier: 'CG', code: 'NPC', start: '2026-10-01', end: '2026-10-30', realStart: true }),
    )
    expect(label).toEqual({ text: 'CG Hypercare', dates: '1 Oct–30 Oct' })
  })

  it('prints only the real boundary and never the window edge', () => {
    // Q2 block: 1 Jul is the window edge, 13 Aug is a real last working day.
    expect(segmentLabel(seg({ end: '2026-08-13' })).dates).toBe('to 13 Aug')

    // Ongoing Q3 cover: 31 Dec is the window edge, not an end date.
    expect(
      segmentLabel(seg({ start: '2026-10-12', realStart: true, realEnd: false })).dates,
    ).toBe('from 12 Oct')
  })

  it('prints no date when neither boundary is real', () => {
    expect(segmentLabel(seg({ realStart: false, realEnd: false })).dates).toBe('')
  })
})

describe('formatMonthLabel', () => {
  it('renders a short month and two-digit year', () => {
    expect(formatMonthLabel('2026-07-01')).toBe("Jul '26")
    expect(formatMonthLabel('2026-12-01')).toBe("Dec '26")
  })
})

describe('buildQuarterSpans', () => {
  const MONTHS = ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01']

  it('splits the six months into two three-month quarter spans', () => {
    const spans = buildQuarterSpans(MONTHS, '2026-10-01', 'Q2 FY 26/27', 'Q3 FY 26/27')

    expect(spans).toEqual([
      { label: 'Q2 FY 26/27', months: ['2026-07-01', '2026-08-01', '2026-09-01'] },
      { label: 'Q3 FY 26/27', months: ['2026-10-01', '2026-11-01', '2026-12-01'] },
    ])
  })

  it('splits on the real boundary rather than assuming an even split', () => {
    // A hypothetical 4/2 split — the boundary, not month count, decides.
    const spans = buildQuarterSpans(MONTHS, '2026-11-01', 'Q2 FY 26/27', 'Q3 FY 26/27')

    expect(spans[0]).toEqual({
      label: 'Q2 FY 26/27',
      months: ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'],
    })
    expect(spans[1]).toEqual({ label: 'Q3 FY 26/27', months: ['2026-11-01', '2026-12-01'] })
  })

  it('omits a quarter with no months in the window rather than rendering an empty span', () => {
    const allGranular = buildQuarterSpans(
      ['2026-10-01', '2026-11-01', '2026-12-01'],
      '2026-10-01',
      'Q2 FY 26/27',
      'Q3 FY 26/27',
    )
    expect(allGranular).toEqual([
      { label: 'Q3 FY 26/27', months: ['2026-10-01', '2026-11-01', '2026-12-01'] },
    ])
  })

  it('returns nothing for an empty month list', () => {
    expect(buildQuarterSpans([], '2026-10-01', 'Q2 FY 26/27', 'Q3 FY 26/27')).toEqual([])
  })
})

describe('supplier colour', () => {
  it('produces a hex-alpha tint rather than a browser-dependent blend', () => {
    expect(supplierTint('#003C82')).toBe('#003C822e')
    expect(supplierStripe('#003C82')).toBe('#003C824d')
  })

  it('passes through a value it cannot parse', () => {
    expect(supplierTint('rebeccapurple')).toBe('rebeccapurple')
  })
})

describe('resolveAvatarColours', () => {
  const SUPPLIER_COLOURS = new Map([
    ['CG', '#003C82'],
    ['TCS', '#9B0A6E'],
  ])

  // Real derived geometry for these four (verified against the DB in the
  // schema package's dudleyCohort fixture) — not fabricated shapes.
  it('splits Nikhil Vibhav (CG hypercare then a tentative TCS start)', () => {
    const person = resource({
      status: 'mover_doj_tbc',
      segments: [
        seg({ supplier: 'CG', code: 'REG', start: '2026-07-01', end: '2026-09-30' }),
        seg({ supplier: 'CG', code: 'NPC', start: '2026-10-01', end: '2026-10-30' }),
        seg({ supplier: 'TCS', code: 'REG', start: '2026-12-01', end: '2026-12-31', tentative: true }),
      ],
    })

    expect(resolveAvatarColours(person, SUPPLIER_COLOURS)).toEqual({
      mode: 'split',
      fromColour: '#003C82',
      toColour: '#9B0A6E',
    })
  })

  it('keeps Prapti Verma solid — a TCS incumbent, never at CG', () => {
    const person = resource({
      status: 'incumbent',
      segments: [
        seg({ supplier: 'TCS', code: 'REG', start: '2026-07-01', end: '2026-09-30' }),
        seg({ supplier: 'TCS', code: 'REG', start: '2026-10-01', end: '2026-12-31', realStart: true }),
      ],
    })

    expect(resolveAvatarColours(person, SUPPLIER_COLOURS)).toEqual({ mode: 'solid', colour: '#9B0A6E' })
  })

  it('keeps Praneetha Bandlamudi solid — a CG roll-off with no successor', () => {
    const person = resource({
      status: 'rolledoff',
      segments: [seg({ supplier: 'CG', code: 'REG', start: '2026-07-01', end: '2026-09-06' })],
    })

    expect(resolveAvatarColours(person, SUPPLIER_COLOURS)).toEqual({ mode: 'solid', colour: '#003C82' })
  })

  it('keeps Bharat Patil solid — CG hypercare only, never reaches a second supplier', () => {
    // The one case the fix prompt specifically calls out: hypercare being a
    // visually distinct segment type must NOT be mistaken for a supplier
    // change. Both segments here are CG, so this must not split.
    const person = resource({
      status: 'rolledoff_hypercare',
      segments: [
        seg({ supplier: 'CG', code: 'REG', start: '2026-07-01', end: '2026-09-30' }),
        seg({ supplier: 'CG', code: 'NPC', start: '2026-10-01', end: '2026-10-30' }),
      ],
    })

    expect(resolveAvatarColours(person, SUPPLIER_COLOURS)).toEqual({ mode: 'solid', colour: '#003C82' })
  })

  it('generalises beyond CG/TCS — any two distinct suppliers split', () => {
    const person = resource({
      status: 'mover',
      segments: [
        seg({ supplier: 'HT', code: 'REG', start: '2026-07-01', end: '2026-09-30' }),
        seg({ supplier: 'NH', code: 'REG', start: '2026-10-01', end: '2026-12-31' }),
      ],
    })

    expect(resolveAvatarColours(person, new Map([['HT', '#FF8C00'], ['NH', '#1A2B5B']]))).toEqual({
      mode: 'split',
      fromColour: '#FF8C00',
      toColour: '#1A2B5B',
    })
  })

  it('falls back to a neutral colour for an unknown supplier abbreviation', () => {
    const person = resource({ segments: [seg({ supplier: 'ZZZ' })] })
    expect(resolveAvatarColours(person, SUPPLIER_COLOURS)).toEqual({ mode: 'solid', colour: '#8F9495' })
  })

  it('falls back to a neutral solid colour when a resource has no segments', () => {
    expect(resolveAvatarColours(resource({ segments: [] }), SUPPLIER_COLOURS)).toEqual({
      mode: 'solid',
      colour: '#8F9495',
    })
  })
})
