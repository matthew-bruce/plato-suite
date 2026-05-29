// React Testing Library is not installed in this repo. Instead of mounting
// the component, this file tests the pure helper that resolves the
// component's border colour for default and focus states. The full focus
// integration test is covered manually in /design-system.

import { describe, expect, it } from 'vitest'
import { resolveSearchBorderColor } from '../PageToolbarSearch'

describe('resolveSearchBorderColor', () => {
  it('returns the grey-2 token when not focused (default state)', () => {
    expect(resolveSearchBorderColor(false)).toBe('var(--rmg-color-grey-2)')
  })

  it('returns the dark-grey token when focused', () => {
    expect(resolveSearchBorderColor(true)).toBe('var(--rmg-color-dark-grey)')
  })

  it('is referentially stable per input (no side effects)', () => {
    const a = resolveSearchBorderColor(false)
    const b = resolveSearchBorderColor(false)
    expect(a).toBe(b)
  })
})
