'use client'

import { useState, useEffect } from 'react'

export type NotificationStatus =
  | 'warning'
  | 'information'
  | 'error'
  | 'success'
  | 'sustainability'

export type NotificationVariant = 'banner' | 'inline'

export interface NotificationProps {
  variant?: NotificationVariant
  status: NotificationStatus
  title?: string
  message: string
  onDismiss?: () => void  // banner only — presence shows the dismiss button
  paddingX?: number       // banner only — default 30, match grid margin of calling page
}

const STATUS_CONFIG: Record<NotificationStatus, { bg: string; textColor: string }> = {
  warning:        { bg: 'var(--rmg-color-yellow)',         textColor: 'var(--rmg-color-text-heading)' },
  information:    { bg: 'var(--rmg-color-blue)',           textColor: 'var(--rmg-color-white)' },
  error:          { bg: 'var(--rmg-color-tint-pink)',      textColor: 'var(--rmg-color-text-heading)' },
  success:        { bg: 'var(--rmg-color-tint-green)',     textColor: 'var(--rmg-color-text-heading)' },
  sustainability: { bg: 'var(--rmg-color-green-contrast)', textColor: 'var(--rmg-color-white)' },
}

function InfoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M13.142 8.078C13.142 8.666 12.666 9.142 12.064 9.142C11.476 9.142 11 8.666 11 8.078C11 7.476 11.476 7 12.064 7C12.666 7 13.142 7.476 13.142 8.078ZM13.016 16.576C13.016 17.094 12.596 17.514 12.064 17.514C11.56 17.514 11.126 17.094 11.126 16.576V11.018C11.126 10.5 11.56 10.066 12.064 10.066C12.596 10.066 13.016 10.5 13.016 11.018V16.576Z" fill="currentColor"/>
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M12.1754 2L2 20H22L12.1754 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M13.198 9.08073L12.974 13.0837C12.946 13.6809 12.764 14.008 12.218 14.008C11.7 14.008 11.518 13.6809 11.476 13.0837L11.266 9.08073C11.238 8.4977 11.574 8 12.218 8C12.876 8 13.226 8.4977 13.198 9.08073ZM13.45 16.24C13.45 16.912 12.904 17.458 12.218 17.458C11.546 17.458 11 16.912 11 16.24C11 15.554 11.546 15.008 12.218 15.008C12.904 15.008 13.45 15.554 13.45 16.24Z" fill="currentColor"/>
    </svg>
  )
}

function SuccessIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.849 12.736L10.331 15.217L16.947 8.667" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function DismissIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M4.24575 4.24575C4.57343 3.91808 5.10469 3.91808 5.43236 4.24575L12 10.8134L18.5676 4.24575C18.8953 3.91808 19.4266 3.91808 19.7542 4.24575C20.0819 4.57343 20.0819 5.10469 19.7542 5.43236L13.1866 12L19.7542 18.5676C20.0819 18.8953 20.0819 19.4266 19.7542 19.7542C19.4266 20.0819 18.8953 20.0819 18.5676 19.7542L12 13.1866L5.43236 19.7542C5.10469 20.0819 4.57343 20.0819 4.24575 19.7542C3.91808 19.4266 3.91808 18.8953 4.24575 18.5676L10.8134 12L4.24575 5.43236C3.91808 5.10469 3.91808 4.57343 4.24575 4.24575Z" fill="currentColor"/>
    </svg>
  )
}

function getIcon(status: NotificationStatus) {
  if (status === 'error') return <ErrorIcon />
  if (status === 'success') return <SuccessIcon />
  return <InfoIcon />
}

const textStyle: React.CSSProperties = {
  fontFamily: 'var(--rmg-font-body)',
  fontSize: 16,
  lineHeight: '22px',
}

export function Notification({
  variant = 'banner',
  status,
  title,
  message,
  onDismiss,
  paddingX = 30,
}: NotificationProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const { bg, textColor } = STATUS_CONFIG[status]

  const textColumn = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {title && (
        <span style={{ ...textStyle, fontWeight: 700, color: textColor }}>
          {title}
        </span>
      )}
      <span style={{ ...textStyle, fontWeight: 400, color: textColor }}>
        {message}
      </span>
    </div>
  )

  if (variant === 'inline') {
    return (
      <div
        style={{
          width: '100%',
          backgroundColor: bg,
          borderRadius: '0 8px 8px 8px',
          padding: 24,
          display: 'flex',
          flexDirection: 'row',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        <span style={{ color: textColor, flexShrink: 0, display: 'flex' }}>
          {getIcon(status)}
        </span>
        <div style={{ flex: '1 1 0' }}>
          {textColumn}
        </div>
      </div>
    )
  }

  // banner variant
  const contentRow = (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 16, alignItems: 'flex-start', flex: '1 1 0' }}>
      <span style={{ color: textColor, flexShrink: 0, display: 'flex' }}>
        {getIcon(status)}
      </span>
      {textColumn}
    </div>
  )

  const dismissButton = onDismiss ? (
    <button
      onClick={onDismiss}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: textColor,
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
      aria-label="Dismiss notification"
    >
      <DismissIcon />
    </button>
  ) : null

  const outerStyle: React.CSSProperties = isMobile
    ? { flexDirection: 'column', alignItems: 'flex-end' }
    : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: bg,
        paddingTop: 12,
        paddingBottom: 12,
        paddingLeft: paddingX,
        paddingRight: paddingX,
        display: 'flex',
        gap: 16,
        ...outerStyle,
      }}
    >
      {contentRow}
      {dismissButton}
    </div>
  )
}
