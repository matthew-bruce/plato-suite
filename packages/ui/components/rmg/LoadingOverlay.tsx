'use client'

import React from 'react'

export interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  subMessage?: string
}

export function LoadingOverlay({
  isLoading,
  message = 'Loading…',
  subMessage,
}: LoadingOverlayProps): React.ReactElement | null {
  if (!isLoading) return null

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(241, 242, 245, 0.88)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  }

  const cardStyle: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #EEEEEE',
    borderRadius: '4px',
    padding: '24px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    minWidth: '180px',
  }

  const messageStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#8F9495',
    letterSpacing: '0.01em',
  }

  const subMessageStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: '#2A2A2D',
  }

  return (
    <div style={overlayStyle} role="status" aria-live="polite" aria-label={message}>
      <div style={cardStyle}>
        <RmgSpinner />
        <span style={messageStyle}>{message}</span>
        {subMessage && <span style={subMessageStyle}>{subMessage}</span>}
      </div>
    </div>
  )
}

function RmgSpinner(): React.ReactElement {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="16" stroke="#EEEEEE" strokeWidth="3.5" />
      <circle
        cx="20"
        cy="20"
        r="16"
        stroke="#DA202A"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="28 72"
        strokeDashoffset="18"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 20 20"
          to="360 20 20"
          dur="0.75s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  )
}
