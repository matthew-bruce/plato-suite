'use client'

import * as React from 'react'
import { useState } from 'react'
import type { PageToolbarFilterPillProps } from './types'

const ALL_SENTINEL = '--all'

// Pure helper — exported and unit-tested in
// __tests__/getFilterPillStyle.test.ts.
export function getFilterPillStyle(
  colour: string,
  active: boolean,
  hovered: boolean,
): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 'var(--rmg-radius-xl)',
    padding: '4px 12px',
    fontSize: '11px',
    fontWeight: 600,
    border: '1.5px solid',
    cursor: 'pointer',
    fontFamily: 'var(--rmg-font-body)',
    whiteSpace: 'nowrap',
    transition: 'filter 120ms',
    lineHeight: 1.4,
  }

  if (colour === ALL_SENTINEL) {
    if (active) {
      return {
        ...base,
        background: 'var(--rmg-color-black)',
        color: '#fff',
        borderColor: 'var(--rmg-color-black)',
      }
    }
    return {
      ...base,
      background: 'transparent',
      color: 'var(--rmg-color-dark-grey)',
      borderColor: 'var(--rmg-color-grey-2)',
      filter: hovered ? 'brightness(0.95)' : undefined,
    }
  }

  // Defensive: if a non-hex colour slips through, fall back to dark grey
  // so we never throw or paint NaN.
  const safe = /^#[0-9a-fA-F]{3,8}$/.test(colour) ? colour : '#8F9495'

  if (active) {
    return {
      ...base,
      background: safe,
      color: '#FFFFFF',
      borderColor: safe,
    }
  }

  return {
    ...base,
    background: `${safe}12`,
    color: safe,
    borderColor: `${safe}38`,
    filter: hovered ? 'brightness(0.92)' : undefined,
  }
}

export function PageToolbarFilterPill({
  label,
  active,
  colour,
  onClick,
  style,
}: PageToolbarFilterPillProps) {
  const [hovered, setHovered] = useState(false)
  const computed = getFilterPillStyle(colour, active, hovered)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={active}
      style={{ ...computed, ...style }}
    >
      {label}
    </button>
  )
}
