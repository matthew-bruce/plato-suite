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

// ── Panel day partition ───────────────────────────────────────────────

function partitionPanelDay(sessions: PanelSession[]) {
  const delivery = sessions.filter((s) => s.team === 'DELIVERY')
  const service  = sessions.filter((s) => s.team === 'SERVICE')
  const hasSplit = delivery.length > 0 && service.length > 0

  if (!hasSplit) {
    return { hasSplit: false, pre: [] as PanelSession[], delivery, service, post: [] as PanelSession[] }
  }

  const splitOrders = [...delivery, ...service].map((s) => s.sort_order ?? 0)
  const minOrder    = Math.min(...splitOrders)
  const maxOrder    = Math.max(...splitOrders)
  const shared      = sessions.filter((s) => s.team !== 'DELIVERY' && s.team !== 'SERVICE')

  return {
    hasSplit: true,
    pre:      shared.filter((s) => (s.sort_order ?? 0) < minOrder),
    delivery,
    service,
    post:     shared.filter((s) => (s.sort_order ?? 0) > maxOrder),
  }
}

// ── Compact column header ─────────────────────────────────────────────

function PanelColHeader({ label, colour }: { label: string; colour: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 11,
        fontWeight: 700,
        color: colour,
        borderBottom: `2px solid ${colour}`,
        paddingBottom: 4,
        marginBottom: 6,
      }}
    >
      {label}
    </div>
  )
}

// ── Compact session card ──────────────────────────────────────────────

function PanelSessionCard({ session }: { session: PanelSession }) {
  const style = getCardStyle(session.session_type, session.team)
  const title = session.focus ?? typeLabel(session.session_type)
  const timeStr = session.time_start
    ? session.time_end
      ? `${session.time_start} – ${session.time_end}`
      : session.time_start
    : null

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
  const { hasSplit, pre, delivery, service, post } = partitionPanelDay(sessions)

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

      {expanded && (
        hasSplit ? (
          <>
            {pre.map((s) => <PanelSessionCard key={s.id} session={s} />)}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                alignItems: 'start',
                marginTop: pre.length > 0 ? 6 : 0,
                marginBottom: post.length > 0 ? 6 : 0,
              }}
            >
              <div>
                <PanelColHeader label="Delivery — Matt & Jonny" colour="#4a9eff" />
                {delivery.map((s) => <PanelSessionCard key={s.id} session={s} />)}
              </div>
              <div>
                <PanelColHeader label="Service — Clare & Mandy" colour="#e8382a" />
                {service.map((s) => <PanelSessionCard key={s.id} session={s} />)}
              </div>
            </div>

            {post.map((s) => <PanelSessionCard key={s.id} session={s} />)}
          </>
        ) : (
          sessions.map((s) => <PanelSessionCard key={s.id} session={s} />)
        )
      )}
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

      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)
      const todayStr  = today.toISOString().slice(0, 10)
      const isAfter   = today > TRIP_END
      const isActive  = !isAfter && today >= TRIP_START

      let defaultId: string | null = null
      if (isActive) {
        defaultId = loadedDays.find((d) => d.date === todayStr)?.id ?? null
      } else if (!isAfter) {
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

  const panelWidth = isMobile ? '100vw' : '480px'

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
