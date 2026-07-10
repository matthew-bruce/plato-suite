'use client'

import React from 'react'
import { FormField } from './FormField'

export interface CalendarDatePickerProps {
  /** Selected date as a YYYY-MM-DD ISO string ('' for none). Controlled. */
  value: string
  /** Called with the newly-picked ISO date when the user commits (Done/Enter). */
  onChange: (iso: string) => void
  /** Optional inclusive bounds (YYYY-MM-DD); days outside are disabled. */
  minDate?: string
  maxDate?: string
  /** Field label (delegates to FormField's label). */
  label?: string
  /** Placeholder shown when no date is selected. */
  placeholder?: string
  disabled?: boolean
  required?: boolean
  size?: 'small' | 'large'
  name?: string
}

/**
 * Controlled calendar date picker: a FormField date-variant trigger plus the
 * popup calendar. Thin wrapper over FormField so it inherits every field state
 * (default/focus/disabled/error) and the label chrome, while exposing a clean
 * ISO-string value / onChange API for date-specific callers.
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
}: CalendarDatePickerProps) {
  return (
    <FormField
      type="date"
      variant={disabled ? 'disabled' : 'default'}
      size={size}
      label={label}
      required={required}
      placeholder={placeholder}
      name={name}
      value={value}
      minDate={minDate}
      maxDate={maxDate}
      onChange={(e) => onChange((e.target as HTMLInputElement).value)}
    />
  )
}

export default CalendarDatePicker
