import { describe, expect, it } from 'vitest'
import { calculateConfirmedCount } from '../ui'

describe('calculateConfirmedCount', () => {
  it('returns 0/0 for an empty array', () => {
    expect(calculateConfirmedCount([])).toEqual({ confirmed: 0, total: 0 })
  })

  it('returns confirmed = total when every row is confirmed', () => {
    const rows = [{ is_confirmed: true }, { is_confirmed: true }, { is_confirmed: true }]
    expect(calculateConfirmedCount(rows)).toEqual({ confirmed: 3, total: 3 })
  })

  it('returns confirmed = 0 when no row is confirmed', () => {
    const rows = [{ is_confirmed: false }, { is_confirmed: false }]
    expect(calculateConfirmedCount(rows)).toEqual({ confirmed: 0, total: 2 })
  })

  it('counts only the confirmed rows in a mixed set', () => {
    const rows = [
      { is_confirmed: true },
      { is_confirmed: false },
      { is_confirmed: true },
      { is_confirmed: false },
      { is_confirmed: false },
    ]
    expect(calculateConfirmedCount(rows)).toEqual({ confirmed: 2, total: 5 })
  })
})
