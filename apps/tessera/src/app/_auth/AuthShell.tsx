'use client'

import type { ReactNode } from 'react'

/**
 * Shared visual shell for the auth pages: centered white card with the dark
 * header bar used by the Create New Period wizard, on a muted full-height
 * background. Inline styles + RMG tokens per ADR-023.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F1F2F5',
        padding: 20,
        boxSizing: 'border-box',
        fontFamily: 'var(--rmg-font-body)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#FFFFFF',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ background: '#2A2A2D', padding: '20px 28px' }}>
          <div style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ color: '#B8BBBF', fontSize: 13, marginTop: 4 }}>{subtitle}</div>
          )}
        </div>
        <div style={{ padding: 28 }}>{children}</div>
      </div>
    </div>
  )
}
