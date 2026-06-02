import React, { useEffect, useRef, useState } from 'react'
import { getPeriodIdentity } from '../utils/getPeriodIdentity'
import { getPeriodStatus } from '../utils/getPeriodStatus'
import type { PeriodStatus } from '../utils/getPeriodStatus'

export type { PeriodStatus }

export interface PeriodOption {
  periodId: string
  periodStart: Date
  periodEnd: Date
  workingDays: number
}

export interface PeriodContextStripProps {
  periodStart: Date
  periodEnd: Date
  workingDays: number
  platformName: string
  periods: PeriodOption[]
  currentPeriodId: string
  onPeriodSelect: (periodId: string) => void
  locked: boolean
  onLockToggle: () => void
  onDuplicate?: () => void
  onActivate?: () => void
  onExport?: () => void
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
  historic: {
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

const PICKER_IDENTITY_BG: Record<PeriodStatus, string> = {
  active: '#005A00',
  historic: '#6B7280',
  draft: '#854F0B',
}

const PICKER_CHIP_STYLES: Record<PeriodStatus, React.CSSProperties> = {
  active: { background: '#C1E3C1', color: '#1A6B00' },
  historic: { background: '#EEEEEE', color: '#8F9495' },
  draft: { background: '#FDE8C8', color: '#854F0B' },
}

const CHIP_LABEL: Record<PeriodStatus, string> = {
  active: 'Active',
  historic: 'Historic',
  draft: 'Draft',
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
      <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.78)' }}>
        {value}
      </span>
    </div>
  )
}

function ToggleSwitch({
  on,
  onToggle,
  trackOnColor,
  trackOffColor,
  textColor,
  label,
}: {
  on: boolean
  onToggle: () => void
  trackOnColor: string
  trackOffColor: string
  textColor: string
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: on ? trackOnColor : trackOffColor,
          position: 'relative',
          transition: 'background 200ms ease',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 3,
            left: on ? 19 : 3,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 200ms ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: textColor, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  )
}

function ActionChip({
  children,
  onClick,
  background,
  color,
}: {
  children: React.ReactNode
  onClick?: () => void
  background: string
  color: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
        cursor: 'pointer',
        border: 'none',
        background,
        color,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

export function PeriodContextStrip({
  periodStart,
  periodEnd,
  workingDays,
  platformName,
  periods,
  currentPeriodId,
  onPeriodSelect,
  locked,
  onLockToggle,
  onDuplicate,
  onActivate,
}: PeriodContextStripProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [hoveredPeriodId, setHoveredPeriodId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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

  const status = getPeriodStatus(periodStart, periodEnd)
  const identity = getPeriodIdentity(periodStart)
  const periodLabel = `${formatStripDate(periodStart)} – ${formatStripDate(periodEnd)}`
  const workingDaysLabel = `${workingDays} days`

  const sortedPeriods = [...periods].sort(
    (a, b) => a.periodStart.getTime() - b.periodStart.getTime(),
  )

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
      {status === 'historic' ? 'Historic' : status.charAt(0).toUpperCase() + status.slice(1)}
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
        Q{identity.quarter}
      </span>
      <span
        style={{ fontSize: 17, fontWeight: 600, color: 'rgba(255,255,255,0.5)', lineHeight: 1 }}
      >
        {identity.fiscalYearLabel}
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

  // Top row — always rounded top, because banner always follows
  const topRowRadius: React.CSSProperties['borderRadius'] = '12px 12px 0 0'

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
        borderRadius: 0,
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

  // Banners
  const bannerBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: isMobile ? '10px 14px' : '11px 18px',
    borderTop: '1px solid rgba(0,0,0,0.06)',
    borderRadius: '0 0 12px 12px',
  }

  let banner: React.ReactNode

  if (status === 'active') {
    const unlocked = !locked
    banner = (
      <div style={{ ...bannerBase, background: '#E8F5E9', borderLeft: '3px solid #1A6B00' }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#C1E3C1',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M2 6L5 9L10 3"
              stroke="#1A6B00"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1A6B00' }}>
            This period is currently active
          </div>
          <div style={{ fontSize: 10, color: 'rgba(26,107,0,0.7)', marginTop: 1 }}>
            All values are editable. Lock to prevent accidental changes.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ToggleSwitch
            on={unlocked}
            onToggle={onLockToggle}
            trackOnColor="#1A6B00"
            trackOffColor="#ccc"
            textColor="#1A6B00"
            label={locked ? 'Unlock' : 'Lock'}
          />
          {onDuplicate && (
            <ActionChip
              onClick={onDuplicate}
              background="rgba(0,107,0,0.1)"
              color="#1A6B00"
            >
              Duplicate
            </ActionChip>
          )}
        </div>
      </div>
    )
  } else if (status === 'historic') {
    const unlocked = !locked
    banner = (
      <div style={{ ...bannerBase, background: '#FFFBEA', borderLeft: '3px solid #FDDA24' }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#FDDA24',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <rect x="3.5" y="5" width="5" height="4.5" rx="0.8" stroke="#5a4000" strokeWidth="1.4" fill="none" />
            <path d="M4.5 5 V3.5 a1.5 1.5 0 0 1 3 0 V5" stroke="#5a4000" strokeWidth="1.4" fill="none" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#5a4000' }}>
            This period is historic
          </div>
          <div style={{ fontSize: 10, color: 'rgba(90,64,0,0.7)', marginTop: 1 }}>
            {locked
              ? 'All values are read-only. Unlock to make changes.'
              : 'Changes now permitted. Lock again when done.'}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <ToggleSwitch
            on={unlocked}
            onToggle={onLockToggle}
            trackOnColor="#1A6B00"
            trackOffColor="#B8860B"
            textColor="#5a4000"
            label={locked ? 'Unlock' : 'Lock'}
          />
        </div>
      </div>
    )
  } else {
    // draft
    const unlocked = !locked
    banner = (
      <div style={{ ...bannerBase, background: '#E8F0FE', borderLeft: '3px solid #1A4A8A' }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#BEE0F5',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M7.5 2.5L9.5 4.5L4 10H2V8L7.5 2.5Z"
              stroke="#1A4A8A"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1A4A8A' }}>
            This period is in draft
          </div>
          <div style={{ fontSize: 10, color: 'rgba(26,74,138,0.7)', marginTop: 1 }}>
            Review all resources before activating.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ToggleSwitch
            on={unlocked}
            onToggle={onLockToggle}
            trackOnColor="#1A6B00"
            trackOffColor="#ccc"
            textColor="#1A4A8A"
            label={locked ? 'Unlock' : 'Lock'}
          />
          {onActivate && (
            <ActionChip
              onClick={onActivate}
              background="rgba(26,100,180,0.1)"
              color="#1A4A8A"
            >
              Activate
            </ActionChip>
          )}
        </div>
      </div>
    )
  }

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
        const rowStatus = getPeriodStatus(p.periodStart, p.periodEnd)
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
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 8,
                background: PICKER_IDENTITY_BG[rowStatus],
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
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1,
                }}
              >
                {pid.fiscalYearLabel}
              </span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2A2A2D', marginBottom: 2 }}>
                Q{pid.quarter} — FY {pid.fiscalYearLabel}
              </div>
              <div style={{ fontSize: 11, color: '#8F9495', marginBottom: 2 }}>
                {formatStripDate(p.periodStart)} – {formatStripDate(p.periodEnd)}
              </div>
              <div style={{ fontSize: 10, color: '#8F9495' }}>{p.workingDays} working days</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span
                style={{
                  display: 'inline-block',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.06em',
                  ...PICKER_CHIP_STYLES[rowStatus],
                }}
              >
                {CHIP_LABEL[rowStatus]}
              </span>
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
        {banner}
      </div>
      {pickerPanel}
    </div>
  )
}
