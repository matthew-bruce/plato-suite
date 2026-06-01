'use client'

import * as React from 'react'
import type { PageToolbarProps } from './types'

const containerStyle: React.CSSProperties = {
  borderRadius: 'var(--rmg-radius-m)',
  overflow: 'hidden',
  border: '1px solid rgba(0,0,0,0.10)',
  boxShadow: 'var(--rmg-shadow-header)',
}

const primaryRowWrapper: React.CSSProperties = {
  background: 'var(--rmg-color-red)',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 14px',
  flexWrap: 'wrap',
}

const filterRowWrapper: React.CSSProperties = {
  background: 'var(--rmg-color-grey-4)',
  borderTop: '1px solid var(--rmg-color-grey-3)',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 20px',
  flexWrap: 'wrap',
}

export function PageToolbar({ primaryRow, filterRow, className }: PageToolbarProps) {
  return (
    <div className={className} style={containerStyle}>
      <div style={primaryRowWrapper}>{primaryRow}</div>
      {filterRow !== undefined && <div style={filterRowWrapper}>{filterRow}</div>}
    </div>
  )
}
