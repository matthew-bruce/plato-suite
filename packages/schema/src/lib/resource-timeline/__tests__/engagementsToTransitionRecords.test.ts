import { describe, expect, it } from 'vitest'
import { deriveGaps } from '../deriveSegments'
import { engagementsToTransitionRecords } from '../engagementsToTransitionRecords'
import type { EngagementRecord } from '../types'

let nextId = 0

function eng(overrides: Partial<EngagementRecord> = {}): EngagementRecord {
  nextId += 1
  return {
    engagementId: `e${nextId}`,
    resourceId: 'r1',
    supplier: 'CG',
    rollOnDate: '2026-07-01',
    rollOffDate: null,
    rollOnEstimated: true,
    rollOnTentative: false,
    ...overrides,
  }
}

describe('engagementsToTransitionRecords', () => {
  it('translates a confirmed move', () => {
    const records = engagementsToTransitionRecords([
      eng({ supplier: 'CG', rollOffDate: '2026-10-16' }),
      eng({ supplier: 'TCS', rollOnDate: '2026-10-26', rollOnEstimated: false }),
    ])

    expect(records.get('r1')).toEqual({
      fromSupplier: 'CG',
      toSupplier: 'TCS',
      lastWorkingDay: '2026-10-16',
      joiningDate: null,
      commercialStart: '2026-10-26',
      status: 'confirmed',
      notes: null,
    })
  })

  it('marks a move tentative when the incoming roll-on is tentative', () => {
    const records = engagementsToTransitionRecords([
      eng({ supplier: 'CG', rollOffDate: '2026-10-30' }),
      eng({ supplier: 'TCS', rollOnDate: '2026-11-02', rollOnEstimated: false, rollOnTentative: true }),
    ])

    expect(records.get('r1')?.status).toBe('signed_doj_tbc')
  })

  it('carries a null roll-off through as a null last working day, which produces no gap', () => {
    const records = engagementsToTransitionRecords([
      eng({ supplier: 'CG', rollOffDate: null }),
      eng({ supplier: 'TCS', rollOnDate: '2026-11-02', rollOnEstimated: false }),
    ])

    const record = records.get('r1')!
    expect(record).toMatchObject({ fromSupplier: 'CG', toSupplier: 'TCS', lastWorkingDay: null })
    expect(deriveGaps(record)).toEqual([])
  })

  it('translates a roll-off with no successor', () => {
    const records = engagementsToTransitionRecords([
      eng({ supplier: 'CG', rollOffDate: '2026-09-30' }),
    ])

    expect(records.get('r1')).toEqual({
      fromSupplier: 'CG',
      toSupplier: null,
      lastWorkingDay: '2026-09-30',
      joiningDate: null,
      commercialStart: null,
      status: 'not_moving',
      notes: null,
    })
  })

  it('translates a new hire', () => {
    const records = engagementsToTransitionRecords([
      eng({ supplier: 'TCS', rollOnDate: '2026-11-09', rollOnEstimated: false }),
    ])

    expect(records.get('r1')).toEqual({
      fromSupplier: null,
      toSupplier: 'TCS',
      lastWorkingDay: null,
      joiningDate: '2026-11-09',
      commercialStart: null,
      status: 'confirmed',
      notes: null,
    })
  })

  it('produces no record for a single estimated engagement', () => {
    const records = engagementsToTransitionRecords([eng({ supplier: 'TCS', rollOnEstimated: true })])

    expect(records.has('r1')).toBe(false)
  })

  it('uses the latest pair across three engagements A → B → C', () => {
    const records = engagementsToTransitionRecords([
      // Deliberately out of order: the translator sorts by roll_on_date.
      eng({ supplier: 'HT', rollOnDate: '2026-11-16', rollOnEstimated: false }),
      eng({ supplier: 'CG', rollOnDate: '2026-07-01', rollOffDate: '2026-08-14' }),
      eng({ supplier: 'TCS', rollOnDate: '2026-08-17', rollOnEstimated: false, rollOffDate: '2026-11-13' }),
    ])

    expect(records.get('r1')).toMatchObject({
      fromSupplier: 'TCS',
      toSupplier: 'HT',
      lastWorkingDay: '2026-11-13',
      commercialStart: '2026-11-16',
    })
  })

  it('keeps resources separate', () => {
    const records = engagementsToTransitionRecords([
      eng({ resourceId: 'r1', supplier: 'CG', rollOffDate: '2026-09-30' }),
      eng({ resourceId: 'r2', supplier: 'TCS', rollOnDate: '2026-10-05', rollOnEstimated: false }),
    ])

    expect(records.get('r1')?.status).toBe('not_moving')
    expect(records.get('r2')?.toSupplier).toBe('TCS')
    expect(records.size).toBe(2)
  })
})
