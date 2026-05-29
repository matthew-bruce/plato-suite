'use client'

import * as React from 'react'
import type { PageToolbarDividerProps } from './types'

const baseStyle: React.CSSProperties = {
  width: '1px',
  height: '20px',
  background: 'var(--rmg-color-grey-2)',
  flexShrink: 0,
  margin: '0 2px',
}

export function PageToolbarDivider({ style }: PageToolbarDividerProps) {
  return <span role="separator" aria-orientation="vertical" style={{ ...baseStyle, ...style }} />
}
