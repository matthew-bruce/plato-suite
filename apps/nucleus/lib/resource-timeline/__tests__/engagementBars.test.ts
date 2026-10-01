// Bar shape end to end: the native engine's output run through the same
// presentation helpers the live page renders with (joins, labels, break
// insets, gap geometry). Engine imported by path, as disciplineOrder.test
// does, because it is not part of @plato/schema's public barrel.

import { describe, expect, it } from 'vitest'
import {
  deriveEngagementTimeline,
  type EngineAllocation,
  type EngineEngagement,
} from '../../../../../packages/schema/src/lib/resource-timeline/engagementEngine'
import type { TimelineSegment } from '@plato/schema'
import {
  SEGMENT_TOUCH_INSET_PX,
  barLabel,
  bookedDaysLine,
  gapGeometry,
  insetSegmentPosition,
  segmentGeometry,
  segmentJoins,
  segmentTouchInsets,
} from '../presentation'

const Q2 = { periodId: 'q2', start: '2026-07-01', end: '2026-09-30' }
const Q3 = { periodId: 'q3', start: '2026-10-01', end: '2026-12-31' }
const WINDOW = { start: Q2.start, end: Q3.end }

function eng(o: Partial<EngineEngagement> & Pick<EngineEngagement, 'engagementId' | 'supplier'>): EngineEngagement {
  return { resourceId: 'r1', rollOnDate: '2026-01-01', rollOffDate: null, ...o }
}
function alloc(o: Partial<EngineAllocation> & Pick<EngineAllocation, 'engagementId' | 'periodId'>): EngineAllocation {
  return { allocationId: `${o.engagementId}-${o.periodId}-${o.code ?? 'REG'}`, resourceId: 'r1', code: 'REG', monthlyDays: {}, capacityDays: null, ...o }
}

function derive(engagements: EngineEngagement[], allocations: EngineAllocation[] = []) {
  const out = deriveEngagementTimeline({ engagements, allocations, periods: [Q2, Q3], window: WINDOW, bankHolidays: [] })
  return out.resources.get('r1')!
}

/** What the row renders: per segment, its joins, inset, and label. */
function rendered(segments: TimelineSegment[]) {
  const joins = segmentJoins(segments)
  const insets = segmentTouchInsets(segments)
  return segments.map((s, i) => ({
    start: s.start,
    end: s.end,
    accent: !joins[i]!.joinsPrevious,
    roundedLeft: !joins[i]!.joinsPrevious,
    roundedRight: !joins[i]!.joinsNext,
    label: barLabel(segments, i),
    inset: insets[i]!,
    unscheduled: s.unscheduled === true,
  }))
}

describe('one engagement across Q2 → Q3', () => {
  it('is one continuous bar: no gap at 1 Oct, one accent, one label, rounded outer ends only', () => {
    const r = derive([eng({ engagementId: 'e1', supplier: 'TCS', rollOnDate: '2026-07-01' })], [
      alloc({ engagementId: 'e1', periodId: 'q2' }),
      alloc({ engagementId: 'e1', periodId: 'q3' }),
    ])
    const [q2, q3] = rendered(r.segments)

    expect(q2!.end).toBe('2026-09-30')
    expect(q3!.start).toBe('2026-10-01')
    expect([q2!.inset, q3!.inset]).toEqual([{ left: 0, right: 0 }, { left: 0, right: 0 }])
    expect([q2!.accent, q3!.accent]).toEqual([true, false])
    expect([q2!.label !== null, q3!.label]).toEqual([true, null])
    expect([q2!.roundedLeft, q2!.roundedRight, q3!.roundedLeft, q3!.roundedRight]).toEqual([true, false, false, true])
  })

  it('labels the first piece for the whole bar, not just its own quarter', () => {
    const r = derive([eng({ engagementId: 'e1', supplier: 'CG', rollOnDate: '2026-07-01', rollOffDate: '2026-10-30' })], [
      alloc({ engagementId: 'e1', periodId: 'q2' }),
      alloc({ engagementId: 'e1', periodId: 'q3' }),
    ])
    const label = barLabel(r.segments, 0)!
    expect(label.text).toBe('CG')
    // Ends at the roll-off on the Q3 piece, not at the 30 Sept seam.
    expect(label.dates).toMatch(/^to 30 Oct$/)
  })
})

describe('part-time engagement', () => {
  it('5 days every month is one continuous bar, and the tooltip lists the days', () => {
    const r = derive([eng({ engagementId: 'e1', supplier: 'TCS', rollOnDate: '2026-10-01' })], [
      alloc({ engagementId: 'e1', periodId: 'q3', monthlyDays: { '2026-10-01': 5, '2026-11-01': 5, '2026-12-01': 4 } }),
    ])
    expect(r.segments.map((s) => [s.start, s.end])).toEqual([['2026-10-01', '2026-12-31']])
    expect(bookedDaysLine(r.segments[0]!.bookedDays)).toBe('Oct 5d · Nov 5d · Dec 4d')
  })

  it('shows the period’s flat days per quarter where there are no monthly rows', () => {
    const r = derive([eng({ engagementId: 'e1', supplier: 'TCS', rollOnDate: '2026-10-01' })], [
      alloc({ engagementId: 'e1', periodId: 'q3', capacityDays: 64 }),
    ])
    expect(bookedDaysLine(r.segments[0]!.bookedDays)).toBe('Q3 64d')
  })

  it('monthly days short by N days mid-engagement leave no gap', () => {
    const r = derive([eng({ engagementId: 'e1', supplier: 'CG', rollOffDate: '2026-10-30' })], [
      alloc({ engagementId: 'e1', periodId: 'q2', monthlyDays: { '2026-07-01': 21, '2026-08-01': 18, '2026-09-01': 8 } }),
      alloc({ engagementId: 'e1', periodId: 'q3', monthlyDays: { '2026-10-01': 22 } }),
    ])
    const rows = rendered(r.segments)
    expect(rows.map((x) => [x.start, x.end])).toEqual([
      ['2026-07-01', '2026-09-30'],
      ['2026-10-01', '2026-10-30'],
    ])
    expect(rows.every((x) => x.inset.right === 0)).toBe(true)
  })
})

describe('breaks between engagements', () => {
  it('a day gap: the earlier bar ends 3px short and the red gap line spans the real gap', () => {
    const r = derive([
      eng({ engagementId: 'e1', supplier: 'CG', rollOnDate: '2026-10-01', rollOffDate: '2026-10-30' }),
      eng({ engagementId: 'e2', supplier: 'TCS', rollOnDate: '2026-12-01' }),
    ])
    const rows = rendered(r.segments)
    expect(rows.map((x) => x.inset)).toEqual([
      { left: 0, right: SEGMENT_TOUCH_INSET_PX },
      { left: 0, right: 0 },
    ])
    expect(SEGMENT_TOUCH_INSET_PX).toBe(3)

    expect(r.gaps).toEqual([{ start: '2026-10-30', end: '2026-12-01' }])
    const bar = segmentGeometry(r.segments[0]!, WINDOW.start, WINDOW.end)
    const next = segmentGeometry(r.segments[1]!, WINDOW.start, WINDOW.end)
    const gap = gapGeometry(r.gaps[0]!, WINDOW.start, WINDOW.end)
    // Gap line runs from the end of the last day to the start of the next bar.
    expect(gap.left).toBeCloseTo(bar.left + bar.width, 10)
    expect(gap.left + gap.width).toBeCloseTo(next.left, 10)
    // Visible space = real day gap + the 3px taken off the earlier bar.
    expect(insetSegmentPosition(bar, rows[0]!.inset).width).toBe(`calc(${bar.width}% - 3px)`)
  })

  it('a zero-day gap: still a 3px break, even between two engagements of one supplier', () => {
    const r = derive([
      eng({ engagementId: 'e1', supplier: 'CG', rollOffDate: '2026-09-30' }),
      eng({ engagementId: 'e2', supplier: 'CG', rollOnDate: '2026-10-01' }),
    ])
    expect(rendered(r.segments).map((x) => x.inset)).toEqual([
      { left: 0, right: 3 },
      { left: 0, right: 0 },
    ])
    expect(segmentJoins(r.segments)).toEqual([
      { joinsPrevious: false, joinsNext: false },
      { joinsPrevious: false, joinsNext: false },
    ])
  })
})

describe('pieces within one engagement', () => {
  it('a planview change mid-engagement: touching pieces, square inner corners, one accent, one label', () => {
    const r = derive([eng({ engagementId: 'e1', supplier: 'CG', rollOffDate: '2026-10-30' })], [
      alloc({ engagementId: 'e1', periodId: 'q2' }),
      alloc({ engagementId: 'e1', periodId: 'q3', code: 'NPC' }),
    ])
    const rows = rendered(r.segments)
    expect(r.segments.map((s) => s.code)).toEqual(['REG', 'NPC'])
    expect(rows[0]!.end).toBe('2026-09-30')
    expect(rows[1]!.start).toBe('2026-10-01')
    expect(rows.map((x) => x.inset.right)).toEqual([0, 0])
    expect(rows.map((x) => x.accent)).toEqual([true, false])
    expect(rows.map((x) => x.label !== null)).toEqual([true, false])
    expect([rows[0]!.roundedRight, rows[1]!.roundedLeft]).toEqual([false, false])
  })

  it('an unscheduled span inside an engagement: touching pieces, marker only under the unscheduled piece', () => {
    const r = derive([eng({ engagementId: 'e1', supplier: 'TCS', rollOnDate: '2026-09-08' })], [
      alloc({ engagementId: 'e1', periodId: 'q3' }),
    ])
    const rows = rendered(r.segments)
    expect(rows.map((x) => [x.start, x.end, x.unscheduled])).toEqual([
      ['2026-09-08', '2026-09-30', true],
      ['2026-10-01', '2026-12-31', false],
    ])
    expect(rows.map((x) => x.inset.right)).toEqual([0, 0])
    expect(rows.map((x) => x.accent)).toEqual([true, false])
    // The page draws the dotted marker for exactly the segments flagged here.
    expect(r.segments.filter((s) => s.unscheduled).map((s) => s.start)).toEqual(['2026-09-08'])
    // No days line on the unscheduled piece.
    expect(bookedDaysLine(r.segments[0]!.bookedDays)).toBeNull()
  })
})
