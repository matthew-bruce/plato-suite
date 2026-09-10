'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_EXPORT_VARIANT_ID,
  EXPORT_VARIANTS,
} from '@/lib/export/exportVariants'
import type { ExportVariantId } from '@/lib/export/exportVariants'

/**
 * Which workbook to export for this period.
 *
 * Renders whatever EXPORT_VARIANTS contains rather than a two-way toggle:
 * team-scoped and supplier-scoped variants are planned, and adding one should
 * mean appending an entry to that array, not restructuring this component.
 * Nothing here knows how many options there are or what any particular one
 * means.
 *
 * Styling is inline against --rmg-* tokens per ADR-023 — no hardcoded hex, and
 * the same overlay/card/header/footer shape the other Schedule modals use
 * (EditTeamsModal, CreatePeriodWizard) rather than a new pattern.
 */
export interface ExportChoiceModalProps {
  open: boolean
  periodName: string
  /** True while the chosen file is being built, to hold the modal open. */
  busy?: boolean
  onClose: () => void
  onConfirm: (variantId: ExportVariantId) => void
}

export function ExportChoiceModal({
  open,
  periodName,
  busy = false,
  onClose,
  onConfirm,
}: ExportChoiceModalProps) {
  const [selected, setSelected] = useState<ExportVariantId>(DEFAULT_EXPORT_VARIANT_ID)
  const [hovered, setHovered] = useState<ExportVariantId | null>(null)

  // Reopening always starts from the Finance-safe default rather than
  // remembering the last, broader choice.
  useEffect(() => {
    if (open) {
      setSelected(DEFAULT_EXPORT_VARIANT_ID)
      setHovered(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(241, 242, 245, 0.88)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    // At 390px the card needs to breathe at the edges rather than butt up
    // against them; this also keeps a tall list scrollable on a short screen.
    padding: 16,
  }

  const card: React.CSSProperties = {
    background: 'var(--rmg-color-surface-white)',
    borderRadius: 12,
    width: 520,
    maxWidth: '100%',
    maxHeight: 'calc(100vh - 32px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
    fontFamily: 'var(--rmg-font-body)',
  }

  const btnBase: React.CSSProperties = {
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: 6,
    padding: '7px 16px',
    border: 'none',
  }

  return (
    <div
      style={overlay}
      onClick={() => {
        if (!busy) onClose()
      }}
      role="dialog"
      aria-modal
      aria-label="Choose an export"
    >
      <div style={card} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            background: 'var(--rmg-color-black)',
            color: 'var(--rmg-color-text-dark-heading)',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>Export {periodName}</span>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: busy ? 'not-allowed' : 'pointer',
              color: 'var(--rmg-color-text-dark-heading)',
              fontSize: 18,
              lineHeight: 1,
              padding: '2px 6px',
              fontFamily: 'var(--rmg-font-body)',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Options — one per registered variant, in registry order */}
        <div
          style={{
            padding: 20,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {EXPORT_VARIANTS.map((variant) => {
            const isSelected = variant.id === selected
            const isHovered = variant.id === hovered
            return (
              <label
                key={variant.id}
                onMouseEnter={() => setHovered(variant.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 8,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  border: `1.5px solid ${
                    isSelected ? 'var(--rmg-color-red)' : 'var(--rmg-color-grey-2)'
                  }`,
                  background: isSelected
                    ? 'var(--rmg-color-tint-red)'
                    : isHovered
                    ? 'var(--rmg-color-grey-4)'
                    : 'var(--rmg-color-surface-white)',
                  transition: 'background 120ms ease, border-color 120ms ease',
                }}
              >
                <input
                  type="radio"
                  name="export-variant"
                  value={variant.id}
                  checked={isSelected}
                  disabled={busy}
                  onChange={() => setSelected(variant.id)}
                  style={{
                    marginTop: 3,
                    accentColor: 'var(--rmg-color-red)',
                    flexShrink: 0,
                    cursor: busy ? 'not-allowed' : 'pointer',
                  }}
                />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--rmg-color-text-heading)',
                      }}
                    >
                      {variant.label}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: 0.3,
                        textTransform: 'uppercase',
                        padding: '2px 7px',
                        borderRadius: 999,
                        background: 'var(--rmg-color-grey-3)',
                        color: 'var(--rmg-color-text-light)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {variant.audience}
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      lineHeight: 1.45,
                      color: 'var(--rmg-color-text-light)',
                    }}
                  >
                    {variant.description}
                  </span>
                </span>
              </label>
            )
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid var(--rmg-color-grey-3)',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexShrink: 0,
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              ...btnBase,
              background: 'transparent',
              color: 'var(--rmg-color-dark-grey)',
              border: '1px solid var(--rmg-color-grey-2)',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            disabled={busy}
            style={{
              ...btnBase,
              background: busy ? 'var(--rmg-color-grey-2)' : 'var(--rmg-color-red)',
              color: 'var(--rmg-color-white)',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Building…' : 'Export as .xlsx'}
          </button>
        </div>
      </div>
    </div>
  )
}
