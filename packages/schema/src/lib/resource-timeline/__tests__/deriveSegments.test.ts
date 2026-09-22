import { describe, expect, it } from 'vitest'
import {
  CG_HARD_CAP,
  NOISE_THRESHOLD_DAYS,
  classifyTransition,
  deriveGaps,
  deriveSegments,
} from '../deriveSegments'
import type { AllocationInput, DeriveSegmentsInput, TransitionRecord } from '../types'

const BANK_HOLIDAYS = ['2026-08-31', '2026-12-25', '2026-12-28']
const Q2 = { start: '2026-07-01', end: '2026-09-30' }
const Q3 = { start: '2026-10-01', end: '2026-12-31' }

function build(overrides: Partial<DeriveSegmentsInput> = {}): DeriveSegmentsInput {
  return {
    transition: null,
    coarseAllocations: [],
    granularAllocations: [],
    coarseWindow: Q2,
    granularWindow: Q3,
    bankHolidays: BANK_HOLIDAYS,
    ...overrides,
  }
}

function alloc(
  supplier: string,
  code: 'REG' | 'NPC',
  monthlyDays: Record<string, number> = {},
): AllocationInput {
  return { supplier, code, monthlyDays }
}

function transition(overrides: Partial<TransitionRecord> = {}): TransitionRecord {
  return {
    fromSupplier: 'CG',
    toSupplier: 'TCS',
    lastWorkingDay: null,
    joiningDate: null,
    commercialStart: null,
    status: 'confirmed',
    notes: null,
    ...overrides,
  }
}

/* ── Q2: flat whole-quarter blocks ─────────────────────────────────── */

describe('coarse period (Q2) derivation', () => {
  it('renders a flat whole-quarter block with no month granularity', () => {
    const [seg] = deriveSegments(build({ coarseAllocations: [alloc('HT', 'REG')] }))

    expect(seg).toMatchObject({
      supplier: 'HT',
      start: '2026-07-01',
      end: '2026-09-30',
      // 1 Jul is where this view begins, not where anyone started.
      realStart: false,
      realEnd: true,
    })
  })

  it('clips the block to a last working day falling inside Q2', () => {
    // Amol Tate: CG, LWD 13 Aug.
    const [seg] = deriveSegments(
      build({
        coarseAllocations: [alloc('CG', 'REG')],
        transition: transition({ lastWorkingDay: '2026-08-13' }),
      }),
    )

    expect(seg?.end).toBe('2026-08-13')
  })

  it('collapses duplicate same-supplier allocations into one bar', () => {
    // Amol Tate and Basavaraj Havaler each hold two Q2 lines against the same
    // supplier (a PR and an F_Gov allocation). Rendered separately they stack
    // into two pixel-identical bars.
    const segs = deriveSegments(
      build({ coarseAllocations: [alloc('CG', 'REG'), alloc('CG', 'REG')] }),
    )

    expect(segs).toHaveLength(1)
  })

  it('keeps hypercare separate from regular cover for the same supplier', () => {
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('CG', 'REG', { '2026-10-01': 22 }),
          alloc('CG', 'NPC', { '2026-10-01': 22 }),
        ],
      }),
    )

    expect(segs).toHaveLength(2)
    expect(segs.map((s) => s.code).sort()).toEqual(['NPC', 'REG'])
  })

  it('sums monthly days when merging granular duplicates', () => {
    // Two half allocations for one month should read as one full month, not
    // as two partial starts.
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 11, '2026-11-01': 21 }),
          alloc('TCS', 'REG', { '2026-10-01': 11, '2026-11-01': 0 }),
        ],
      }),
    )

    expect(segs).toHaveLength(1)
    expect(segs[0]?.start).toBe('2026-10-01')
  })

  it('ignores a last working day that falls outside Q2', () => {
    // Vipul Suriya: LWD 30 Oct belongs to the Q3 segment, not this one.
    const [seg] = deriveSegments(
      build({
        coarseAllocations: [alloc('CG', 'REG')],
        transition: transition({ lastWorkingDay: '2026-10-30' }),
      }),
    )

    expect(seg?.end).toBe('2026-09-30')
  })
})

/* ── Q3: monthly-days driven ───────────────────────────────────────── */

describe('granular period (Q3) — start-anchored segments', () => {
  it('starts at the first working day when every month is full', () => {
    // Amol Tate's TCS cover: full Oct/Nov/Dec.
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 22, '2026-11-01': 21, '2026-12-01': 21 }),
        ],
      }),
    )

    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({
      start: '2026-10-01',
      end: '2026-12-31',
      realStart: true,
      // The window's closing edge is arbitrary — this cover is ongoing.
      realEnd: false,
    })
  })

  it('derives a partial-start joiner as the Nth working day, not the Nth calendar day', () => {
    // Dipti Borole: 15 of 22 October days → 7 missing → 8th working day.
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 15, '2026-11-01': 21, '2026-12-01': 21 }),
        ],
      }),
    )

    expect(segs[0]?.start).toBe('2026-10-12')
  })

  it('derives Praneeth Gudelli and Vipul Suriya starts from real day counts', () => {
    const gudelli = deriveSegments(
      build({
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 17, '2026-11-01': 21, '2026-12-01': 21 }),
        ],
      }),
    )
    expect(gudelli[0]?.start).toBe('2026-10-08')

    // Vipul: no October cover at all, 11 of 21 November days.
    const suriya = deriveSegments(
      build({
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 0, '2026-11-01': 11, '2026-12-01': 21 }),
        ],
      }),
    )
    expect(suriya[0]?.start).toBe('2026-11-16')
  })

  it('starts at the first working day of the run when an empty month precedes it', () => {
    // Prajwal Kumar: nothing in October, full November onwards. 1 Nov is a Sunday.
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 0, '2026-11-01': 21, '2026-12-01': 21 }),
        ],
      }),
    )

    expect(segs[0]?.start).toBe('2026-11-02')
  })

  it('splits non-contiguous runs into separate segments', () => {
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 22, '2026-11-01': 0, '2026-12-01': 21 }),
        ],
      }),
    )

    expect(segs).toHaveLength(2)
    expect(segs[0]).toMatchObject({ start: '2026-10-01', end: '2026-10-30', realEnd: true })
    expect(segs[1]).toMatchObject({ start: '2026-12-01', end: '2026-12-31' })
  })
})

/* ── Anchoring: front vs back ──────────────────────────────────────── */
// Rule 4. A partial month is only a late start if nobody was here the month
// before. These four cases are the whole decision table.

describe('anchoring — no transition record', () => {
  it('back-anchors a genuine new start (no prior presence)', () => {
    // Naresh Kottala's shape: nothing in Q2, nothing in October, arrives in
    // November. Unchanged behaviour — the days sit at the END of the month.
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 0, '2026-11-01': 11, '2026-12-01': 21 }),
        ],
      }),
    )

    expect(segs[0]?.start).toBe('2026-11-16')
  })

  it('back-anchors a partial first month when the coarse period is empty', () => {
    // Dipti Borole's day shape without a record: 15 of 22 October days and no
    // Q2 line at all, so October really is an arrival.
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 15, '2026-11-01': 21, '2026-12-01': 21 }),
        ],
      }),
    )

    expect(segs[0]?.start).toBe('2026-10-12')
  })

  it('front-anchors a tapering resource present in the prior period', () => {
    // Jan Urbaniak: Happy Team through Q2, 9 of 22 October days, then nothing.
    // He is winding down, not arriving on the 20th — the bar starts on the 1st
    // and runs out after nine working days.
    const segs = deriveSegments(
      build({
        coarseAllocations: [alloc('HT', 'REG')],
        granularAllocations: [
          alloc('HT', 'REG', { '2026-10-01': 9, '2026-11-01': 0, '2026-12-01': 0 }),
        ],
      }),
    )

    const q3 = segs.filter((seg) => seg.start >= '2026-10-01')
    expect(q3).toHaveLength(1)
    expect(q3[0]).toMatchObject({ start: '2026-10-01', end: '2026-10-13', realEnd: true })
  })

  it('front-anchors a permanently part-time resource into one continuous bar', () => {
    // Chris Horton: same EPAM allocation every month at five days. Never
    // absent, so never a second bar and never a late start.
    const segs = deriveSegments(
      build({
        coarseAllocations: [alloc('EPAM', 'REG')],
        granularAllocations: [
          alloc('EPAM', 'REG', { '2026-10-01': 5, '2026-11-01': 5, '2026-12-01': 5 }),
        ],
      }),
    )

    const q3 = segs.filter((seg) => seg.start >= '2026-10-01')
    expect(q3).toHaveLength(1)
    expect(q3[0]?.start).toBe('2026-10-01')
  })

  it('front-anchors from presence in the prior MONTH, not just the prior period', () => {
    // Full October, then a short November. November is a taper, not an arrival,
    // and the evidence for that is entirely inside the granular window.
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 22, '2026-11-01': 8, '2026-12-01': 0 }),
        ],
      }),
    )

    expect(segs[0]).toMatchObject({ start: '2026-10-01', end: '2026-11-11' })
  })

  it('treats a coarse block clipped long before the seam as no prior presence', () => {
    // Left CG in July, so by the time October comes round nobody was here last
    // month — a fresh October start, back-anchored.
    const segs = deriveSegments(
      build({
        coarseAllocations: [alloc('CG', 'REG')],
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 15, '2026-11-01': 21, '2026-12-01': 21 }),
        ],
        transition: transition({ fromSupplier: 'CG', toSupplier: null, lastWorkingDay: '2026-07-10' }),
      }),
    )

    expect(segs.find((seg) => seg.supplier === 'TCS')?.start).toBe('2026-10-12')
  })

  it('counts presence per resource, not per allocation', () => {
    // A CG line running through October and a TCS line starting in November:
    // the person was here last month, just on someone else's paper.
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('CG', 'REG', { '2026-10-01': 22 }),
          alloc('TCS', 'REG', { '2026-10-01': 0, '2026-11-01': 11, '2026-12-01': 21 }),
        ],
      }),
    )

    expect(segs.find((seg) => seg.supplier === 'TCS')?.start).toBe('2026-11-02')
  })
})

describe('anchoring — transition record present', () => {
  it('ends the outgoing bar on the last working day even though monthly rows exist', () => {
    // Makarand Parab, as the data stands now: a CG PR line with a real October
    // row of 12 days and a confirmed last working day of the 16th. The record
    // was being ignored entirely whenever monthly rows existed, which put him
    // on the wrong half of the month.
    const segs = deriveSegments(
      build({
        coarseAllocations: [alloc('CG', 'REG')],
        granularAllocations: [
          alloc('CG', 'REG', { '2026-10-01': 12 }),
          alloc('TCS', 'REG', { '2026-10-01': 0, '2026-11-01': 20, '2026-12-01': 21 }),
        ],
        transition: transition({
          lastWorkingDay: '2026-10-16',
          joiningDate: '2026-10-22',
          commercialStart: '2026-11-02',
        }),
      }),
    )

    const cgQ3 = segs.find((seg) => seg.supplier === 'CG' && seg.start >= '2026-10-01')
    expect(cgQ3).toMatchObject({ start: '2026-10-01', end: '2026-10-16', realEnd: true })
    expect(segs.find((seg) => seg.supplier === 'TCS')).toMatchObject({
      start: '2026-11-02',
      end: '2026-12-31',
    })
  })

  it('still honours the record when the allocation has no monthly rows', () => {
    // The path that already worked. Kept so removing the gate cannot regress it.
    const segs = deriveSegments(
      build({
        granularAllocations: [alloc('HT', 'REG')],
        transition: transition({
          fromSupplier: 'HT',
          toSupplier: null,
          lastWorkingDay: '2026-11-13',
        }),
      }),
    )

    expect(segs[0]?.end).toBe('2026-11-13')
  })

  it('ignores a last working day belonging to a different supplier', () => {
    // The date is the last day at CG. It says nothing about the TCS bar and
    // must not clip it.
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 22, '2026-11-01': 21, '2026-12-01': 21 }),
        ],
        transition: transition({ lastWorkingDay: '2026-11-13' }),
      }),
    )

    expect(segs[0]?.end).toBe('2026-12-31')
  })

  it('leaves hypercare anchored on its own day count', () => {
    // Hypercare IS the wind-down: its twelve booked days end it on the 16th,
    // and a last working day describes the substantive role before it.
    const segs = deriveSegments(
      build({
        granularAllocations: [alloc('CG', 'NPC', { '2026-10-01': 12 })],
        transition: transition({ toSupplier: null, lastWorkingDay: '2026-10-30' }),
      }),
    )

    expect(segs[0]).toMatchObject({ start: '2026-10-01', end: '2026-10-16' })
  })

  it('never lets joining_date move a bar, even as the only date on record', () => {
    // Rule 7, and the schema's own instruction on the column.
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 0, '2026-11-01': 21, '2026-12-01': 21 }),
        ],
        transition: transition({ fromSupplier: null, joiningDate: '2026-10-26' }),
      }),
    )

    expect(segs[0]?.start).toBe('2026-11-02')
  })
})

describe('granular period (Q3) — end-anchored NPC hypercare', () => {
  it('runs flat from the start of the period and ends on the Nth working day', () => {
    // Manasi Ketkar: 5 days of October hypercare.
    const segs = deriveSegments(
      build({ granularAllocations: [alloc('CG', 'NPC', { '2026-10-01': 5 })] }),
    )

    expect(segs[0]).toMatchObject({
      start: '2026-10-01',
      end: '2026-10-07',
      realStart: true,
      realEnd: true,
    })
  })

  it('ends at the last working day when the month is full', () => {
    // Bharat Patil: a full month of October hypercare, ending 30 Oct (31st is a Saturday).
    const segs = deriveSegments(
      build({ granularAllocations: [alloc('CG', 'NPC', { '2026-10-01': 22 })] }),
    )

    expect(segs[0]?.end).toBe('2026-10-30')
  })

  it('end-anchors rather than start-anchors a partial month', () => {
    // Makarand Parab: 12 booked days → the 12th working day of October is the
    // 16th. Start-anchoring would wrongly give a 19 Oct START and a 30 Oct end.
    const segs = deriveSegments(
      build({ granularAllocations: [alloc('CG', 'NPC', { '2026-10-01': 12 })] }),
    )

    expect(segs[0]).toMatchObject({ start: '2026-10-01', end: '2026-10-16' })
  })
})

/* ── Noise threshold ───────────────────────────────────────────────── */

describe('noise threshold', () => {
  it('is 2 days', () => {
    expect(NOISE_THRESHOLD_DAYS).toBe(2)
  })

  it('treats a month short by exactly 1 day as full', () => {
    // 21 of 22 October days — regional calendar variance, not a late start.
    const segs = deriveSegments(
      build({ granularAllocations: [alloc('TCS', 'REG', { '2026-10-01': 21, '2026-11-01': 21 })] }),
    )

    expect(segs[0]?.start).toBe('2026-10-01')
  })

  it('treats a month short by exactly 2 days as a real partial start', () => {
    const segs = deriveSegments(
      build({ granularAllocations: [alloc('TCS', 'REG', { '2026-10-01': 20, '2026-11-01': 21 })] }),
    )

    expect(segs[0]?.start).toBe('2026-10-05')
  })

  it('applies the same boundary to an end-anchored hypercare month', () => {
    const noise = deriveSegments(
      build({ granularAllocations: [alloc('CG', 'NPC', { '2026-10-01': 21 })] }),
    )
    expect(noise[0]?.end).toBe('2026-10-30')

    const real = deriveSegments(
      build({ granularAllocations: [alloc('CG', 'NPC', { '2026-10-01': 20 })] }),
    )
    expect(real[0]?.end).toBe('2026-10-28')
  })
})

/* ── CG hard cap ───────────────────────────────────────────────────── */

describe('CG October hard cap', () => {
  it('caps at the last working day of October 2026', () => {
    expect(CG_HARD_CAP).toBe('2026-10-30')
  })

  it('clips a CG segment that the data would otherwise run past October', () => {
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('CG', 'REG', { '2026-10-01': 22, '2026-11-01': 21, '2026-12-01': 21 }),
        ],
      }),
    )

    expect(segs[0]?.end).toBe('2026-10-30')
    // A cap that bit is a real boundary, not the window edge.
    expect(segs[0]?.realEnd).toBe(true)
  })

  it('overrides a later last_working_day rather than extending to it', () => {
    // Records carrying 2026-10-31 (a Saturday) still cap at the 30th.
    const segs = deriveSegments(
      build({
        granularAllocations: [alloc('CG', 'NPC', { '2026-10-01': 22, '2026-11-01': 21 })],
        transition: transition({ toSupplier: null, lastWorkingDay: '2026-10-31' }),
      }),
    )

    expect(segs[0]?.end).toBe('2026-10-30')
  })

  it('leaves non-CG suppliers uncapped', () => {
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 22, '2026-11-01': 21, '2026-12-01': 21 }),
        ],
      }),
    )

    expect(segs[0]?.end).toBe('2026-12-31')
  })
})

/* ── joining_date is never geometry ────────────────────────────────── */

describe('joining_date', () => {
  it('never moves a bar', () => {
    // Mathivanan Pandurangan: DOJ 1 Sep, but cover derives from October days.
    const withDoj = deriveSegments(
      build({
        granularAllocations: [alloc('TCS', 'REG', { '2026-10-01': 22, '2026-11-01': 21 })],
        transition: transition({ fromSupplier: null, joiningDate: '2026-09-01' }),
      }),
    )
    const withoutDoj = deriveSegments(
      build({
        granularAllocations: [alloc('TCS', 'REG', { '2026-10-01': 22, '2026-11-01': 21 })],
        transition: transition({ fromSupplier: null, joiningDate: null }),
      }),
    )

    expect(withDoj[0]?.start).toBe('2026-10-01')
    expect(withDoj).toEqual(withoutDoj)
  })
})

/* ── commercial_start reconciliation ───────────────────────────────── */

describe('commercial_start', () => {
  // Reversed deliberately. This block used to assert that the monthly days won
  // and the record was merely noted; the record is the agreed commercial fact
  // and now sets the bar, with the overridden day-derived date kept as the
  // divergence signal.
  it('overrides the day-derived start and keeps the derived date as the divergence', () => {
    const segs = deriveSegments(
      build({
        granularAllocations: [alloc('TCS', 'REG', { '2026-10-01': 15, '2026-11-01': 21 })],
        transition: transition({ commercialStart: '2026-10-19' }),
      }),
    )

    expect(segs[0]?.start).toBe('2026-10-19')
    expect(segs[0]?.commercialStartMismatch).toBe('2026-10-12')
  })

  it('reports no mismatch when the two agree', () => {
    const segs = deriveSegments(
      build({
        granularAllocations: [alloc('TCS', 'REG', { '2026-10-01': 15, '2026-11-01': 21 })],
        transition: transition({ commercialStart: '2026-10-12' }),
      }),
    )

    expect(segs[0]?.start).toBe('2026-10-12')
    expect(segs[0]?.commercialStartMismatch).toBeNull()
  })

  it('leaves the bar alone when the commercial start falls outside this window', () => {
    // Amol Tate: moved in August, so his Q3 TCS bar is ordinary cover and the
    // August date has nothing to say about it.
    const segs = deriveSegments(
      build({
        granularAllocations: [alloc('TCS', 'REG', { '2026-10-01': 22, '2026-11-01': 21 })],
        transition: transition({ commercialStart: '2026-08-24' }),
      }),
    )

    expect(segs[0]?.start).toBe('2026-10-01')
    expect(segs[0]?.commercialStartMismatch).toBeNull()
  })
})

/* ── Tentative treatment ───────────────────────────────────────────── */

describe('signed_doj_tbc', () => {
  it('marks the incoming supplier segment tentative and carries the note', () => {
    // Nikhil Vibhav: CG hypercare through October, tentative TCS start 1 Dec.
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('CG', 'NPC', { '2026-10-01': 22 }),
          alloc('TCS', 'REG', { '2026-10-01': 0, '2026-11-01': 0, '2026-12-01': 21 }),
        ],
        transition: transition({
          lastWorkingDay: '2026-10-31',
          commercialStart: '2026-12-01',
          status: 'signed_doj_tbc',
          notes: 'Commercial start tentative — 1 Dec',
        }),
      }),
    )

    const cg = segs.find((s) => s.supplier === 'CG')
    const tcs = segs.find((s) => s.supplier === 'TCS')

    expect(cg).toMatchObject({ end: '2026-10-30', tentative: false })
    expect(tcs).toMatchObject({
      start: '2026-12-01',
      tentative: true,
      flag: 'Commercial start tentative — 1 Dec',
    })
  })
})

/* ── No data at all ────────────────────────────────────────────────── */

describe('resources with no Q3 data', () => {
  it('renders the flat Q2 block only and fabricates nothing for Q3 when no Q3 allocation exists at all', () => {
    // No allocation object at all for Q3 — the query never returned a row.
    // This is genuinely "no Q3 presence" and must stay empty.
    const segs = deriveSegments(build({ coarseAllocations: [alloc('CG', 'REG')] }))

    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({ start: '2026-07-01', end: '2026-09-30' })
  })

  it('returns nothing at all when there are no allocations in either period', () => {
    expect(deriveSegments(build())).toEqual([])
  })

  it('ignores months explicitly booked at zero days', () => {
    // Real rows exist (three of them), they just all say 0 — a genuine
    // "booked no days this quarter", distinct from no rows existing at all.
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 0, '2026-11-01': 0, '2026-12-01': 0 }),
        ],
      }),
    )

    expect(segs).toEqual([])
  })
})

/* ── Q3 allocation with no monthly breakdown at all (bug fix) ───────── */
// Round 4: an allocation with a real Q3 resource_period_allocations row but
// zero rows in resource_period_allocation_monthly_days was being dropped
// entirely — rendering as if the person had no Q3 presence and, worse,
// classifying them as "Not moving". "No monthly breakdown" must mean "render
// flat for the whole quarter" (the same fallback Q2 always uses), not
// "no Q3 presence". Confirmed against the live DB: Aliaksei Yakimovich (EPAM),
// Rachel Hatcher (EPAM), Freddie Leigh-Akompi (EPAM), Bence Daroczi (EPAM),
// Dzianis Roi (EPAM), and the Happy Team resources Adam Dobrzeniewski, Jan
// Urbaniak, Krzysztof Derek and Tomasz Foltynski all have this exact shape —
// a confirmed Q3 allocation, zero monthly rows.
describe('Q3 allocation with no monthly rows falls back to a flat quarter block', () => {
  it('renders flat Oct-Dec rather than dropping the segment (the bug case)', () => {
    // Aliaksei Yakimovich: EPAM, Q3 FY26/27, capacity_days=60, zero monthly rows.
    const segs = deriveSegments(build({ granularAllocations: [alloc('EPAM', 'REG')] }))

    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({
      supplier: 'EPAM',
      code: 'REG',
      start: '2026-10-01',
      end: '2026-12-31',
      // Same as Q2's coarse block: the window edges aren't real boundaries.
      realStart: false,
      realEnd: true,
    })
  })

  it('classifies as an incumbent, not "Not moving", once the segment renders', () => {
    const segs = deriveSegments(build({ granularAllocations: [alloc('EPAM', 'REG')] }))

    expect(classifyTransition(null, segs, Q3.start)).toMatchObject({
      status: 'incumbent',
      categoryLabel: 'Not part of Dudley transition',
    })
  })

  it('applies per-allocation, not per-resource: one bare allocation and one with real monthly data both render', () => {
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('HT', 'REG'),
          alloc('TCS', 'REG', { '2026-10-01': 22, '2026-11-01': 21, '2026-12-01': 21 }),
        ],
      }),
    )

    expect(segs).toHaveLength(2)
    expect(segs.find((s) => s.supplier === 'HT')).toMatchObject({
      start: '2026-10-01',
      end: '2026-12-31',
      realStart: false,
      realEnd: true,
    })
    expect(segs.find((s) => s.supplier === 'TCS')).toMatchObject({
      start: '2026-10-01',
      end: '2026-12-31',
      realStart: true,
      realEnd: false,
    })
  })

  it('still clips to a last working day that falls inside Q3', () => {
    const segs = deriveSegments(
      build({
        granularAllocations: [alloc('HT', 'REG')],
        transition: transition({ fromSupplier: 'HT', toSupplier: null, lastWorkingDay: '2026-11-13' }),
      }),
    )

    expect(segs[0]?.end).toBe('2026-11-13')
  })

  it('still applies the CG October hard cap', () => {
    const segs = deriveSegments(build({ granularAllocations: [alloc('CG', 'REG')] }))

    expect(segs[0]?.end).toBe(CG_HARD_CAP)
  })

  it('still marks a tentative signed_doj_tbc segment as tentative', () => {
    const segs = deriveSegments(
      build({
        granularAllocations: [alloc('TCS', 'REG')],
        transition: transition({ status: 'signed_doj_tbc', notes: 'Commercial start tentative' }),
      }),
    )

    expect(segs[0]).toMatchObject({ tentative: true, flag: 'Commercial start tentative' })
  })
})

/* ── Gaps ──────────────────────────────────────────────────────────── */

describe('deriveGaps', () => {
  it('reads the gap off the transition record, not off the segments', () => {
    const gaps = deriveGaps(
      transition({ lastWorkingDay: '2026-09-30', commercialStart: '2026-11-02' }),
      BANK_HOLIDAYS,
    )

    expect(gaps).toEqual([{ start: '2026-09-30', end: '2026-11-02' }])
  })

  it('never produces a gap without a transition record, whatever the segments look like', () => {
    // Chris Horton's shape: continuous EPAM cover at five days a month. The old
    // adjacency check called the Q2/Q3 seam a gap; there is no record, so there
    // is no gap.
    const segs = deriveSegments(
      build({
        coarseAllocations: [alloc('EPAM', 'REG')],
        granularAllocations: [
          alloc('EPAM', 'REG', { '2026-10-01': 5, '2026-11-01': 5, '2026-12-01': 5 }),
        ],
      }),
    )

    expect(segs.length).toBeGreaterThan(1)
    expect(deriveGaps(null, BANK_HOLIDAYS)).toEqual([])
  })

  it('produces no gap without a last working day', () => {
    // Hitendrasinh Rajput: everything else populated, no resignation date on
    // record at CG. Nothing to measure a gap from, so none is drawn.
    expect(
      deriveGaps(
        transition({ lastWorkingDay: null, joiningDate: '2026-10-07', commercialStart: '2026-10-14' }),
        BANK_HOLIDAYS,
      ),
    ).toEqual([])
  })

  it('produces no gap without a resume date', () => {
    expect(
      deriveGaps(
        transition({ lastWorkingDay: '2026-09-30', commercialStart: null, joiningDate: null }),
        BANK_HOLIDAYS,
      ),
    ).toEqual([])
  })

  it('falls back to joining_date only where commercial_start is null', () => {
    expect(
      deriveGaps(
        transition({ lastWorkingDay: '2026-09-30', joiningDate: '2026-10-19', commercialStart: null }),
        BANK_HOLIDAYS,
      ),
    ).toEqual([{ start: '2026-09-30', end: '2026-10-19' }])

    // With both set, commercial_start wins — joining_date is informational.
    expect(
      deriveGaps(
        transition({
          lastWorkingDay: '2026-09-30',
          joiningDate: '2026-10-19',
          commercialStart: '2026-11-02',
        }),
        BANK_HOLIDAYS,
      ),
    ).toEqual([{ start: '2026-09-30', end: '2026-11-02' }])
  })

  it('reports no gap for a handover across a weekend', () => {
    // CG finishes Friday 30 Oct, TCS starts Monday 2 Nov. Nobody was uncovered
    // on a working day, so this is a clean handover even with a record behind it.
    expect(
      deriveGaps(
        transition({ lastWorkingDay: '2026-10-30', commercialStart: '2026-11-02' }),
        BANK_HOLIDAYS,
      ),
    ).toEqual([])
  })

  it('reports no gap when cover resumes on or before the last working day', () => {
    expect(
      deriveGaps(
        transition({ lastWorkingDay: '2026-10-30', commercialStart: '2026-10-30' }),
        BANK_HOLIDAYS,
      ),
    ).toEqual([])
  })

  it('never renders a leading gap for a brand-new joiner', () => {
    // A gap means "should have been covered and wasn't" — not true of someone
    // who simply had not started yet. No from-supplier, no last working day.
    expect(
      deriveGaps(transition({ fromSupplier: null, joiningDate: '2026-10-26' }), BANK_HOLIDAYS),
    ).toEqual([])
  })
})

/* ── Classification ────────────────────────────────────────────────── */

describe('classifyTransition', () => {
  const noSegments: never[] = []

  it('classifies a CG → TCS mover', () => {
    expect(classifyTransition(transition(), noSegments, Q3.start)).toMatchObject({
      status: 'mover',
      category: 'transitioned',
    })
  })

  it('classifies a signed-but-TBC mover separately', () => {
    expect(
      classifyTransition(transition({ status: 'signed_doj_tbc' }), noSegments, Q3.start),
    ).toMatchObject({ status: 'mover_doj_tbc', category: 'signed_tbc' })
  })

  it('classifies a new TCS joiner with no CG history', () => {
    expect(
      classifyTransition(transition({ fromSupplier: null }), noSegments, Q3.start),
    ).toMatchObject({ status: 'joiner', category: 'established' })
  })

  it('distinguishes hypercare roll-off from plain attrition', () => {
    const leaving = transition({ toSupplier: null, status: 'not_moving' })
    const hypercareSegs = [
      {
        supplier: 'CG',
        code: 'NPC' as const,
        start: '2026-10-01',
        end: '2026-10-30',
        realStart: true,
        realEnd: true,
        tentative: false,
        flag: null,
        commercialStartMismatch: null,
      },
    ]

    expect(classifyTransition(leaving, hypercareSegs, Q3.start)).toMatchObject({
      status: 'rolledoff_hypercare',
      category: 'rolloff_hypercare',
    })
    expect(classifyTransition(leaving, noSegments, Q3.start)).toMatchObject({
      status: 'rolledoff',
      category: 'not_moving',
    })
  })

  it('treats someone with no transition record as outside the transition', () => {
    const q3Seg = [
      {
        supplier: 'HT',
        code: 'REG' as const,
        start: '2026-10-01',
        end: '2026-12-31',
        realStart: true,
        realEnd: false,
        tentative: false,
        flag: null,
        commercialStartMismatch: null,
      },
    ]

    // Hypercare alone does not make someone part of the Dudley cohort.
    expect(classifyTransition(null, q3Seg, Q3.start)).toMatchObject({
      status: 'incumbent',
      category: null,
      categoryLabel: 'Not part of Dudley transition',
    })
    expect(classifyTransition(null, noSegments, Q3.start)).toMatchObject({
      status: 'rolledoff',
      category: null,
    })
  })
})
