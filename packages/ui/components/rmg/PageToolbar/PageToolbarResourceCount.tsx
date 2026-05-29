'use client'

import * as React from 'react'
import type { PageToolbarResourceCountProps } from './types'

const baseStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.7)',
  whiteSpace: 'nowrap',
  fontFamily: 'var(--rmg-font-body)',
}

export function PageToolbarResourceCount({
  children,
  style,
}: PageToolbarResourceCountProps) {
  return <span style={{ ...baseStyle, ...style }}>{children}</span>
}
