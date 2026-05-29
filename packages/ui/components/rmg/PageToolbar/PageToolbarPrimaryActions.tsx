'use client'

import * as React from 'react'
import type { PageToolbarPrimaryActionsProps } from './types'

const baseStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexShrink: 0,
}

export function PageToolbarPrimaryActions({
  children,
  style,
}: PageToolbarPrimaryActionsProps) {
  return <div style={{ ...baseStyle, ...style }}>{children}</div>
}
