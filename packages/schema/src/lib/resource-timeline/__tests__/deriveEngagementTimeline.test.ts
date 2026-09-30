import { describe, expect, it } from 'vitest'
import {
  classifyEngagements,
  deriveEngagementTimeline,
  engagementGaps,
  windowSuppliers,
  type EngineAllocation,
  type EngineEngagement,
  type EngagementTimelineInput,
} from '../engagementEngine'

const Q2 = { periodId: 'q2', start: '2026-07-01', end: '2026-09-30' }
const Q3 = { periodId: 'q3', start: '2026-10-01', end: '2026-12-31' }
const WINDOW = { start: Q2.start, end: Q3.end }
const HOLIDAYS = ['2026-08-31', '2026-12-25', '2026-12-28']

function eng(overrides: Partial<EngineEngagement> & Pick<EngineEngagement, 'engagementId' | 'supplier'>): EngineEngagement {
  return { resourceId: 'r1', rollOnDate: '2026-01-01', rollOffDate: null, ...overrides }
}

function alloc(overrides: Partial<EngineAllocation> & Pick<EngineAllocation, 'engagementId' | 'periodId'>): EngineAllocation {
  return { allocationId: `${overrides.engagementId}-${overrides.periodId}`, resourceId: 'r1', code: 'REG', monthlyDays: {}, capacityDays: null, ...overrides }
}

function run(partial: Partial<EngagementTimelineInput>) {
  const out = deriveEngagementTimeline({
    engagements: [],
    allocations: [],
    periods: [Q2, Q3],
    window: WINDOW,
    bankHolidays: HOLIDAYS,
    ...partial,
  })
  return { ...out, r1: out.resources.get('r1') }
}

const bars = (segments: { supplier: string; start: string; end: string; unscheduled?: boolean }[]) =>
  segments.map((s) => [s.supplier, s.start, s.end, s.unscheduled === true])

describe('window clipping (inclusive ends)', () => {
  it('clips an engagement to the window, keeping both inclusive end days', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOnDate: '2026-06-15', rollOffDate: '2026-07-15' })],
    })
    expect(bars(r1!.segments)).toEqual([['A', '2026-07-01', '2026-07-15', true]])
  })

  it('draws a one-day bar for an engagement ending on the window’s first day', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOffDate: '2026-07-01' })],
    })
    expect(bars(r1!.segments)).toEqual([['A', '2026-07-01', '2026-07-01', true]])
  })

  it('draws a one-day bar for an engagement starting on the window’s last day', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOnDate: '2026-12-31' })],
    })
    expect(bars(r1!.segments)).toEqual([['A', '2026-12-31', '2026-12-31', true]])
  })
})

describe('open-ended roll-off', () => {
  it('runs a scheduled engagement with no roll-off to the window end', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A' })],
      allocations: [alloc({ engagementId: 'e1', periodId: 'q2' }), alloc({ engagementId: 'e1', periodId: 'q3' })],
    })
    expect(bars(r1!.segments)).toEqual([
      ['A', '2026-07-01', '2026-09-30', false],
      ['A', '2026-10-01', '2026-12-31', false],
    ])
  })
})

describe('null roll-on', () => {
  it('draws no bar and reports a data issue', () => {
    const { r1, dataIssues } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOnDate: null })],
      allocations: [alloc({ engagementId: 'e1', periodId: 'q3' })],
    })
    expect(r1!.segments).toEqual([])
    expect(dataIssues).toContainEqual(
      expect.objectContaining({ kind: 'null_roll_on', resourceId: 'r1', engagementId: 'e1' }),
    )
  })
})

describe('engagements outside the window', () => {
  it('draws nothing when roll-off is before the window start, even with a schedule row', () => {
    // Scheduled after leaving: no treatment, the bar simply ends at roll-off.
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOffDate: '2026-06-23' })],
      allocations: [alloc({ engagementId: 'e1', periodId: 'q2' })],
    })
    expect(r1!.segments).toEqual([])
  })

  it('draws nothing when roll-on is after the window end', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOnDate: '2027-01-04' })],
    })
    expect(r1!.segments).toEqual([])
  })

  it('ends a scheduled bar at roll-off when the schedule runs on past it', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOffDate: '2026-08-21' })],
      allocations: [alloc({ engagementId: 'e1', periodId: 'q2' }), alloc({ engagementId: 'e1', periodId: 'q3' })],
    })
    expect(bars(r1!.segments)).toEqual([['A', '2026-07-01', '2026-08-21', false]])
  })
})

describe('per-engagement unscheduled detection', () => {
  it('Amol Tate: TCS days in Q2 are unscheduled because his Q2 row belongs to CG', () => {
    const { r1 } = run({
      engagements: [
        eng({ engagementId: 'cg', supplier: 'A', rollOnDate: '2026-01-01', rollOffDate: '2026-08-13' }),
        eng({ engagementId: 'tcs', supplier: 'B', rollOnDate: '2026-09-08' }),
      ],
      allocations: [
        alloc({ engagementId: 'cg', periodId: 'q2', monthlyDays: { '2026-07-01': 10.5, '2026-08-01': 18, '2026-09-01': 20 } }),
        alloc({ engagementId: 'tcs', periodId: 'q3', monthlyDays: { '2026-10-01': 22, '2026-11-01': 20, '2026-12-01': 21 } }),
      ],
    })
    expect(bars(r1!.segments)).toEqual([
      ['A', '2026-07-01', '2026-08-13', false],
      ['B', '2026-09-08', '2026-09-30', true],
      ['B', '2026-10-01', '2026-12-31', false],
    ])
  })

  it('draws an unscheduled piece as full availability with no planview', () => {
    const { r1 } = run({ engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOnDate: '2026-09-14' })] })
    expect(r1!.segments[0]).toMatchObject({ code: 'REG', unscheduled: true, tentative: false, flag: null })
  })
})

describe('pieces within one engagement vs separate engagements', () => {
  it('pieces of one engagement touch end-to-start and share the engagement id', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOnDate: '2026-09-08' })],
      allocations: [alloc({ engagementId: 'e1', periodId: 'q3' })],
    })
    const [unscheduled, scheduled] = r1!.segments
    expect(unscheduled).toMatchObject({ end: '2026-09-30', unscheduled: true, engagementId: 'e1' })
    expect(scheduled).toMatchObject({ start: '2026-10-01', unscheduled: false, engagementId: 'e1' })
  })

  it('a planview change inside one engagement stays one engagement', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A' })],
      allocations: [
        alloc({ engagementId: 'e1', periodId: 'q2' }),
        alloc({ engagementId: 'e1', periodId: 'q3', code: 'NPC', allocationId: 'n', monthlyDays: { '2026-10-01': 22 } }),
      ],
    })
    expect(new Set(r1!.segments.map((s) => s.engagementId))).toEqual(new Set(['e1']))
    expect(r1!.segments.map((s) => s.code)).toEqual(['REG', 'NPC'])
  })

  it('back-to-back engagements are separate bars with different ids', () => {
    const { r1 } = run({
      engagements: [
        eng({ engagementId: 'e1', supplier: 'A', rollOffDate: '2026-09-30' }),
        eng({ engagementId: 'e2', supplier: 'B', rollOnDate: '2026-10-01' }),
      ],
    })
    expect(r1!.segments.map((s) => s.engagementId)).toEqual(['e1', 'e2'])
    expect(r1!.segments[0]!.end).toBe('2026-09-30')
    expect(r1!.segments[1]!.start).toBe('2026-10-01')
  })
})

describe('new hire roll-off', () => {
  it('ends a new hire’s bar at their roll-off', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'B', rollOnDate: '2026-11-02', rollOffDate: '2026-12-11' })],
      allocations: [alloc({ engagementId: 'e1', periodId: 'q3', monthlyDays: { '2026-10-01': 0, '2026-11-01': 20, '2026-12-01': 21 } })],
    })
    expect(bars(r1!.segments)).toEqual([['B', '2026-11-02', '2026-12-11', false]])
  })
})

describe('bar shape comes from engagement dates only', () => {
  it('a part-time engagement (5 days every month) is one continuous bar with no gaps', () => {
    const five = { '2026-07-01': 5, '2026-08-01': 5, '2026-09-01': 5 }
    const fiveQ3 = { '2026-10-01': 5, '2026-11-01': 5, '2026-12-01': 5 }
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A' })],
      allocations: [
        alloc({ engagementId: 'e1', periodId: 'q2', monthlyDays: five }),
        alloc({ engagementId: 'e1', periodId: 'q3', monthlyDays: fiveQ3 }),
      ],
    })
    expect(bars(r1!.segments)).toEqual([
      ['A', '2026-07-01', '2026-09-30', false],
      ['A', '2026-10-01', '2026-12-31', false],
    ])
  })

  it('monthly days short by N days mid-engagement leave no gap', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOffDate: '2026-10-30' })],
      allocations: [
        alloc({ engagementId: 'e1', periodId: 'q2', monthlyDays: { '2026-07-01': 21, '2026-08-01': 18, '2026-09-01': 12 } }),
        alloc({ engagementId: 'e1', periodId: 'q3', monthlyDays: { '2026-10-01': 22 } }),
      ],
    })
    expect(bars(r1!.segments)).toEqual([
      ['A', '2026-07-01', '2026-09-30', false],
      ['A', '2026-10-01', '2026-10-30', false],
    ])
  })

  it('a zero-day month inside a scheduled period is still covered', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOnDate: '2026-10-01' })],
      allocations: [alloc({ engagementId: 'e1', periodId: 'q3', monthlyDays: { '2026-10-01': 0, '2026-11-01': 0, '2026-12-01': 21 } })],
    })
    expect(bars(r1!.segments)).toEqual([['A', '2026-10-01', '2026-12-31', false]])
  })

  it('a partial first month starts at roll-on, not at a back-anchored day', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'B', rollOnDate: '2026-10-01' })],
      allocations: [alloc({ engagementId: 'e1', periodId: 'q3', monthlyDays: { '2026-10-01': 5, '2026-11-01': 21, '2026-12-01': 21 } })],
    })
    expect(r1!.segments[0]!.start).toBe('2026-10-01')
  })

  it('hypercare runs to the engagement’s roll-off, not to its last booked month', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOnDate: '2026-10-01', rollOffDate: '2026-11-04' })],
      allocations: [alloc({ engagementId: 'e1', periodId: 'q3', code: 'NPC', monthlyDays: { '2026-10-01': 22 } })],
    })
    expect(r1!.segments.map((s) => [s.code, s.start, s.end])).toEqual([['NPC', '2026-10-01', '2026-11-04']])
  })

  it('a period mixing hypercare with other planviews is drawn as ordinary cover', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOnDate: '2026-10-01' })],
      allocations: [
        alloc({ engagementId: 'e1', periodId: 'q3', allocationId: 'x' }),
        alloc({ engagementId: 'e1', periodId: 'q3', allocationId: 'y', code: 'NPC' }),
      ],
    })
    expect(r1!.segments.map((s) => s.code)).toEqual(['REG'])
  })
})

describe('booked days (tooltip only)', () => {
  it('carries monthly days per month inside the window on scheduled pieces', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOnDate: '2026-10-01' })],
      allocations: [alloc({ engagementId: 'e1', periodId: 'q3', monthlyDays: { '2026-10-01': 5, '2026-11-01': 5, '2026-12-01': 4 } })],
    })
    expect(r1!.segments[0]!.bookedDays).toEqual([
      { unit: 'month', start: '2026-10-01', days: 5 },
      { unit: 'month', start: '2026-11-01', days: 5 },
      { unit: 'month', start: '2026-12-01', days: 4 },
    ])
  })

  it('falls back to the period’s flat days where there are no monthly rows', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOnDate: '2026-10-01' })],
      allocations: [alloc({ engagementId: 'e1', periodId: 'q3', capacityDays: 64 })],
    })
    expect(r1!.segments[0]!.bookedDays).toEqual([{ unit: 'period', start: '2026-10-01', days: 64 }])
  })

  it('sums the engagement’s allocations and covers every period in the window', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A' })],
      allocations: [
        alloc({ engagementId: 'e1', periodId: 'q2', allocationId: 'x', monthlyDays: { '2026-07-01': 10.5 } }),
        alloc({ engagementId: 'e1', periodId: 'q2', allocationId: 'y', monthlyDays: { '2026-07-01': 5 } }),
        alloc({ engagementId: 'e1', periodId: 'q3', capacityDays: 30 }),
      ],
    })
    const expected = [
      { unit: 'month', start: '2026-07-01', days: 15.5 },
      { unit: 'period', start: '2026-10-01', days: 30 },
    ]
    expect(r1!.segments.map((s) => s.bookedDays)).toEqual([expected, expected])
  })

  it('puts no days on unscheduled pieces', () => {
    const { r1 } = run({
      engagements: [eng({ engagementId: 'e1', supplier: 'A', rollOnDate: '2026-09-08' })],
      allocations: [alloc({ engagementId: 'e1', periodId: 'q3', capacityDays: 60 })],
    })
    const [unscheduled, scheduled] = r1!.segments
    expect(unscheduled!.unscheduled).toBe(true)
    expect(unscheduled!.bookedDays).toBeUndefined()
    expect(scheduled!.bookedDays).toEqual([{ unit: 'period', start: '2026-10-01', days: 60 }])
  })
})

describe('transition category derivation', () => {
  const window = WINDOW

  it('supplier change between consecutive window engagements → transitioned', () => {
    expect(
      classifyEngagements(
        [
          eng({ engagementId: 'e1', supplier: 'A', rollOffDate: '2026-08-13' }),
          eng({ engagementId: 'e2', supplier: 'B', rollOnDate: '2026-09-08' }),
        ],
        [],
        window,
      ),
    ).toEqual({ status: 'mover', category: 'transitioned' })
  })

  it('first roll-on inside the window → established (joiner)', () => {
    expect(classifyEngagements([eng({ engagementId: 'e1', supplier: 'B', rollOnDate: '2026-11-02' })], [], window)).toEqual({
      status: 'joiner',
      category: 'established',
    })
  })

  it('a roll-on on the window’s first day is not a join inside the window', () => {
    expect(classifyEngagements([eng({ engagementId: 'e1', supplier: 'B', rollOnDate: '2026-07-01' })], [], window)).toEqual({
      status: 'incumbent',
      category: null,
    })
  })

  it('last roll-off inside the window → not moving, including on the window’s last day', () => {
    for (const rollOffDate of ['2026-08-25', '2026-12-31']) {
      expect(classifyEngagements([eng({ engagementId: 'e1', supplier: 'A', rollOffDate })], [], window)).toEqual({
        status: 'rolledoff',
        category: 'not_moving',
      })
    }
  })

  it('roll-off inside the window with hypercare drawn → hypercare only', () => {
    expect(
      classifyEngagements([eng({ engagementId: 'e1', supplier: 'A', rollOffDate: '2026-10-30' })], [{ code: 'NPC' }], window),
    ).toEqual({ status: 'rolledoff_hypercare', category: 'rolloff_hypercare' })
  })

  it('a move that happened before the window is not a transition inside it', () => {
    expect(
      classifyEngagements(
        [
          eng({ engagementId: 'e1', supplier: 'A', rollOffDate: '2026-03-31' }),
          eng({ engagementId: 'e2', supplier: 'B', rollOnDate: '2026-04-01' }),
        ],
        [],
        window,
      ),
    ).toEqual({ status: 'incumbent', category: null })
  })

  it('unscheduled time counts as ordinary engagement time', () => {
    const { r1 } = run({
      engagements: [
        eng({ engagementId: 'e1', supplier: 'A', rollOffDate: '2026-08-13' }),
        eng({ engagementId: 'e2', supplier: 'B', rollOnDate: '2026-09-08' }),
      ],
      allocations: [alloc({ engagementId: 'e1', periodId: 'q2' })],
    })
    expect(r1!.classification).toEqual({ status: 'mover', category: 'transitioned' })
  })
})

describe('window-scoped avatar suppliers', () => {
  const engagements = [
    eng({ engagementId: 'e0', supplier: 'Z', rollOnDate: '2026-01-01', rollOffDate: '2026-03-31' }),
    eng({ engagementId: 'e1', supplier: 'A', rollOnDate: '2026-04-01', rollOffDate: '2026-08-13' }),
    eng({ engagementId: 'e2', supplier: 'B', rollOnDate: '2026-09-08' }),
  ]

  it('uses only engagements intersecting the window, chronologically', () => {
    expect(windowSuppliers(engagements, WINDOW)).toEqual(['A', 'B'])
  })

  it('follows a narrower window passed in as a parameter', () => {
    expect(windowSuppliers(engagements, { start: '2026-10-01', end: '2026-12-31' })).toEqual(['B'])
    expect(windowSuppliers(engagements, { start: '2026-07-01', end: '2026-08-31' })).toEqual(['A'])
  })

  it('collapses consecutive repeats of one supplier', () => {
    expect(
      windowSuppliers(
        [
          eng({ engagementId: 'e1', supplier: 'A', rollOffDate: '2026-07-31' }),
          eng({ engagementId: 'e2', supplier: 'A', rollOnDate: '2026-09-01' }),
        ],
        WINDOW,
      ),
    ).toEqual(['A'])
  })
})

describe('gaps between consecutive engagements', () => {
  it('runs from one engagement’s roll-off to the next one’s roll-on', () => {
    expect(
      engagementGaps(
        [
          eng({ engagementId: 'e1', supplier: 'A', rollOffDate: '2026-08-13' }),
          eng({ engagementId: 'e2', supplier: 'B', rollOnDate: '2026-09-08' }),
        ],
        WINDOW,
        HOLIDAYS,
      ),
    ).toEqual([{ start: '2026-08-13', end: '2026-09-08' }])
  })

  it('is a gap even when the person comes back to the same supplier', () => {
    expect(
      engagementGaps(
        [
          eng({ engagementId: 'e1', supplier: 'A', rollOffDate: '2026-07-31' }),
          eng({ engagementId: 'e2', supplier: 'A', rollOnDate: '2026-09-01' }),
        ],
        WINDOW,
        HOLIDAYS,
      ),
    ).toEqual([{ start: '2026-07-31', end: '2026-09-01' }])
  })

  it('is no gap across a weekend handover', () => {
    expect(
      engagementGaps(
        [
          eng({ engagementId: 'e1', supplier: 'A', rollOffDate: '2026-10-16' }),
          eng({ engagementId: 'e2', supplier: 'B', rollOnDate: '2026-10-19' }),
        ],
        WINDOW,
        HOLIDAYS,
      ),
    ).toEqual([])
  })
})

describe('never tentative, never overlap risk', () => {
  it('produces no tentative segment and no overlap-risk status', () => {
    const { resources } = run({
      engagements: [
        eng({ engagementId: 'e1', supplier: 'A', rollOffDate: '2026-10-30' }),
        eng({ engagementId: 'e2', supplier: 'B', rollOnDate: '2026-12-01' }),
      ],
      allocations: [alloc({ engagementId: 'e1', periodId: 'q2' }), alloc({ engagementId: 'e2', periodId: 'q3' })],
    })
    const all = [...resources.values()]
    expect(all.flatMap((r) => r.segments).some((s) => s.tentative)).toBe(false)
    expect(all.some((r) => (r.classification.status as string) === 'overlap_risk')).toBe(false)
  })
})
