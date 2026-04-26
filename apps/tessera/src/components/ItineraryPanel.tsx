'use client'

import { useEffect, useState, Fragment } from 'react'
import { X } from 'lucide-react'
import type { ItineraryDay, ItinerarySession } from '@/app/itinerary/page'
import {
  getCardStyle,
  typeLabel,
  SessionIcon,
  LocationPin,
  CG_DAY_DATE,
  zonifyDay,
  type DayZone,
} from './ItineraryClient'

// ── Compact session card ──────────────────────────────────────────────

function PanelSessionCard({ session }: { session: ItinerarySession }) {
  const style = getCardStyle(session.session_type, session.team)
  const title = session.focus ?? typeLabel(session.session_type)
  const timeStr = session.time_start
    ? session.time_end
      ? `${session.time_start} – ${session.time_end}`
      : session.time_start
    : null
  const showLocationPin =
    !!session.location &&
    session.session_type !== 'travel' &&
    session.session_type !== 'meal' &&
    session.session_type !== 'flight' &&
    session.session_type !== 'rest'

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 'var(--rmg-radius-s)',
        padding: '7px 12px 7px 14px',
        marginBottom: 7,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: 3,
          background: style.accent,
        }}
      />
      {timeStr && (
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--rmg-color-grey-1)',
            marginBottom: 2,
          }}
        >
          {timeStr}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <SessionIcon type={session.session_type} colour={style.accent} />
        <span
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--rmg-color-black)',
            lineHeight: 1.3,
            flex: 1,
          }}
        >
          {title}
        </span>
      </div>
      {showLocationPin && <LocationPin location={session.location!} />}
    </div>
  )
}

// ── Zone renderer ─────────────────────────────────────────────────────

function PanelZoneSection({ zone }: { zone: DayZone }) {
  if (zone.sessions.length === 0) return null
  if (!zone.hasSplit) {
    return <>{zone.sessions.map((s) => <PanelSessionCard key={s.id} session={s} />)}</>
  }
  return (
    <>
      {zone.all.map((s) => <PanelSessionCard key={s.id} session={s} />)}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, alignItems: 'start' }}>
        <div>{zone.delivery.map((s) => <PanelSessionCard key={s.id} session={s} />)}</div>
        <div>{zone.service.map((s) => <PanelSessionCard key={s.id} session={s} />)}</div>
      </div>
    </>
  )
}

// ── Compact day block ─────────────────────────────────────────────────

function PanelDayBlock({
  day,
  sessions,
  expanded,
  onToggle,
}: {
  day: ItineraryDay
  sessions: ItinerarySession[]
  expanded: boolean
  onToggle: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const isCGDay = day.date === CG_DAY_DATE
  const { morning, working, evening, anyZoneHasSplit } = zonifyDay(sessions)
  const nonEmpty = [
    { zone: morning, key: 'morning' },
    { zone: working, key: 'working' },
    { zone: evening, key: 'evening' },
  ].filter(({ zone }) => zone.sessions.length > 0)

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle() }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 0',
          cursor: 'pointer',
          backgroundColor: hovered ? 'var(--rmg-color-grey-4)' : 'transparent',
          borderRadius: 'var(--rmg-radius-s)',
          outline: 'none',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--rmg-color-text-heading)',
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {day.day_label}
          {isCGDay && (
            <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--track-a)', fontWeight: 600 }}>
              CG Day
            </span>
          )}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 14,
            color: 'var(--rmg-color-grey-1)',
            fontSize: 9,
            transition: 'transform 200ms ease',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </div>

      {expanded && (
        <>
          {anyZoneHasSplit && (
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backgroundColor: 'var(--rmg-color-surface-white)',
                padding: '8px 0 10px',
                borderBottom: '2px solid var(--rmg-color-grey-2)',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--rmg-font-display)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--rmg-color-text-heading)',
                  marginBottom: 6,
                }}
              >
                {day.day_label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ fontFamily: 'var(--rmg-font-body)', fontSize: 11, fontWeight: 700, color: '#4a9eff', borderBottom: '2px solid #4a9eff', paddingBottom: 3 }}>
                  Delivery — Matt &amp; Jonny
                </div>
                <div style={{ fontFamily: 'var(--rmg-font-body)', fontSize: 11, fontWeight: 700, color: '#e8382a', borderBottom: '2px solid #e8382a', paddingBottom: 3 }}>
                  Service — Clare &amp; Mandy
                </div>
              </div>
            </div>
          )}

          {nonEmpty.map(({ zone, key }, i) => (
            <Fragment key={key}>
              {i > 0 && <div style={{ height: 1, background: 'var(--rmg-color-grey-3)', margin: '6px 0' }} />}
              <PanelZoneSection zone={zone} />
            </Fragment>
          ))}
        </>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────

export function ItineraryPanel({
  isOpen,
  onClose,
  isMobile,
  days,
  sessions,
  loading,
}: {
  isOpen: boolean
  onClose: () => void
  isMobile: boolean
  days: ItineraryDay[]
  sessions: ItinerarySession[]
  loading: boolean
}) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (days.length > 0) setExpandedDays(new Set(days.map((d) => d.id)))
  }, [days])

  function toggleDay(id: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const sessionsByDay = new Map<string, ItinerarySession[]>()
  for (const s of sessions) {
    const list = sessionsByDay.get(s.day_id) ?? []
    list.push(s)
    sessionsByDay.set(s.day_id, list)
  }

  const panelWidth = isMobile ? '100vw' : '580px'

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        height: '100%',
        width: isOpen ? panelWidth : 0,
        minWidth: 0,
        overflow: 'hidden',
        transition: 'width 250ms ease',
        zIndex: 50,
        backgroundColor: 'var(--rmg-color-surface-white)',
        boxShadow: isOpen ? '-4px 0 16px rgba(0,0,0,0.12)' : 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {isOpen && (
        <>
          {/* Panel header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid var(--rmg-color-grey-3)',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--rmg-font-display)',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--rmg-color-text-heading)',
              }}
            >
              Itinerary
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--rmg-color-grey-1)',
                display: 'flex',
                alignItems: 'center',
                padding: 4,
                borderRadius: 'var(--rmg-radius-s)',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
            {loading ? (
              <p style={{ fontFamily: 'var(--rmg-font-body)', fontSize: 13, color: 'var(--rmg-color-text-light)', margin: '12px 0' }}>
                Loading…
              </p>
            ) : days.length === 0 ? (
              <p style={{ fontFamily: 'var(--rmg-font-body)', fontSize: 13, color: 'var(--rmg-color-text-light)', margin: '12px 0' }}>
                No itinerary data.
              </p>
            ) : (
              days.map((day) => (
                <PanelDayBlock
                  key={day.id}
                  day={day}
                  sessions={sessionsByDay.get(day.id) ?? []}
                  expanded={expandedDays.has(day.id)}
                  onToggle={() => toggleDay(day.id)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
