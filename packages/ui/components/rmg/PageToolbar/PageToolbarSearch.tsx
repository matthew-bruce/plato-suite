'use client'

import * as React from 'react'
import { useState } from 'react'
import type { PageToolbarSearchProps } from './types'

// Pure helper — co-located unit-tested in __tests__/PageToolbarSearch.test.ts.
export function resolveSearchBorderColor(focused: boolean): string {
  return focused ? 'var(--rmg-color-dark-grey)' : 'var(--rmg-color-grey-2)'
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, color: 'var(--rmg-color-grey-1)' }}
    >
      <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M9.2 9.2 L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function PageToolbarSearch({
  value,
  onChange,
  placeholder,
  style,
}: PageToolbarSearchProps) {
  const [focused, setFocused] = useState(false)

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    background: 'var(--rmg-color-surface-white)',
    border: `1px solid ${resolveSearchBorderColor(focused)}`,
    borderRadius: 'var(--rmg-radius-s)',
    padding: '7px 12px',
    transition: 'border-color 150ms ease',
    boxSizing: 'border-box',
    ...style,
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontFamily: 'var(--rmg-font-body)',
    fontSize: '13px',
    color: 'var(--rmg-color-text-body)',
    minWidth: 0,
  }

  return (
    <div style={containerStyle}>
      <SearchIcon />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={inputStyle}
      />
    </div>
  )
}
