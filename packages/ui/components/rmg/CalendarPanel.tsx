'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Button } from './Button'
import {
  buildMonthGrid,
  parseISO,
  addMonths,
  isDateDisabled,
  clampISO,
  addDaysISO,
  monthLabel,
  toISO,
  dayCellState,
} from '../../utils/calendarGrid'

export interface CalendarPanelProps {
  /** Currently-committed selection (YYYY-MM-DD), or '' for none. */
  value: string
  /** Optional inclusive bounds (YYYY-MM-DD). Days outside are disabled. */
  minDate?: string
  maxDate?: string
  /** Commit a date (Done / Enter on a day). */
  onDone: (iso: string) => void
  /** Discard and close (Cancel / Escape / outside click). */
  onCancel: () => void
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function todayISO(): string {
  const d = new Date()
  return toISO(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Small grey chevron button for month nav — matches the compact mockup header
 *  (the design-system ChevronButton is a 48–64px circular control, too large
 *  for this popup). */
function NavChevron({
  direction,
  onClick,
  label,
}: {
  direction: 'left' | 'right'
  onClick: () => void
  label: string
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        border: 'none',
        borderRadius: 'var(--rmg-radius-xs)',
        background: hover ? 'var(--rmg-color-grey-4)' : 'transparent',
        color: 'var(--rmg-color-dark-grey)',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={direction === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

/**
 * The calendar popup panel: month header with chevron nav, Mon–Sun weekday row,
 * day grid, and a Cancel / Done footer. Selection is pending until Done — Cancel,
 * Escape, and outside-click all discard. Keyboard: arrows move the focused day,
 * Enter commits it, Escape closes.
 *
 * Rendered by FormField's date variant (and CalendarDatePicker) beneath the
 * field. Presentational + local pending state only; the committed value lives
 * in the parent.
 */
export function CalendarPanel({ value, minDate, maxDate, onDone, onCancel }: CalendarPanelProps) {
  const initial = parseISO(value)
  const initialFocus = value && !isDateDisabled(value, minDate, maxDate) ? value : clampISO(todayISO(), minDate, maxDate)
  const focusParts = parseISO(initialFocus)

  // Pending selection (null until the user picks a day) and the month in view.
  const [pending, setPending] = useState<string | null>(initial ? value : null)
  const [focusISO, setFocusISO] = useState<string>(initialFocus)
  const [view, setView] = useState<{ year: number; month0: number }>({
    year: focusParts?.year ?? new Date().getFullYear(),
    month0: focusParts?.month0 ?? new Date().getMonth(),
  })

  const panelRef = useRef<HTMLDivElement>(null)
  const today = todayISO()

  // Keep the focused day inside the visible month.
  useEffect(() => {
    const p = parseISO(focusISO)
    if (p && (p.year !== view.year || p.month0 !== view.month0)) {
      setView({ year: p.year, month0: p.month0 })
    }
  }, [focusISO, view.year, view.month0])

  // Outside-click discards (same as Cancel).
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onCancel()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [onCancel])

  function move(deltaDays: number) {
    setFocusISO((cur) => {
      const next = clampISO(addDaysISO(cur, deltaDays), minDate, maxDate)
      return next
    })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        move(-1)
        break
      case 'ArrowRight':
        e.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        move(-7)
        break
      case 'ArrowDown':
        e.preventDefault()
        move(7)
        break
      case 'Enter':
        e.preventDefault()
        if (!isDateDisabled(focusISO, minDate, maxDate)) onDone(focusISO)
        break
      case 'Escape':
        e.preventDefault()
        onCancel()
        break
    }
  }

  const grid = buildMonthGrid(view.year, view.month0)

  // Positioning is owned by the caller (FormField renders this in a fixed-
  // position portal so it escapes overflow-clipping ancestors); this is just
  // the panel box.
  const panelStyle: React.CSSProperties = {
    background: 'var(--rmg-color-white)',
    border: '1px solid var(--rmg-color-grey-2)',
    borderRadius: 'var(--rmg-radius-s)',
    boxShadow: 'var(--rmg-shadow-card)',
    padding: 12,
    width: '100%',
    minWidth: 260,
    boxSizing: 'border-box',
    fontFamily: 'var(--rmg-font-body)',
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="Choose date"
      onKeyDown={onKeyDown}
      tabIndex={-1}
      style={panelStyle}
    >
      {/* Month header + nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <NavChevron
          direction="left"
          label="Previous month"
          onClick={() => setView((v) => addMonths(v.year, v.month0, -1))}
        />
        <span aria-live="polite" style={{ fontSize: 'var(--rmg-text-c1)', fontWeight: 500, color: 'var(--rmg-color-black)' }}>
          {monthLabel(view.year, view.month0)}
        </span>
        <NavChevron
          direction="right"
          label="Next month"
          onClick={() => setView((v) => addMonths(v.year, v.month0, 1))}
        />
      </div>

      {/* Weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <span
            key={i}
            style={{ fontSize: 'var(--rmg-text-c2)', color: 'var(--rmg-color-grey-1)', textAlign: 'center' }}
          >
            {w}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div role="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {Array.from({ length: grid.leadingBlanks }).map((_, i) => (
          <span key={`blank-${i}`} style={{ height: 28 }} />
        ))}
        {grid.days.map((cell) => (
          <DayButton
            key={cell.iso}
            iso={cell.iso}
            day={cell.day}
            selected={pending === cell.iso}
            isToday={cell.iso === today}
            isFocus={cell.iso === focusISO}
            disabled={isDateDisabled(cell.iso, minDate, maxDate)}
            onPick={() => {
              setPending(cell.iso)
              setFocusISO(cell.iso)
            }}
          />
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid var(--rmg-color-grey-3)',
        }}
      >
        <Button variant="outline" size="small" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="solid"
          size="small"
          disabled={!pending}
          onClick={() => pending && onDone(pending)}
        >
          Done
        </Button>
      </div>
    </div>
  )
}

function DayButton({
  iso,
  day,
  selected,
  isToday,
  isFocus,
  disabled,
  onPick,
}: {
  iso: string
  day: number
  selected: boolean
  isToday: boolean
  isFocus: boolean
  disabled: boolean
  onPick: () => void
}) {
  const [hover, setHover] = useState(false)

  let background = 'transparent'
  let color = 'var(--rmg-color-black)'
  let border = '1px solid transparent'
  let fontWeight: React.CSSProperties['fontWeight'] = 400

  switch (dayCellState({ disabled, selected, isToday })) {
    case 'disabled':
      color = 'var(--rmg-color-grey-2)'
      break
    case 'selected':
      // Committed-pending selection: solid red fill, white text (per mockup).
      background = 'var(--rmg-color-red)'
      color = 'var(--rmg-color-white)'
      fontWeight = 500
      break
    case 'today':
      // Today, when not selected: red outline + bold red text — clearly
      // distinct from the solid-fill selected state while staying within the
      // system's red-accent restraint (no new colour, lower emphasis than a fill).
      border = '1px solid var(--rmg-color-red)'
      color = 'var(--rmg-color-red)'
      fontWeight = 500
      break
    default:
      if (hover) background = 'var(--rmg-color-grey-4)'
  }

  return (
    <button
      type="button"
      role="gridcell"
      data-iso={iso}
      aria-label={iso}
      aria-selected={selected}
      aria-current={isToday ? 'date' : undefined}
      disabled={disabled}
      tabIndex={-1}
      onClick={disabled ? undefined : onPick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--rmg-text-c1)',
        fontFamily: 'var(--rmg-font-body)',
        background,
        color,
        border,
        borderRadius: 'var(--rmg-radius-xs)',
        outline: isFocus && !disabled ? '2px solid var(--rmg-color-blue)' : 'none',
        outlineOffset: '-2px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight,
        padding: 0,
        boxSizing: 'border-box',
      }}
    >
      {day}
    </button>
  )
}
