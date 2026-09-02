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
  it('records a divergence from the derived start without overriding it', () => {
    const segs = deriveSegments(
      build({
        granularAllocations: [alloc('TCS', 'REG', { '2026-10-01': 15, '2026-11-01': 21 })],
        transition: transition({ commercialStart: '2026-10-19' }),
      }),
    )

    expect(segs[0]?.start).toBe('2026-10-12')
    expect(segs[0]?.commercialStartMismatch).toBe('2026-10-19')
  })

  it('reports no mismatch when the two agree', () => {
    const segs = deriveSegments(
      build({
        granularAllocations: [alloc('TCS', 'REG', { '2026-10-01': 15, '2026-11-01': 21 })],
        transition: transition({ commercialStart: '2026-10-12' }),
      }),
    )

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
  it('marks the gap between a CG roll-off and a later TCS commercial start', () => {
    const segs = deriveSegments(
      build({
        coarseAllocations: [alloc('CG', 'REG')],
        granularAllocations: [
          alloc('TCS', 'REG', { '2026-10-01': 0, '2026-11-01': 21, '2026-12-01': 21 }),
        ],
        transition: transition({ lastWorkingDay: '2026-09-30' }),
      }),
    )

    expect(deriveGaps(segs, BANK_HOLIDAYS)).toEqual([{ start: '2026-09-30', end: '2026-11-02' }])
  })

  it('never renders a leading gap for a brand-new joiner', () => {
    // A gap means "should have been covered and wasn't" — which is not true of
    // someone who simply had not started yet.
    const segs = deriveSegments(
      build({
        granularAllocations: [alloc('TCS', 'REG', { '2026-10-01': 0, '2026-11-01': 21 })],
        transition: transition({ fromSupplier: null }),
      }),
    )

    expect(segs).toHaveLength(1)
    expect(deriveGaps(segs, BANK_HOLIDAYS)).toEqual([])
  })

  it('reports no gap across the Q2/Q3 seam for continuous cover', () => {
    // Cover runs to 30 Sep and resumes 1 Oct. Two segments because they are
    // two allocations, but not one uncovered day between them.
    const segs = deriveSegments(
      build({
        coarseAllocations: [alloc('HT', 'REG')],
        granularAllocations: [alloc('HT', 'REG', { '2026-10-01': 22, '2026-11-01': 21 })],
      }),
    )

    expect(segs).toHaveLength(2)
    expect(deriveGaps(segs, BANK_HOLIDAYS)).toEqual([])
  })

  it('reports no gap for a handover across a weekend', () => {
    // CG hypercare ends Friday 30 Oct, TCS starts Monday 2 Nov. Nobody was
    // uncovered on a working day, so this is not a gap.
    const segs = deriveSegments(
      build({
        granularAllocations: [
          alloc('CG', 'NPC', { '2026-10-01': 22 }),
          alloc('TCS', 'REG', { '2026-10-01': 0, '2026-11-01': 21, '2026-12-01': 21 }),
        ],
        transition: transition({ lastWorkingDay: '2026-10-30' }),
      }),
    )

    expect(segs.map((s) => [s.start, s.end])).toEqual([
      ['2026-10-01', '2026-10-30'],
      ['2026-11-02', '2026-12-31'],
    ])
    expect(deriveGaps(segs, BANK_HOLIDAYS)).toEqual([])
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
