'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCardStyle, typeLabel, SessionIcon, CG_DAY_DATE } from './ItineraryClient'

// ── Local types (mirror tessera_itinerary_days / tessera_itinerary_sessions) ──

type PanelDay = {
  id: string
  date: string
  day_label: string
  notes: string | null
}

type PanelSession = {
  id: string
  day_id: string
  session_type: string | null
  team: string | null
  location: string | null
  supplier_host: string | null
  focus: string | null
  time_start: string | null
  time_end: string | null
  sort_order: number | null
}

// ── Trip constants ────────────────────────────────────────────────────

const TRIP_START = new Date('2026-04-27T00:00:00Z')
const TRIP_END   = new Date('2026-05-02T23:59:59Z')

// ── Compact track pill ────────────────────────────────────────────────

function PanelTrackPill({ team }: { team: string }) {
  const isDelivery = team === 'DELIVERY'
  return (
    <span
      style={{
        display: 'inline-flex',
        marginTop: 5,
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
        padding: '2px 7px',
        borderRadius: 'var(--rmg-radius-xl)',
        backgroundColor: isDelivery ? 'rgba(74,158,255,0.12)' : 'rgba(232,56,42,0.1)',
        color: isDelivery ? '#4a9eff' : '#e8382a',
      }}
    >
      {isDelivery ? 'Delivery' : 'Service'}
    </span>
  )
}

// ── Compact session card ──────────────────────────────────────────────

function PanelSessionCard({ session, dayDate }: { session: PanelSession; dayDate: string }) {
  const style = getCardStyle(session.session_type, session.team, dayDate)
  const title = session.focus ?? typeLabel(session.session_type)
  const timeStr = session.time_start
    ? session.time_end
      ? `${session.time_start} – ${session.time_end}`
      : session.time_start
    : null
  const showTrackPill = session.team === 'DELIVERY' || session.team === 'SERVICE'

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 'var(--rmg-radius-s)',
        padding: '7px 12px 7px 14px',
        marginBottom: 5,
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: 3,
          background: style.accent,
        }}
      />

      {/* Time */}
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

      {/* Icon + title */}
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

      {/* Track pill */}
      {showTrackPill && <PanelTrackPill team={session.team!} />}
    </div>
  )
}

// ── Compact day block ─────────────────────────────────────────────────

function PanelDayBlock({
  day,
  sessions,
  expanded,
  onToggle,
}: {
  day: PanelDay
  sessions: PanelSession[]
  expanded: boolean
  onToggle: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const isCGDay = day.date === CG_DAY_DATE

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
          padding: '6px 4px',
          cursor: 'pointer',
          backgroundColor: hovered ? 'var(--rmg-color-grey-4)' : 'transparent',
          borderRadius: 'var(--rmg-radius-s)',
          outline: 'none',
          marginBottom: 6,
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

      {expanded && sessions.map((s) => (
        <PanelSessionCard key={s.id} session={s} dayDate={day.date} />
      ))}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────

export function ItineraryPanel({
  isOpen,
  onClose,
  isMobile,
}: {
  isOpen: boolean
  onClose: () => void
  isMobile: boolean
}) {
  const [days, setDays] = useState<PanelDay[]>([])
  const [sessions, setSessions] = useState<PanelSession[]>([])
  const [loaded, setLoaded] = useState(false)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const hasFetched = useRef(false)

  useEffect(() => {
    if (!isOpen || hasFetched.current) return
    hasFetched.current = true

    async function load() {
      const [daysRes, sessionsRes] = await Promise.all([
        supabase
          .from('tessera_itinerary_days')
          .select('id, date, day_label, notes')
          .order('date'),
        supabase
          .from('tessera_itinerary_sessions')
          .select('id, day_id, session_type, team, location, supplier_host, focus, time_start, time_end, sort_order')
          .order('sort_order'),
      ])

      const loadedDays     = (daysRes.data     ?? []) as PanelDay[]
      const loadedSessions = (sessionsRes.data ?? []) as PanelSession[]
      setDays(loadedDays)
      setSessions(loadedSessions)
      setLoaded(true)

      // Determine which day to expand by default
      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)
      const todayStr  = today.toISOString().slice(0, 10)
      const isAfter   = today > TRIP_END
      const isActive  = !isAfter && today >= TRIP_START

      let defaultId: string | null = null
      if (isActive) {
        defaultId = loadedDays.find((d) => d.date === todayStr)?.id ?? null
      } else if (!isAfter) {
        // Before trip: expand first upcoming day
        defaultId = loadedDays.find((d) => d.date >= todayStr)?.id ?? loadedDays[0]?.id ?? null
      }

      if (defaultId) setExpandedDays(new Set([defaultId]))
    }

    void load()
  }, [isOpen])

  function toggleDay(id: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const sessionsByDay = new Map<string, PanelSession[]>()
  for (const s of sessions) {
    const list = sessionsByDay.get(s.day_id) ?? []
    list.push(s)
    sessionsByDay.set(s.day_id, list)
  }

  const panelWidth = isMobile ? '100vw' : '380px'

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
              padding: '14px 16px',
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
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
            {!loaded ? (
              <p
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 13,
                  color: 'var(--rmg-color-text-light)',
                  margin: 0,
                }}
              >
                Loading…
              </p>
            ) : days.length === 0 ? (
              <p
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 13,
                  color: 'var(--rmg-color-text-light)',
                  margin: 0,
                }}
              >
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
