'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_EXPORT_VARIANT_ID,
  EXPORT_VARIANTS,
  getExportVariant,
} from '@/lib/export/exportVariants'
import type { ExportVariant, ExportVariantId } from '@/lib/export/exportVariants'

/**
 * Which workbook to export for this period, and — for the variants that need
 * it — what to scope it to.
 *
 * Renders whatever EXPORT_VARIANTS contains rather than a fixed set of
 * options, and renders each variant's extra controls from what that variant
 * DECLARES it needs (a team picker, a supplier picker, a fixed note) rather
 * than from an `if (id === 'team-schedule')` here. Adding a fifth variant that
 * needs a picker means adding a `scope` to its registry entry; this component
 * does not need to know it happened.
 *
 * There is deliberately no control here for whose money a file shows. Each
 * variant has exactly one answer built into it, so there is nothing to get
 * wrong at export time — see the note at the top of lib/export/exportVariants.
 *
 * Styling is inline against --rmg-* tokens per ADR-023 — no hardcoded hex, and
 * the same overlay/card/header/footer shape the other Schedule modals use
 * (EditTeamsModal, CreatePeriodWizard) rather than a new pattern.
 */
export interface ExportScopeOption {
  id: string
  label: string
}

/** Everything the export route needs to build the chosen file. */
export interface ExportSelection {
  variantId: ExportVariantId
  teamId?: string
  supplierId?: string
}

export interface ExportChoiceModalProps {
  open: boolean
  periodName: string
  /** Teams present in this period, for the team-scoped variants' picker. */
  teams: readonly ExportScopeOption[]
  /** Suppliers present in this period, for the supplier-scoped variants' picker. */
  suppliers: readonly ExportScopeOption[]
  /** True while the chosen file is being built, to hold the modal open. */
  busy?: boolean
  onClose: () => void
  onConfirm: (selection: ExportSelection) => void
}

export function ExportChoiceModal({
  open,
  periodName,
  teams,
  suppliers,
  busy = false,
  onClose,
  onConfirm,
}: ExportChoiceModalProps) {
  const [selected, setSelected] = useState<ExportVariantId>(DEFAULT_EXPORT_VARIANT_ID)
  const [hovered, setHovered] = useState<ExportVariantId | null>(null)
  const [teamId, setTeamId] = useState<string>('')
  const [supplierId, setSupplierId] = useState<string>('')

  const variant = useMemo(() => getExportVariant(selected), [selected])

  // Reopening always starts from the Finance-safe default rather than
  // remembering the last, broader choice.
  useEffect(() => {
    if (!open) return
    setSelected(DEFAULT_EXPORT_VARIANT_ID)
    setHovered(null)
    setTeamId('')
    setSupplierId('')
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

  const scopeChosen =
    variant.scope === 'team' ? teamId !== '' : variant.scope === 'supplier' ? supplierId !== '' : true

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

  const fieldLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    color: 'var(--rmg-color-text-light)',
  }

  const selectStyle: React.CSSProperties = {
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 13,
    padding: '7px 9px',
    borderRadius: 6,
    border: '1px solid var(--rmg-color-grey-2)',
    background: 'var(--rmg-color-surface-white)',
    color: 'var(--rmg-color-text-heading)',
    width: '100%',
    maxWidth: '100%',
    cursor: busy ? 'not-allowed' : 'pointer',
  }

  function renderScopePicker(v: ExportVariant) {
    if (!v.scope) return null
    const isTeam = v.scope === 'team'
    const options = isTeam ? teams : suppliers
    const value = isTeam ? teamId : supplierId
    const setValue = isTeam ? setTeamId : setSupplierId
    const noun = isTeam ? 'team' : 'supplier'

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={fieldLabel}>{isTeam ? 'Team' : 'Supplier'}</span>
        {options.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--rmg-color-text-light)' }}>
            No {noun}s in this period.
          </span>
        ) : (
          <select
            value={value}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
            style={selectStyle}
            aria-label={`Choose a ${noun}`}
          >
            <option value="">Choose a {noun}…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>
    )
  }

  /**
   * A variant's fixed note, where it has one. Stating something the reader
   * cannot change — not a control, and no longer backed by one.
   */
  function renderNote(v: ExportVariant) {
    if (!v.note) return null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={fieldLabel}>Cost shown</span>
        <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--rmg-color-text-light)' }}>
          {v.note}
        </span>
      </div>
    )
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
          {EXPORT_VARIANTS.map((v) => {
            const isSelected = v.id === selected
            const isHovered = v.id === hovered
            const hasExtras = Boolean(v.scope) || Boolean(v.note)
            return (
              <div
                key={v.id}
                onMouseEnter={() => setHovered(v.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  borderRadius: 8,
                  border: `1.5px solid ${
                    isSelected ? 'var(--rmg-color-red)' : 'var(--rmg-color-grey-2)'
                  }`,
                  background: isSelected
                    ? 'var(--rmg-color-tint-red)'
                    : isHovered
                    ? 'var(--rmg-color-grey-4)'
                    : 'var(--rmg-color-surface-white)',
                  transition: 'background 120ms ease, border-color 120ms ease',
                  overflow: 'hidden',
                }}
              >
                {/* The radio and its description stay inside a <label> so the
                    whole block is a click target; the extra controls below sit
                    OUTSIDE it, or using a picker would re-toggle the radio. */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '14px 16px',
                    cursor: busy ? 'not-allowed' : 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="export-variant"
                    value={v.id}
                    checked={isSelected}
                    disabled={busy}
                    onChange={() => setSelected(v.id)}
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
                        {v.label}
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
                        {v.audience}
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: 'var(--rmg-color-text-light)',
                      }}
                    >
                      {v.description}
                    </span>
                  </span>
                </label>

                {isSelected && hasExtras && (
                  <div
                    style={{
                      borderTop: '1px solid var(--rmg-color-grey-3)',
                      padding: '12px 16px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      background: 'var(--rmg-color-surface-white)',
                    }}
                  >
                    {renderScopePicker(v)}
                    {renderNote(v)}
                  </div>
                )}
              </div>
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
            disabled={busy || !scopeChosen}
            onClick={() =>
              onConfirm({
                variantId: selected,
                teamId: variant.scope === 'team' ? teamId : undefined,
                supplierId: variant.scope === 'supplier' ? supplierId : undefined,
              })
            }
            style={{
              ...btnBase,
              background:
                busy || !scopeChosen ? 'var(--rmg-color-grey-2)' : 'var(--rmg-color-red)',
              color: 'var(--rmg-color-white)',
              cursor: busy || !scopeChosen ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Building…' : 'Export as .xlsx'}
          </button>
        </div>
      </div>
    </div>
  )
}
