import { describe, it, expect } from 'vitest'
import {
  EXPORT_VARIANTS,
  EXPORT_VARIANT_IDS,
  DEFAULT_EXPORT_VARIANT_ID,
  parseExportVariantId,
  getExportVariant,
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

/* ══════════════════════════════════════════════════════════════════════
   There is no cost-visibility control any more, on any variant.

   Each file now has exactly one answer built into it — the Team Schedule
   carries no commercial content at all, the Supplier Schedule is
   commercial-only — because an export-time option only keeps supplier rates
   from the wrong reader when whoever exports it picks correctly every time.
   These tests pin the ABSENCE, so reintroducing a toggle has to be a
   deliberate act that breaks them rather than a quiet addition.
══════════════════════════════════════════════════════════════════════ */

describe('no variant offers a cost-visibility choice', () => {
  it('exposes no cost-visibility field on any registered variant', () => {
    for (const variant of EXPORT_VARIANTS) {
      expect(variant).not.toHaveProperty('costVisibility')
    }
  })

  it('gives the Team Schedule no note and nothing to choose — just a team', () => {
    const team = getExportVariant('team-schedule')
    expect(team.scope).toBe('team')
    expect(team.note).toBeUndefined()
  })

  it('keeps the Supplier Schedule’s fixed note, which states rather than offers', () => {
    expect(getExportVariant('supplier-schedule').note).toBe(
      'Always shows commercial cost only — the figure suppliers need for reconciliation.',
    )
  })

  it('describes the Team Schedule as carrying no supplier rates', () => {
    // The description is what a user reads before clicking Export; it should
    // say the file is safe to forward, since that is now structurally true.
    expect(getExportVariant('team-schedule').description).toContain('no supplier rates')
  })
})
