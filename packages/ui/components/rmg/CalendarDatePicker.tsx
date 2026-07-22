'use client'

import React, { useCallback, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarPanel } from './CalendarPanel'
import { formatDisplay } from '../../utils/calendarGrid'
import { computeCalendarPopupPosition, type CalendarPopupPosition } from '../../utils/calendarPopupPosition'

export interface CalendarDatePickerProps {
  /** Selected date as a YYYY-MM-DD ISO string ('' for none). Controlled. */
  value: string
  /** Called with the newly-picked ISO date when the user commits (Done/Enter). */
  onChange: (iso: string) => void
  /** Optional inclusive bounds (YYYY-MM-DD); days outside are disabled. */
  minDate?: string
  maxDate?: string
  /** Field label. Omit (or leave '') to render no label at all — for dense
   *  contexts (e.g. a table cell) where a column header already labels it. */
  label?: string
  /** Placeholder shown when no date is selected. */
  placeholder?: string
  disabled?: boolean
  required?: boolean
  size?: 'small' | 'large'
  name?: string
  /** Merged on top of the trigger's default styling — for matching a
   *  surrounding context's own input styling (e.g. a table cell). */
  triggerStyle?: React.CSSProperties
  /** Show the trailing calendar icon. Default true (matches the original
   *  look); set false for dense contexts where sibling fields have none. */
  showIcon?: boolean
}

const DEFAULT_POPUP_HEIGHT_ESTIMATE = 320

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function resolveBorder(disabled: boolean, focused: boolean, hasValue: boolean): string {
  if (disabled) return '1px solid var(--rmg-color-grey-2)'
  if (focused) return '2px solid var(--rmg-color-blue)'
  if (hasValue) return '1px solid var(--rmg-color-grey-1)'
  return '1px solid var(--rmg-color-grey-2)'
}

/**
 * Standalone calendar date picker: trigger button + popup calendar, with its
 * own portal positioning — including flipping to open upward when there's
 * not enough room below (e.g. the last row of a table). Implemented
 * directly rather than delegating to FormField, so it can render without
 * FormField's mandatory label chrome in dense contexts. FormField itself,
 * and its own separate date-variant implementation, are unchanged and still
 * used exactly as before everywhere else (e.g. the design-system page's
 * FormField examples) — this component no longer renders FormField at all.
 */
export function CalendarDatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  label = '',
  placeholder,
  disabled = false,
  required = false,
  size = 'large',
  name,
  triggerStyle,
  showIcon = true,
}: CalendarDatePickerProps) {
  const id = useId()
  const [focused, setFocused] = useState(false)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<CalendarPopupPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const hasValue = value.length > 0

  const positionPanel = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    // panelRef is already mounted (just visibility:hidden) by the time this
    // runs in a layout effect, so this reads the real rendered height, not
    // a guess — same technique as the chip legend popover.
    const popupHeight = panelRef.current?.offsetHeight ?? DEFAULT_POPUP_HEIGHT_ESTIMATE
    setPos(
      computeCalendarPopupPosition(
        { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        popupHeight,
        window.innerHeight,
      ),
    )
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    positionPanel()
    window.addEventListener('scroll', positionPanel, true)
    window.addEventListener('resize', positionPanel)
    return () => {
      window.removeEventListener('scroll', positionPanel, true)
      window.removeEventListener('resize', positionPanel)
    }
  }, [open, positionPanel])

  const inputHeight = size === 'large' ? '56px' : '40px'
  const fontSize = size === 'large' ? 'var(--rmg-text-b2)' : 'var(--rmg-text-b3)'

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 'var(--rmg-text-c1)',
    lineHeight: 'var(--rmg-leading-c1)',
    color: disabled ? 'var(--rmg-color-grey-1)' : 'var(--rmg-color-text-body)',
    display: 'block',
    marginBottom: '4px',
  }

  const baseTriggerStyle: React.CSSProperties = {
    width: '100%',
    height: inputHeight,
    // Single shorthand (not a separate paddingRight) so a caller's own
    // `padding` override (e.g. triggerStyle) replaces it cleanly instead of
    // leaving a stray longhand behind.
    padding: showIcon ? '0 40px 0 12px' : '0 12px',
    border: resolveBorder(disabled, focused || open, hasValue),
    borderRadius: 'var(--rmg-radius-s)',
    backgroundColor: disabled ? 'var(--rmg-color-grey-3)' : 'var(--rmg-color-surface-white)',
    fontFamily: 'var(--rmg-font-body)',
    fontSize,
    // Explicit line-height (not left to the UA default) so the box has a
    // guaranteed minimum content height even when it's empty — with no
    // value and no placeholder, the rendered child would otherwise be a
    // near-empty <span>, and an empty inline box can collapse well below
    // one line's height once `height` itself is overridden to 'auto' (as
    // callers like RatesPageClient's cellDateTrigger do to match a table
    // cell's own sizing) — that's what caused the squashed AddRateRow
    // field. Unitless so it scales with whatever fontSize is active —
    // including a caller override (cellDateTrigger also overrides
    // fontSize to 13px to match cellInput) — rather than a fixed px token
    // sized for this component's own default 18px/16px, which would add
    // extra height on top of a shrunk font instead of matching it.
    lineHeight: 1.5,
    color: disabled ? 'var(--rmg-color-grey-1)' : 'var(--rmg-color-text-body)',
    outline: 'none',
    appearance: 'none' as const,
    boxSizing: 'border-box' as const,
    cursor: disabled ? 'not-allowed' : 'pointer',
    textAlign: 'left',
  }

  const trailingStyle: React.CSSProperties = {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    color: disabled ? 'var(--rmg-color-grey-2)' : 'var(--rmg-color-grey-1)',
    display: 'flex',
    alignItems: 'center',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {label && (
        <label htmlFor={id} style={labelStyle}>
          {label}
          {required && (
            <span aria-hidden="true" style={{ color: 'var(--rmg-color-red)', marginLeft: '2px' }}>*</span>
          )}
        </label>
      )}

      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Hidden input carries the value for native form submission, same as FormField's date variant. */}
        <input type="hidden" name={name} value={value} readOnly />
        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            if (disabled) return
            setOpen((o) => !o)
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // position: 'relative' always wins (kept out of the merge order) so
          // the trailing icon's containing block is guaranteed to be this
          // button, never overridable by a caller's triggerStyle.
          style={{ ...baseTriggerStyle, ...triggerStyle, position: 'relative' }}
        >
          {hasValue ? (
            formatDisplay(value)
          ) : (
            // A genuinely empty <span></span> (zero characters — not even a
            // space) doesn't generate a line box in some browsers, so the
            // `lineHeight` above has nothing to apply to and the button
            // collapses to just its padding+border. A non-breaking space
            // guarantees real inline content, so the box always reserves a
            // full line's height, matching a sibling <input>'s empty state.
            <span style={{ color: 'var(--rmg-color-grey-1)' }}>{placeholder || ' '}</span>
          )}
          {showIcon && <span style={trailingStyle}><CalendarIcon /></span>}
        </button>
      </div>

      {open && !disabled && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: pos?.width,
              visibility: pos ? 'visible' : 'hidden',
              zIndex: 10001,
            }}
          >
            <CalendarPanel
              value={value}
              minDate={minDate}
              maxDate={maxDate}
              onDone={(iso) => {
                onChange(iso)
                setOpen(false)
              }}
              onCancel={() => setOpen(false)}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}

export default CalendarDatePicker
