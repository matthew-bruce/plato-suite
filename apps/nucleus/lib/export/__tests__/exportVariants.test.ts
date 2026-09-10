import { describe, it, expect } from 'vitest'
import {
  EXPORT_VARIANTS,
  EXPORT_VARIANT_IDS,
  DEFAULT_EXPORT_VARIANT_ID,
  parseExportVariantId,
  getExportVariant,
  resolveCostVisibility,
  showsCommercialCost,
  showsInternalCost,
  isRateSensitive,
} from '../exportVariants'

describe('export variant registry', () => {
  it('registers exactly one entry per id, in registry order', () => {
    expect(EXPORT_VARIANTS.map((v) => v.id)).toEqual([...EXPORT_VARIANT_IDS])
  })

  it('offers the Finance-safe file first, and defaults to it', () => {
    expect(EXPORT_VARIANTS[0].id).toBe('rate-calculator')
    expect(DEFAULT_EXPORT_VARIANT_ID).toBe('rate-calculator')
  })

  it('falls back to the default for an unknown or absent variant', () => {
    expect(parseExportVariantId('team-schedule')).toBe('team-schedule')
    expect(parseExportVariantId('nonsense')).toBe(DEFAULT_EXPORT_VARIANT_ID)
    expect(parseExportVariantId(null)).toBe(DEFAULT_EXPORT_VARIANT_ID)
  })

  it('scopes the two new variants to the entity each needs', () => {
    expect(getExportVariant('team-schedule').scope).toBe('team')
    expect(getExportVariant('supplier-schedule').scope).toBe('supplier')
    // The whole-platform files ask for nothing further.
    expect(getExportVariant('rate-calculator').scope).toBeUndefined()
    expect(getExportVariant('platform-schedule').scope).toBeUndefined()
  })
})

describe('cost visibility', () => {
  it('defaults the Team Schedule to internal-only — the forwardable file', () => {
    expect(resolveCostVisibility('team-schedule', null)).toBe('internal')
  })

  it('honours an explicit Team Schedule choice', () => {
    expect(resolveCostVisibility('team-schedule', 'commercial')).toBe('commercial')
    expect(resolveCostVisibility('team-schedule', 'both')).toBe('both')
  })

  it('falls back to the default for a nonsense Team Schedule value', () => {
    expect(resolveCostVisibility('team-schedule', 'everything')).toBe('internal')
  })

  // A hand-edited query string must not be able to change what a variant that
  // fixes its own visibility will show — in either direction.
  it('ignores any requested value on the Supplier Schedule', () => {
    expect(resolveCostVisibility('supplier-schedule', null)).toBe('commercial')
    expect(resolveCostVisibility('supplier-schedule', 'internal')).toBe('commercial')
    expect(resolveCostVisibility('supplier-schedule', 'both')).toBe('commercial')
  })

  it('states the Supplier Schedule’s fixed note for the modal to show', () => {
    const control = getExportVariant('supplier-schedule').costVisibility
    expect(control.kind).toBe('fixed')
    if (control.kind === 'fixed') {
      expect(control.note).toBe(
        'Always shows commercial cost only — the figure suppliers need for reconciliation.',
      )
    }
  })

  it('maps each visibility to the cost groups it shows', () => {
    expect(showsInternalCost('internal')).toBe(true)
    expect(showsCommercialCost('internal')).toBe(false)

    expect(showsCommercialCost('commercial')).toBe(true)
    expect(showsInternalCost('commercial')).toBe(false)

    expect(showsCommercialCost('both')).toBe(true)
    expect(showsInternalCost('both')).toBe(true)
  })

  it('flags exactly the visibilities that put supplier rates in the file', () => {
    expect(isRateSensitive('internal')).toBe(false)
    expect(isRateSensitive('commercial')).toBe(true)
    expect(isRateSensitive('both')).toBe(true)
  })
})
