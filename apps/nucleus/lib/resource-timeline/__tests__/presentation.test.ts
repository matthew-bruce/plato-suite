import { describe, expect, it } from 'vitest'
import type { TimelineResource, TimelineSegment } from '@plato/schema'
import {
  buildGroups,
  disciplineRank,
  filterResources,
  formatMonthLabel,
  memberInGroup,
  percentOf,
  segmentGeometry,
  segmentLabel,
  sortForTeamView,
  supplierStripe,
  supplierTint,
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

describe('supplier colour', () => {
  it('produces a hex-alpha tint rather than a browser-dependent blend', () => {
    expect(supplierTint('#003C82')).toBe('#003C822e')
    expect(supplierStripe('#003C82')).toBe('#003C824d')
  })

  it('passes through a value it cannot parse', () => {
    expect(supplierTint('rebeccapurple')).toBe('rebeccapurple')
  })
})
