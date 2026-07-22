import { describe, expect, it } from 'vitest'
import { isValidEmail, validatePasswordReset, MIN_PASSWORD_LENGTH } from '../validation'

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('matt@bruceweb.com.au')).toBe(true)
    expect(isValidEmail('a.b+tag@example.co')).toBe(true)
  })

  it('trims surrounding whitespace before validating', () => {
    expect(isValidEmail('  matt@bruceweb.com.au  ')).toBe(true)
  })

  it('rejects malformed addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('matt')).toBe(false)
    expect(isValidEmail('matt@')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('matt@example')).toBe(false)
    expect(isValidEmail('matt @example.com')).toBe(false)
  })
})

describe('validatePasswordReset', () => {
  const valid = 'correcthorse'

  it('accepts a long-enough matching pair', () => {
    expect(validatePasswordReset({ password: valid, confirmPassword: valid })).toEqual({ ok: true })
  })

  it('rejects a password below the minimum length', () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1)
    const result = validatePasswordReset({ password: short, confirmPassword: short })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/at least/i)
  })

  it('accepts a password exactly at the minimum length', () => {
    const exact = 'a'.repeat(MIN_PASSWORD_LENGTH)
    expect(validatePasswordReset({ password: exact, confirmPassword: exact })).toEqual({ ok: true })
  })

  it('rejects a mismatched confirmation', () => {
    const result = validatePasswordReset({ password: valid, confirmPassword: valid + 'x' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/do not match/i)
  })

  it('checks length before match (a too-short mismatch reports length)', () => {
    const result = validatePasswordReset({ password: 'abc', confirmPassword: 'def' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/at least/i)
  })
})
