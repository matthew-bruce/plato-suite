import { describe, expect, it } from 'vitest'
import { getFilterPillStyle } from '../PageToolbarFilterPill'

describe('getFilterPillStyle', () => {
  it('active hex colour: solid fill + white text', () => {
    const s = getFilterPillStyle('#003C82', true, false)
    expect(s.background).toBe('#003C82')
    expect(s.color).toBe('#FFFFFF')
    expect(s.borderColor).toBe('#003C82')
  })

  it('inactive hex colour: tinted background with 12 alpha', () => {
    const s = getFilterPillStyle('#003C82', false, false)
    expect(s.background).toBe('#003C82' + '12')
    expect(s.color).toBe('#003C82')
    expect(s.borderColor).toBe('#003C82' + '38')
    expect(s.filter).toBeUndefined()
  })

  it('inactive hovered: applies brightness filter', () => {
    const s = getFilterPillStyle('#003C82', false, true)
    expect(s.filter).toContain('brightness')
  })

  it('--all sentinel active: black solid', () => {
    const s = getFilterPillStyle('--all', true, false)
    expect(s.background).toBe('var(--rmg-color-black)')
    expect(s.color).toBe('#fff')
    expect(s.borderColor).toBe('var(--rmg-color-black)')
  })

  it('--all sentinel inactive: transparent with grey border', () => {
    const s = getFilterPillStyle('--all', false, false)
    expect(s.background).toBe('transparent')
    expect(s.color).toBe('var(--rmg-color-dark-grey)')
    expect(s.borderColor).toBe('var(--rmg-color-grey-2)')
  })

  it('--all sentinel inactive hovered: applies brightness filter', () => {
    const s = getFilterPillStyle('--all', false, true)
    expect(s.filter).toContain('brightness')
  })

  it('always sets pill base styles', () => {
    const s = getFilterPillStyle('#003C82', true, false)
    expect(s.borderRadius).toBe('var(--rmg-radius-xl)')
    expect(s.padding).toBe('4px 12px')
    expect(s.fontSize).toBe('11px')
    expect(s.fontWeight).toBe(600)
    expect(s.cursor).toBe('pointer')
    expect(s.whiteSpace).toBe('nowrap')
  })

  it('empty string colour: falls back, does not throw', () => {
    expect(() => getFilterPillStyle('', false, false)).not.toThrow()
    const s = getFilterPillStyle('', true, false)
    expect(s.background).toBe('#8F9495')
    expect(s.color).toBe('#FFFFFF')
  })

  it('garbage colour value: falls back gracefully', () => {
    const s = getFilterPillStyle('not-a-hex', true, false)
    expect(s.background).toBe('#8F9495')
  })

  it('3-char hex is accepted', () => {
    const s = getFilterPillStyle('#abc', true, false)
    expect(s.background).toBe('#abc')
  })
})
