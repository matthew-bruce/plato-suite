// Regression fixture: real Q2/Q3 FY26/27 allocation data for the Dudley
// cohort, asserted against the segment geometry signed off on the validated
// mockup (dudley-gantt-mockup-v8c).
//
// The inputs below are the actual contents of resource_period_allocations and
// resource_period_allocation_monthly_days as of the 16 Aug 2026 reconciliation
// — not invented values. The expectations are the bars Matt approved. If the
// derivation drifts, this is what catches it.

import { describe, expect, it } from 'vitest'
import { classifyTransition, deriveGaps, deriveSegments } from '../deriveSegments'
import type { AllocationInput, TransitionRecord } from '../types'

const BANK_HOLIDAYS = ['2026-08-31', '2026-12-25', '2026-12-28']
const Q2 = { start: '2026-07-01', end: '2026-09-30' }
const Q3 = { start: '2026-10-01', end: '2026-12-31' }

interface Case {
  name: string
  transition: TransitionRecord | null
  q2: AllocationInput[]
  q3: AllocationInput[]
  /** [supplier, code, start, end] per expected bar, in order. */
  expected: [string, string, string, string][]
}

function tx(overrides: Partial<TransitionRecord>): TransitionRecord {
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

const cg = (): AllocationInput => ({ supplier: 'CG', code: 'REG', monthlyDays: {} })

const CASES: Case[] = [
  {
    // Two Q2 CG lines (PR + F_Gov) must collapse to a single bar.
    name: 'Amol Tate — early mover, F_Gov, no billing delay',
    transition: tx({
      lastWorkingDay: '2026-08-13',
      joiningDate: '2026-08-24',
      commercialStart: '2026-08-24',
    }),
    q2: [cg(), cg()],
    q3: [
      {
        supplier: 'TCS',
        code: 'REG',
        monthlyDays: { '2026-10-01': 22, '2026-11-01': 21, '2026-12-01': 21 },
      },
    ],
    expected: [
      ['CG', 'REG', '2026-07-01', '2026-08-13'],
      ['TCS', 'REG', '2026-10-01', '2026-12-31'],
    ],
  },
  {
    name: 'Dipti Borole — partial October start',
    transition: tx({
      lastWorkingDay: '2026-09-29',
      joiningDate: '2026-10-05',
      commercialStart: '2026-10-12',
    }),
    q2: [cg()],
    q3: [
      {
        supplier: 'TCS',
        code: 'REG',
        monthlyDays: { '2026-10-01': 15, '2026-11-01': 21, '2026-12-01': 21 },
      },
    ],
    expected: [
      ['CG', 'REG', '2026-07-01', '2026-09-29'],
      ['TCS', 'REG', '2026-10-12', '2026-12-31'],
    ],
  },
  {
    name: 'Praneeth Gudelli — 17 of 22 October days',
    transition: tx({
      lastWorkingDay: '2026-09-29',
      joiningDate: '2026-10-01',
      commercialStart: '2026-10-08',
    }),
    q2: [cg()],
    q3: [
      {
        supplier: 'TCS',
        code: 'REG',
        monthlyDays: { '2026-10-01': 17, '2026-11-01': 21, '2026-12-01': 21 },
      },
    ],
    expected: [
      ['CG', 'REG', '2026-07-01', '2026-09-29'],
      ['TCS', 'REG', '2026-10-08', '2026-12-31'],
    ],
  },
  {
    // No resignation on record at CG, so no last working day to clip Q2 with.
    name: 'Hitendrasinh Rajput — no LWD recorded',
    transition: tx({ lastWorkingDay: null, joiningDate: '2026-10-07', commercialStart: '2026-10-14' }),
    q2: [cg()],
    q3: [
      {
        supplier: 'TCS',
        code: 'REG',
        monthlyDays: { '2026-10-01': 13, '2026-11-01': 21, '2026-12-01': 21 },
      },
    ],
    expected: [
      ['CG', 'REG', '2026-07-01', '2026-09-30'],
      ['TCS', 'REG', '2026-10-14', '2026-12-31'],
    ],
  },
  {
    name: 'Makarand Parab — hypercare then TCS, end-anchored roll-off',
    transition: tx({
      lastWorkingDay: '2026-10-16',
      joiningDate: '2026-10-22',
      commercialStart: '2026-11-02',
    }),
    q2: [cg()],
    q3: [
      { supplier: 'CG', code: 'NPC', monthlyDays: { '2026-10-01': 12 } },
      {
        supplier: 'TCS',
        code: 'REG',
        monthlyDays: { '2026-10-01': 0, '2026-11-01': 21, '2026-12-01': 21 },
      },
    ],
    expected: [
      ['CG', 'REG', '2026-07-01', '2026-09-30'],
      ['CG', 'NPC', '2026-10-01', '2026-10-16'],
      ['TCS', 'REG', '2026-11-02', '2026-12-31'],
    ],
  },
  {
    name: 'Vipul Suriya — 11 of 21 November days',
    transition: tx({
      lastWorkingDay: '2026-10-30',
      joiningDate: '2026-11-09',
      commercialStart: '2026-11-16',
    }),
    q2: [cg()],
    q3: [
      { supplier: 'CG', code: 'NPC', monthlyDays: { '2026-10-01': 22 } },
      {
        supplier: 'TCS',
        code: 'REG',
        monthlyDays: { '2026-10-01': 0, '2026-11-01': 11, '2026-12-01': 21 },
      },
    ],
    expected: [
      ['CG', 'REG', '2026-07-01', '2026-09-30'],
      ['CG', 'NPC', '2026-10-01', '2026-10-30'],
      ['TCS', 'REG', '2026-11-16', '2026-12-31'],
    ],
  },
  {
    name: 'Nikhil Vibhav — signed, DOJ TBC, tentative 1 Dec start',
    transition: tx({
      lastWorkingDay: '2026-10-31',
      joiningDate: null,
      commercialStart: '2026-12-01',
      status: 'signed_doj_tbc',
      notes: 'Commercial start tentative — 1 Dec',
    }),
    q2: [cg()],
    q3: [
      { supplier: 'CG', code: 'NPC', monthlyDays: { '2026-10-01': 22 } },
      {
        supplier: 'TCS',
        code: 'REG',
        monthlyDays: { '2026-10-01': 0, '2026-11-01': 0, '2026-12-01': 21 },
      },
    ],
    expected: [
      ['CG', 'REG', '2026-07-01', '2026-09-30'],
      // LWD says 31 Oct — a Saturday. The cap gives the real 30th.
      ['CG', 'NPC', '2026-10-01', '2026-10-30'],
      ['TCS', 'REG', '2026-12-01', '2026-12-31'],
    ],
  },
  {
    name: 'Bharat Patil — hypercare only, no TCS move',
    transition: tx({ toSupplier: null, lastWorkingDay: '2026-10-31', status: 'not_moving' }),
    q2: [cg()],
    q3: [{ supplier: 'CG', code: 'NPC', monthlyDays: { '2026-10-01': 22 } }],
    expected: [
      ['CG', 'REG', '2026-07-01', '2026-09-30'],
      ['CG', 'NPC', '2026-10-01', '2026-10-30'],
    ],
  },
  {
    // No Q2 allocation at all — the view must not invent one.
    name: 'Pradeep Bolke — Q3 hypercare only, no Q2 line',
    transition: tx({ toSupplier: null, lastWorkingDay: '2026-10-31', status: 'left_platform' }),
    q2: [],
    q3: [{ supplier: 'CG', code: 'NPC', monthlyDays: { '2026-10-01': 22 } }],
    expected: [['CG', 'NPC', '2026-10-01', '2026-10-30']],
  },
  {
    name: 'Praneetha Bandlamudi — leaves mid-Q2',
    transition: tx({ toSupplier: null, lastWorkingDay: '2026-09-06', status: 'not_moving' }),
    q2: [cg()],
    q3: [],
    expected: [['CG', 'REG', '2026-07-01', '2026-09-06']],
  },
  {
    name: 'Prajwal Kumar — new TCS hire, November start',
    transition: tx({ fromSupplier: null, joiningDate: '2026-10-26' }),
    q2: [],
    q3: [
      {
        supplier: 'TCS',
        code: 'REG',
        monthlyDays: { '2026-10-01': 0, '2026-11-01': 21, '2026-12-01': 21 },
      },
    ],
    expected: [['TCS', 'REG', '2026-11-02', '2026-12-31']],
  },
  {
    // DOJ is 1 Sep but cover derives from full October days — the DOJ must not
    // pull the bar back into September.
    name: 'Mathivanan Pandurangan — established at TCS, DOJ ignored',
    transition: tx({ fromSupplier: null, joiningDate: '2026-09-01' }),
    q2: [],
    q3: [
      {
        supplier: 'TCS',
        code: 'REG',
        monthlyDays: { '2026-10-01': 22, '2026-11-01': 21, '2026-12-01': 21 },
      },
    ],
    expected: [['TCS', 'REG', '2026-10-01', '2026-12-31']],
  },
  {
    // 20 of 21 November days is regional calendar noise, not a partial month.
    name: 'Deva Palanisamy — 1-day November variance absorbed',
    transition: tx({ fromSupplier: null, joiningDate: '2026-09-01' }),
    q2: [],
    q3: [
      {
        supplier: 'TCS',
        code: 'REG',
        monthlyDays: { '2026-10-01': 22, '2026-11-01': 20, '2026-12-01': 21 },
      },
    ],
    expected: [['TCS', 'REG', '2026-10-01', '2026-12-31']],
  },
  {
    // Hypercare without a transition record — an incumbent, not a roll-off.
    name: 'Manasi Ketkar — 5 days hypercare, no transition record',
    transition: null,
    q2: [cg()],
    q3: [{ supplier: 'CG', code: 'NPC', monthlyDays: { '2026-10-01': 5 } }],
    expected: [
      ['CG', 'REG', '2026-07-01', '2026-09-30'],
      ['CG', 'NPC', '2026-10-01', '2026-10-07'],
    ],
  },
  {
    // Round 4 bug fix: this Happy Team resource has a real, confirmed Q3
    // allocation (HT, 64 capacity days) with zero rows in
    // resource_period_allocation_monthly_days. Before the fix, the missing
    // monthly breakdown made the Q3 segment vanish entirely — rendering as
    // if he'd stopped on 30 September and tagging him "Not moving". No
    // monthly breakdown means "render flat for the whole quarter" (Q2's own
    // fallback), never "no Q3 presence".
    name: 'Adam Dobrzeniewski — Happy Team, confirmed Q3 allocation, no monthly breakdown',
    transition: null,
    q2: [{ supplier: 'HT', code: 'REG', monthlyDays: {} }],
    q3: [{ supplier: 'HT', code: 'REG', monthlyDays: {} }],
    expected: [
      ['HT', 'REG', '2026-07-01', '2026-09-30'],
      ['HT', 'REG', '2026-10-01', '2026-12-31'],
    ],
  },
  {
    // Same Happy Team bug shape, a second resource — Matt flagged this
    // supplier specifically as missing from the timeline.
    name: 'Jan Urbaniak — Happy Team, confirmed Q3 allocation, no monthly breakdown',
    transition: null,
    q2: [{ supplier: 'HT', code: 'REG', monthlyDays: {} }],
    q3: [{ supplier: 'HT', code: 'REG', monthlyDays: {} }],
    expected: [
      ['HT', 'REG', '2026-07-01', '2026-09-30'],
      ['HT', 'REG', '2026-10-01', '2026-12-31'],
    ],
  },
  {
    // The EPAM/Helion team named in the round 4 bug report — same shape:
    // real Q3 allocations, zero monthly rows, confirmed against the live DB.
    name: 'Aliaksei Yakimovich — EPAM, confirmed Q3 allocation, no monthly breakdown',
    transition: null,
    q2: [{ supplier: 'EPAM', code: 'REG', monthlyDays: {} }],
    q3: [{ supplier: 'EPAM', code: 'REG', monthlyDays: {} }],
    expected: [
      ['EPAM', 'REG', '2026-07-01', '2026-09-30'],
      ['EPAM', 'REG', '2026-10-01', '2026-12-31'],
    ],
  },
  {
    name: 'Rachel Hatcher — EPAM, confirmed Q3 allocation, no monthly breakdown',
    transition: null,
    q2: [{ supplier: 'EPAM', code: 'REG', monthlyDays: {} }],
    q3: [{ supplier: 'EPAM', code: 'REG', monthlyDays: {} }],
    expected: [
      ['EPAM', 'REG', '2026-07-01', '2026-09-30'],
      ['EPAM', 'REG', '2026-10-01', '2026-12-31'],
    ],
  },
  {
    name: 'Freddie Leigh-Akompi — EPAM, confirmed Q3 allocation, no monthly breakdown',
    transition: null,
    q2: [{ supplier: 'EPAM', code: 'REG', monthlyDays: {} }],
    q3: [{ supplier: 'EPAM', code: 'REG', monthlyDays: {} }],
    expected: [
      ['EPAM', 'REG', '2026-07-01', '2026-09-30'],
      ['EPAM', 'REG', '2026-10-01', '2026-12-31'],
    ],
  },
  {
    name: 'Bence Daroczi — EPAM, confirmed Q3 allocation, no monthly breakdown',
    transition: null,
    q2: [{ supplier: 'EPAM', code: 'REG', monthlyDays: {} }],
    q3: [{ supplier: 'EPAM', code: 'REG', monthlyDays: {} }],
    expected: [
      ['EPAM', 'REG', '2026-07-01', '2026-09-30'],
      ['EPAM', 'REG', '2026-10-01', '2026-12-31'],
    ],
  },
  {
    name: 'Dzianis Roi — EPAM, confirmed Q3 allocation, no monthly breakdown',
    transition: null,
    q2: [{ supplier: 'EPAM', code: 'REG', monthlyDays: {} }],
    q3: [{ supplier: 'EPAM', code: 'REG', monthlyDays: {} }],
    expected: [
      ['EPAM', 'REG', '2026-07-01', '2026-09-30'],
      ['EPAM', 'REG', '2026-10-01', '2026-12-31'],
    ],
  },
]

describe('Dudley cohort — real data against approved geometry', () => {
  it.each(CASES)('$name', ({ transition, q2, q3, expected }) => {
    const segments = deriveSegments({
      transition,
      coarseAllocations: q2,
      granularAllocations: q3,
      coarseWindow: Q2,
      granularWindow: Q3,
      bankHolidays: BANK_HOLIDAYS,
    })

    expect(segments.map((s) => [s.supplier, s.code, s.start, s.end])).toEqual(expected)
  })
})

describe('Dudley cohort — coverage gaps', () => {
  it('flags the real gap between hypercare ending and a December TCS start', () => {
    // Poornachandran Ramakrishnan: CG hypercare to 30 Oct, TCS from 1 Dec.
    const segments = deriveSegments({
      transition: tx({ lastWorkingDay: '2026-11-04', commercialStart: '2026-12-01' }),
      coarseAllocations: [cg()],
      granularAllocations: [
        { supplier: 'CG', code: 'NPC', monthlyDays: { '2026-10-01': 22 } },
        {
          supplier: 'TCS',
          code: 'REG',
          monthlyDays: { '2026-10-01': 0, '2026-11-01': 0, '2026-12-01': 21 },
        },
      ],
      coarseWindow: Q2,
      granularWindow: Q3,
      bankHolidays: BANK_HOLIDAYS,
    })

    expect(deriveGaps(segments, BANK_HOLIDAYS)).toEqual([
      { start: '2026-10-30', end: '2026-12-01' },
    ])
  })
})

describe('Dudley cohort — classification', () => {
  const cases: [string, TransitionRecord | null, string][] = [
    ['Amol Tate', tx({}), 'mover'],
    ['Nikhil Vibhav', tx({ status: 'signed_doj_tbc' }), 'mover_doj_tbc'],
    ['Prajwal Kumar', tx({ fromSupplier: null }), 'joiner'],
    ['Manasi Ketkar', null, 'incumbent'],
  ]

  it.each(cases)('%s classifies as %s', (_name, transition, expected) => {
    const segments = deriveSegments({
      transition,
      coarseAllocations: [cg()],
      granularAllocations: [
        { supplier: 'TCS', code: 'REG', monthlyDays: { '2026-10-01': 22, '2026-11-01': 21 } },
      ],
      coarseWindow: Q2,
      granularWindow: Q3,
      bankHolidays: BANK_HOLIDAYS,
    })

    expect(classifyTransition(transition, segments, Q3.start).status).toBe(expected)
  })
})
