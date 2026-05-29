'use client'

import * as React from 'react'
import { useState } from 'react'
import type { PageToolbarExpandButtonProps } from './types'

function DoubleChevron({ up }: { up: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        transform: up ? 'rotate(180deg)' : 'none',
        transition: 'transform 120ms',
        color: '#fff',
      }}
    >
      <path
        d="M2 4 L6 7 L10 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M2 7 L6 10 L10 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export function PageToolbarExpandButton({
  expanded,
  onToggle,
  style,
}: PageToolbarExpandButtonProps) {
  const [hovered, setHovered] = useState(false)
  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    background: hovered ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: 'var(--rmg-radius-s)',
    padding: '7px 12px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'var(--rmg-font-body)',
    whiteSpace: 'nowrap',
    transition: 'background 120ms',
    ...style,
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={buttonStyle}
    >
      <DoubleChevron up={expanded} />
      {expanded ? 'Collapse all' : 'Expand all'}
    </button>
  )
}
