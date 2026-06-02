import React, { useEffect, useState } from 'react'
import { getPeriodIdentity } from '../utils/getPeriodIdentity'

export type PeriodStatus = 'active' | 'closed' | 'draft'

export interface PeriodContextStripProps {
  periodStart: Date
  periodEnd: Date
  workingDays: number
  platformName: string
  status: PeriodStatus

  onPeriodChange: () => void

  onDuplicateQuarter?: () => void
  closedBannerDismissable?: boolean
  onClosedBannerDismiss?: () => void

  quarterOverride?: 1 | 2 | 3 | 4
  fiscalYearLabelOverride?: string
}

function formatStripDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const STATUS_STYLES: Record<PeriodStatus, React.CSSProperties> = {
  active: {
    background: 'rgba(0,138,0,0.22)',
    color: '#7FD97F',
    border: '1px solid rgba(127,217,127,0.22)',
  },
  closed: {
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.42)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
  draft: {
    background: 'rgba(243,146,13,0.2)',
    color: '#F3C175',
    border: '1px solid rgba(243,146,13,0.25)',
  },
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        background: 'rgba(255,255,255,0.15)',
        margin: '0 22px',
        flexShrink: 0,
      }}
    />
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          fontSize: 8,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'rgba(255,255,255,0.32)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.78)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

export function PeriodContextStrip({
  periodStart,
  periodEnd,
  workingDays,
  platformName,
  status,
  onPeriodChange,
  onDuplicateQuarter,
  closedBannerDismissable = true,
  onClosedBannerDismiss,
  quarterOverride,
  fiscalYearLabelOverride,
}: PeriodContextStripProps) {
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const identity = getPeriodIdentity(periodStart)
  const quarter = quarterOverride ?? identity.quarter
  const fyLabel = fiscalYearLabelOverride ?? identity.fiscalYearLabel

  const periodLabel = `${formatStripDate(periodStart)} – ${formatStripDate(periodEnd)}`
  const workingDaysLabel = `${workingDays} days`

  const statusBadge = (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 100,
        padding: '4px 10px',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.07em',
        flexShrink: 0,
        ...STATUS_STYLES[status],
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </div>
  )

  const periodSelectorButton = (
    <button
      type="button"
      onClick={onPeriodChange}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        padding: '6px 12px',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}
      >
        Q{quarter}
      </span>
      <span
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.5)',
          lineHeight: 1,
        }}
      >
        {fyLabel}
      </span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden
        style={{ flexShrink: 0 }}
      >
        <path
          d="M3 5L7 9L11 5"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )

  const topRowContent = isMobile ? (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: '#404044',
      }}
    >
      {periodSelectorButton}
      {statusBadge}
    </div>
  ) : (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        background: '#404044',
        gap: 0,
      }}
    >
      {periodSelectorButton}
      <Divider />
      <MetaItem label="Period" value={periodLabel} />
      <Divider />
      <MetaItem label="Working days" value={workingDaysLabel} />
      <Divider />
      <MetaItem label="Platform" value={platformName} />
      <div style={{ flex: 1 }} />
      {statusBadge}
    </div>
  )

  const mobileMetaGrid = isMobile ? (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        background: '#404044',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {[
        { label: 'Period', value: periodLabel },
        { label: 'Working days', value: workingDaysLabel },
        { label: 'Platform', value: platformName },
      ].map((item, i) => (
        <div
          key={item.label}
          style={{
            padding: '10px 16px',
            borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.07)' : undefined,
            borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.07)' : undefined,
          }}
        >
          <MetaItem label={item.label} value={item.value} />
        </div>
      ))}
    </div>
  ) : null

  const closedBanner =
    status === 'closed' && !bannerDismissed ? (
      <div
        style={{
          background: '#FDDA24',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: isMobile ? '10px 14px' : '12px 18px',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2A2A2D"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{ flexShrink: 0, marginTop: 1 }}
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2A2A2D' }}>
            This period is closed
          </div>
          <div style={{ fontSize: 11, color: '#2A2A2D', opacity: 0.78, marginTop: 2 }}>
            All values are read-only. To make changes, duplicate this quarter first.
            {onDuplicateQuarter && (
              <button
                type="button"
                onClick={onDuplicateQuarter}
                style={{
                  marginLeft: 10,
                  background: 'rgba(0,0,0,0.1)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '3px 9px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#2A2A2D',
                  cursor: 'pointer',
                }}
              >
                Duplicate Quarter
              </button>
            )}
          </div>
        </div>
        {closedBannerDismissable && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setBannerDismissed(true)
              onClosedBannerDismiss?.()
            }}
            style={{
              background: 'transparent',
              border: 'none',
              opacity: 0.45,
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              color: '#2A2A2D',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>
    ) : null

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.1)',
        marginBottom: 20,
      }}
    >
      {topRowContent}
      {mobileMetaGrid}
      {closedBanner}
    </div>
  )
}
