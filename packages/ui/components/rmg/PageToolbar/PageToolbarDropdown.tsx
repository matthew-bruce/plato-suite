'use client'

import * as React from 'react'
import { useState } from 'react'
import type { PageToolbarDropdownProps } from './types'

function ChevronDownSmall() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, color: 'var(--rmg-color-grey-1)' }}
    >
      <path
        d="M1.5 3 L4.5 6 L7.5 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function isActiveValue(value: string): boolean {
  return value !== '' && value !== 'all'
}

export function PageToolbarDropdown({
  label,
  value,
  options,
  onChange,
  style,
}: PageToolbarDropdownProps) {
  const [hovered, setHovered] = useState(false)
  const active = isActiveValue(value)
  const borderColor = active
    ? 'var(--rmg-color-red)'
    : hovered
      ? 'var(--rmg-color-grey-1)'
      : 'var(--rmg-color-grey-2)'

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    background: active ? '#FFF5F5' : 'var(--rmg-color-surface-white)',
    border: `1px solid ${borderColor}`,
    borderRadius: 'var(--rmg-radius-s)',
    padding: '5px 10px',
    cursor: 'pointer',
    fontFamily: 'var(--rmg-font-body)',
    transition: 'border-color 120ms, background 120ms',
    boxSizing: 'border-box',
    ...style,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '9px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--rmg-color-grey-1)',
  }

  const valueStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: active ? 600 : 400,
    color: active
      ? 'var(--rmg-color-red)'
      : 'var(--rmg-color-text-body)',
  }

  const selectStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
    fontFamily: 'var(--rmg-font-body)',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    border: 'none',
    background: 'transparent',
  }

  const currentOption = options.find((o) => o.value === value)
  const displayLabel = currentOption?.label ?? value

  return (
    <label
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={containerStyle}
    >
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{displayLabel}</span>
      <ChevronDownSmall />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        style={selectStyle}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
