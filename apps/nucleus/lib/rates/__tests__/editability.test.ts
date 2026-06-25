import { describe, expect, it } from 'vitest'
import { getRateEditability, RATE_EDIT_WARNING } from '../editability'

describe('getRateEditability', () => {
  it('locked period is hard-blocked regardless of status', () => {
    expect(getRateEditability({ locked: true, period_status: 'draft' })).toEqual({ kind: 'locked' })
    expect(getRateEditability({ locked: true, period_status: 'active' })).toEqual({ kind: 'locked' })
    expect(getRateEditability({ locked: true, period_status: 'historic' })).toEqual({ kind: 'locked' })
  })

  it('unlocked draft period is fully editable with no warning', () => {
    expect(getRateEditability({ locked: false, period_status: 'draft' })).toEqual({ kind: 'editable' })
  })

  it('unlocked active period is editable but requires the soft warning', () => {
    expect(getRateEditability({ locked: false, period_status: 'active' })).toEqual({
      kind: 'warn',
      message: RATE_EDIT_WARNING,
    })
  })

  it('unlocked historic period is editable but requires the soft warning', () => {
    expect(getRateEditability({ locked: false, period_status: 'historic' })).toEqual({
      kind: 'warn',
      message: RATE_EDIT_WARNING,
    })
  })

  it('null period (no period context) is freely editable', () => {
    expect(getRateEditability(null)).toEqual({ kind: 'editable' })
  })
})
