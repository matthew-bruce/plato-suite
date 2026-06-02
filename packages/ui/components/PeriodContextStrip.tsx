import React, { useEffect, useRef, useState } from 'react'
import { getPeriodIdentity } from '../utils/getPeriodIdentity'

export type PeriodStatus = 'active' | 'closed' | 'draft'

export interface PeriodOption {
  periodId: string
  periodStart: Date
  periodEnd: Date
  workingDays: number
  status: PeriodStatus
}

export interface PeriodContextStripProps {
  // Period data
  periodStart: Date
  periodEnd: Date
  workingDays: number
  platformName: string
  status: PeriodStatus

  // Period selector
  periods: PeriodOption[]
  currentPeriodId: string
  onPeriodSelect: (periodId: string) => void

  // Closed period actions
  onDuplicateQuarter?: () => void
  closedBannerDismissable?: boolean
  onClosedBannerDismiss?: () => void

  // Overrides
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

// Background colour for the identity square in the picker
const PICKER_IDENTITY_BG: Record<PeriodStatus, string> = {
  active: '#005A00',
  closed: '#6B7280',
  draft: '#854F0B',
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
  periods,
  currentPeriodId,
  onPeriodSelect,
  onDuplicateQuarter,
  closedBannerDismissable = true,
  onClosedBannerDismiss,
  quarterOverride,
  fiscalYearLabelOverride,
}: PeriodContextStripProps) {
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [hoveredPeriodId, setHoveredPeriodId] = useState<string | null>(null)

  // Covers both the strip and the floating picker panel for outside-click detection
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Reset dismissed banner when navigating to a different period
  useEffect(() => {
    setBannerDismissed(false)
  }, [currentPeriodId])

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [pickerOpen])

  const identity = getPeriodIdentity(periodStart)
  const quarter = quarterOverride ?? identity.quarter
  const fyLabel = fiscalYearLabelOverride ?? identity.fiscalYearLabel

  const periodLabel = `${formatStripDate(periodStart)} – ${formatStripDate(periodEnd)}`
  const workingDaysLabel = `${workingDays} days`

  // Sort oldest-first for display
  const sortedPeriods = [...periods].sort(
    (a, b) => a.periodStart.getTime() - b.periodStart.getTime(),
  )

  const showBanner = status === 'closed' && !bannerDismissed

  // Determine border-radius for each child so no overflow:hidden is needed on the
  // outer container (which would clip the absolutely-positioned picker panel).
  const topRowRadius: React.CSSProperties['borderRadius'] =
    !isMobile && !showBanner ? 12 : '12px 12px 0 0'
  const mobileGridRadius: React.CSSProperties['borderRadius'] = showBanner ? 0 : '0 0 12px 12px'

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
      onClick={() => setPickerOpen((v) => !v)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: pickerOpen ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
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
        style={{
          flexShrink: 0,
          transform: pickerOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 150ms ease',
        }}
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
        borderRadius: topRowRadius,
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
        borderRadius: topRowRadius,
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
        borderRadius: mobileGridRadius,
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

  const closedBanner = showBanner ? (
    <div
      style={{
        background: '#FDDA24',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: isMobile ? '10px 14px' : '12px 18px',
        borderRadius: '0 0 12px 12px',
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

  // Floating period picker panel
  const pickerPanel = pickerOpen ? (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 4,
        background: '#FFFFFF',
        borderRadius: '0 12px 12px 12px',
        border: '1px solid rgba(0,0,0,0.1)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
        overflow: 'hidden',
        minWidth: 400,
        zIndex: 50,
      }}
    >
      {sortedPeriods.map((p, i) => {
        const pid = getPeriodIdentity(p.periodStart)
        const isSelected = p.periodId === currentPeriodId
        const isHovered = hoveredPeriodId === p.periodId
        const isLast = i === sortedPeriods.length - 1

        return (
          <div
            key={p.periodId}
            onMouseEnter={() => setHoveredPeriodId(p.periodId)}
            onMouseLeave={() => setHoveredPeriodId(null)}
            onClick={() => {
              onPeriodSelect(p.periodId)
              setPickerOpen(false)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderBottom: isLast ? 'none' : '1px solid #EEEEEE',
              background: isHovered ? '#F5F5F5' : '#FFFFFF',
              cursor: 'pointer',
              transition: 'background 100ms ease',
            }}
          >
            {/* Identity square */}
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 8,
                background: PICKER_IDENTITY_BG[p.status],
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                Q{pid.quarter}
              </span>
              <span
                style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)', lineHeight: 1 }}
              >
                {pid.fiscalYearLabel}
              </span>
            </div>

            {/* Label + dates + working days */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2A2A2D', marginBottom: 2 }}>
                Q{pid.quarter} — FY {pid.fiscalYearLabel}
              </div>
              <div style={{ fontSize: 11, color: '#8F9495', marginBottom: 2 }}>
                {formatStripDate(p.periodStart)} – {formatStripDate(p.periodEnd)}
              </div>
              <div style={{ fontSize: 10, color: '#8F9495' }}>
                {p.workingDays} working days
              </div>
            </div>

            {/* Status badge + checkmark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
                  ...STATUS_STYLES[p.status],
                }}
              >
                {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
              </div>
              {isSelected && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path
                    d="M2.5 7L5.5 10L11.5 4"
                    stroke="#2A2A2D"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          </div>
        )
      })}
    </div>
  ) : null

  // containerRef covers both the strip and picker for outside-click detection.
  // position:relative here (not on the inner strip) lets the picker panel escape
  // the strip's overflow:hidden while still being anchored to this element.
  return (
    <div ref={containerRef} style={{ position: 'relative', marginBottom: 20 }}>
      <div
        style={{
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.1)',
        }}
      >
        {topRowContent}
        {mobileMetaGrid}
        {closedBanner}
      </div>
      {pickerPanel}
    </div>
  )
}
