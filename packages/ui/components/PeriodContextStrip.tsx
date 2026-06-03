import React, { useEffect, useRef, useState } from 'react'
import { getPeriodIdentity } from '../utils/getPeriodIdentity'
import { getPeriodStatus } from '../utils/getPeriodStatus'
import { formatPeriodDate } from '../utils/formatPeriodDate'
import type { PeriodStatus } from '../utils/getPeriodStatus'

export type { PeriodStatus }

const COLORS = {
  stripBg: '#404044',
  bannerActive: '#008A00',
  bannerHistoric: '#FDDA24',
  bannerDraft: '#0892CB',
  chipActiveBg: '#C1E3C1',
  chipActiveTxt: '#1A6B00',
  chipDraftBg: '#BEE0F5',
  chipDraftTxt: '#005F8A',
  chipHistoricBg: '#FEEB87',
  chipHistoricTxt: '#5a4000',
  badgeRed: '#DA202A',
}

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
  onPeriodSelect: (id: string) => void
  locked: boolean
  onLockToggle: () => void
  onDuplicate?: () => void
  onActivate?: () => void
  onExport?: () => void
}

const CHIP_STYLES: Record<PeriodStatus, React.CSSProperties> = {
  active: { background: COLORS.chipActiveBg, color: COLORS.chipActiveTxt },
  draft: { background: COLORS.chipDraftBg, color: COLORS.chipDraftTxt },
  historic: { background: COLORS.chipHistoricBg, color: COLORS.chipHistoricTxt },
}

const CHIP_LABEL: Record<PeriodStatus, string> = {
  active: 'Active',
  draft: 'Draft',
  historic: 'Historic',
}

/* ── Icons ─────────────────────────────────────────────────────── */

function DownloadIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ClockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ActiveIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2" />
      <path d="M8 12l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function HistoricIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path
        d="M3 6h18M5 6v13a1 1 0 001 1h12a1 1 0 001-1V6"
        stroke="#2A2A2D"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 10h6M9 14h4" stroke="#2A2A2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DraftIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="9" y="3" width="6" height="4" rx="1" stroke="#fff" strokeWidth="2" />
      <path d="M9 12h6M9 16h4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── Toggle ────────────────────────────────────────────────────── */

function LockToggle({
  locked,
  onToggle,
  variant,
}: {
  locked: boolean
  onToggle: () => void
  variant: 'light' | 'dark' // light = active (green), dark = historic (yellow)
}) {
  const on = !locked // ON = unlocked
  const trackColor =
    variant === 'light'
      ? on
        ? 'rgba(255,255,255,0.55)'
        : 'rgba(255,255,255,0.25)'
      : on
        ? 'rgba(0,0,0,0.35)'
        : 'rgba(0,0,0,0.15)'
  const labelColor = variant === 'light' ? 'rgba(255,255,255,0.85)' : 'rgba(42,42,45,0.75)'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'relative',
          width: 40,
          height: 22,
          borderRadius: 11,
          background: trackColor,
          flexShrink: 0,
          transition: 'background 180ms ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: on ? 21 : 3,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 180ms ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        />
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, color: labelColor, whiteSpace: 'nowrap' }}>
        {locked ? 'Unlock' : 'Lock'}
      </span>
    </button>
  )
}

/* ── Pill button ───────────────────────────────────────────────── */

function PillButton({
  children,
  onClick,
  variant,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant: 'light' | 'dark'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 14px',
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 700,
        background: 'transparent',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        ...(variant === 'light'
          ? { border: '2px solid rgba(255,255,255,0.7)', color: '#fff' }
          : { border: '2px solid rgba(0,0,0,0.3)', color: '#2A2A2D' }),
      }}
    >
      {children}
    </button>
  )
}

/* ── Meta item (desktop top row) ───────────────────────────────── */

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span
        style={{
          fontSize: 8,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          color: 'rgba(255,255,255,0.32)',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.78)' }}>{value}</span>
    </div>
  )
}

/* ── Component ─────────────────────────────────────────────────── */

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
  onExport,
}: PeriodContextStripProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [triggerHover, setTriggerHover] = useState(false)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!isPickerOpen) return
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isPickerOpen])

  const status = getPeriodStatus(periodStart, periodEnd)
  const identity = getPeriodIdentity(periodStart)
  const dateRange = `${formatPeriodDate(periodStart)} – ${formatPeriodDate(periodEnd)}`

  const sortedPeriods = [...periods].sort(
    (a, b) => b.periodStart.getTime() - a.periodStart.getTime(),
  )

  /* ── Trigger ── */

  const trigger = (
    <button
      type="button"
      onClick={() => setIsPickerOpen((v) => !v)}
      onMouseEnter={() => setTriggerHover(true)}
      onMouseLeave={() => setTriggerHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        padding: '8px 16px',
        borderRadius: 8,
        border: `1px solid ${
          triggerHover || isPickerOpen ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.18)'
        }`,
        background:
          isPickerOpen || triggerHover ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
        flexShrink: 0,
        marginRight: isMobile ? 0 : 22,
        width: isMobile ? '100%' : undefined,
        justifyContent: isMobile ? 'space-between' : undefined,
        userSelect: 'none',
        transition: 'background 120ms, border-color 120ms',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 34, fontWeight: 700, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>
          Q{identity.quarter}
        </span>
        <span style={{ fontSize: 17, fontWeight: 600, color: '#fff', lineHeight: 1 }}>
          FY {identity.fiscalYearLabel}
        </span>
        <span
          style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.2)', margin: '0 4px', flexShrink: 0 }}
        />
        <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{dateRange}</span>
      </span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden
        style={{
          color: 'rgba(255,255,255,0.55)',
          marginLeft: 4,
          flexShrink: 0,
          transition: 'transform 200ms',
          transform: isPickerOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        }}
      >
        <path
          d="M3 5L7 9L11 5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )

  /* ── Export button ── */

  const exportButton = (
    <button
      type="button"
      onClick={onExport}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '7px 13px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.22)',
        background: 'rgba(255,255,255,0.08)',
        fontSize: 11,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.75)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        marginLeft: isMobile ? 0 : 'auto',
        width: isMobile ? '100%' : undefined,
        flexShrink: 0,
      }}
    >
      <DownloadIcon />
      Export as .xlsx
    </button>
  )

  const metaDivider = (
    <span
      style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.14)', margin: '0 18px', flexShrink: 0 }}
    />
  )

  /* ── Top row ── */

  const topRow = (
    <div
      style={{
        background: COLORS.stripBg,
        display: 'flex',
        alignItems: isMobile ? 'stretch' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 10 : 0,
        padding: '12px 18px',
      }}
    >
      {trigger}
      {!isMobile && (
        <>
          {metaDivider}
          <MetaItem label="Working days" value={`${workingDays}`} />
          {metaDivider}
          <MetaItem label="Platform" value={platformName} />
        </>
      )}
      {exportButton}
    </div>
  )

  /* ── Mobile meta grid ── */

  const mobileMetaGrid = isMobile ? (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        background: COLORS.stripBg,
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {[
        { label: 'Period', value: dateRange },
        { label: 'Working days', value: `${workingDays}` },
        { label: 'Platform', value: platformName },
      ].map((item, i) => (
        <div
          key={item.label}
          style={{
            padding: '10px 18px',
            borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.08)' : undefined,
            borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.08)' : undefined,
          }}
        >
          <MetaItem label={item.label} value={item.value} />
        </div>
      ))}
    </div>
  ) : null

  /* ── Period picker dropdown ── */

  const picker = (
    <div
      style={{
        background: '#FFFFFF',
        borderTop: '1px solid #EEEEEE',
        display: isPickerOpen ? 'block' : 'none',
      }}
    >
      {sortedPeriods.map((p, i) => {
        const pid = getPeriodIdentity(p.periodStart)
        const rowStatus = getPeriodStatus(p.periodStart, p.periodEnd)
        const isCurrent = p.periodId === currentPeriodId
        const isHovered = hoveredRow === p.periodId
        const isLast = i === sortedPeriods.length - 1

        return (
          <div
            key={p.periodId}
            onMouseEnter={() => setHoveredRow(p.periodId)}
            onMouseLeave={() => setHoveredRow(null)}
            onClick={() => {
              onPeriodSelect(p.periodId)
              setIsPickerOpen(false)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '13px 18px',
              cursor: 'pointer',
              borderBottom: isLast ? undefined : '1px solid #EEEEEE',
              background: isHovered ? '#F5F5F5' : isCurrent ? '#FAFAFA' : '#FFFFFF',
              transition: 'background 100ms',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                minWidth: 80,
                height: 52,
                flexShrink: 0,
                borderRadius: 8,
                background: COLORS.badgeRed,
                padding: '0 12px',
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.04em' }}>
                Q{pid.quarter}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>FY {pid.fiscalYearLabel}</span>
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2A2A2D' }}>
                {formatPeriodDate(p.periodStart)} – {formatPeriodDate(p.periodEnd)}
              </div>
              <div style={{ fontSize: 10, color: '#8F9495', marginTop: 2 }}>{p.workingDays} working days</div>
            </div>

            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '3px 8px',
                borderRadius: 4,
                flexShrink: 0,
                ...CHIP_STYLES[rowStatus],
              }}
            >
              {CHIP_LABEL[rowStatus]}
            </span>
          </div>
        )
      })}
    </div>
  )

  /* ── Banner ── */

  const bannerLayout: React.CSSProperties = {
    display: 'flex',
    alignItems: isMobile ? 'flex-start' : 'center',
    flexWrap: isMobile ? 'wrap' : 'nowrap',
    gap: 12,
    padding: '12px 18px',
    borderTop: '1px solid rgba(0,0,0,0.08)',
  }

  let banner: React.ReactNode

  if (status === 'active') {
    banner = (
      <div style={{ ...bannerLayout, background: COLORS.bannerActive }}>
        <ActiveIcon />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
            This period is currently active
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>
            All values are editable. Lock to prevent accidental changes.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <LockToggle locked={locked} onToggle={onLockToggle} variant="light" />
          {onDuplicate && (
            <PillButton onClick={onDuplicate} variant="light">
              Duplicate
            </PillButton>
          )}
        </div>
      </div>
    )
  } else if (status === 'historic') {
    banner = (
      <div style={{ ...bannerLayout, background: COLORS.bannerHistoric }}>
        <HistoricIcon />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2A2A2D' }}>
            {locked ? 'This period is historic' : 'This period is historic — editing unlocked'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(42,42,45,0.65)' }}>
            {locked
              ? 'All values are read-only. Unlock to make changes.'
              : 'Changes now permitted. Lock again when done.'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <LockToggle locked={locked} onToggle={onLockToggle} variant="dark" />
        </div>
      </div>
    )
  } else {
    banner = (
      <div style={{ ...bannerLayout, background: COLORS.bannerDraft }}>
        <DraftIcon />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>This period is in draft</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>
            Review all resources before activating this period.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {onActivate && (
            <PillButton onClick={onActivate} variant="light">
              Activate
            </PillButton>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.1)',
        marginBottom: 20,
      }}
    >
      {topRow}
      {mobileMetaGrid}
      {picker}
      {banner}
    </div>
  )
}
