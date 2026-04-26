'use client'

import { useState, Fragment } from 'react'
import { MapPin } from 'lucide-react'
import type { ItineraryDay, ItinerarySession, TripState } from '@/app/itinerary/page'

// Supplier colours for the host pill — no Tessera token for these
export const SUPPLIER_HEX: Record<string, string> = {
  CG:  '#003C82',
  TCS: '#9B0A6E',
}

// ── Card style ────────────────────────────────────────────────────────

export type CardStyle = {
  bg: string
  border: string
  accent: string
}

export const CG_DAY_DATE = '2026-04-30'

export function getCardStyle(
  sessionType: string | null,
  team: string | null,
): CardStyle {
  const type = sessionType ?? 'session'

  switch (type) {
    case 'session':
      if (team === 'DELIVERY')
        return { bg: 'var(--track-b-tint)', border: 'var(--track-b-border)', accent: 'var(--track-b)' }
      if (team === 'SERVICE')
        return { bg: 'var(--track-a-tint)', border: 'var(--track-a-border)', accent: 'var(--track-a)' }
      return { bg: 'var(--event-all-tint)', border: 'var(--event-all-border)', accent: 'var(--event-all-color)' }
    case 'meal':
      return {
        bg:     'rgba(253, 218, 36, 0.08)',
        border: 'rgba(201, 168, 0, 0.25)',
        accent: '#c9a800',
      }
    case 'travel':
    case 'rest':
      return { bg: 'var(--event-travel-tint)', border: 'var(--event-travel-border)', accent: 'var(--event-travel-color)' }
    case 'hotel_checkin':
    case 'hotel_checkout':
      return { bg: 'var(--event-hotel-tint)', border: 'var(--event-hotel-border)', accent: 'var(--event-hotel-color)' }
    case 'flight':
      return { bg: 'var(--event-flight-tint)', border: 'var(--event-flight-border)', accent: 'var(--rmg-color-black)' }
    case 'gap':
      return { bg: 'var(--event-gap-tint)', border: 'var(--event-gap-border)', accent: 'var(--event-gap-color)' }
    case 'sunset':
      return { bg: 'var(--event-all-tint)', border: 'var(--event-all-border)', accent: 'var(--event-all-color)' }
    default:
      return { bg: 'var(--event-travel-tint)', border: 'var(--event-travel-border)', accent: 'var(--event-travel-color)' }
  }
}

// ── Session type label ────────────────────────────────────────────────

export function typeLabel(t: string | null): string {
  switch (t) {
    case 'flight':         return 'Flight'
    case 'travel':         return 'Transfer'
    case 'hotel_checkin':  return 'Hotel check-in'
    case 'hotel_checkout': return 'Hotel check-out'
    case 'meal':           return 'Meal'
    case 'rest':           return 'Rest'
    case 'gap':            return 'Gap'
    case 'session':        return 'Session'
    default:               return t ?? 'Session'
  }
}

// ── Icons ─────────────────────────────────────────────────────────────

export function SessionIcon({ type, colour }: { type: string | null; colour: string }) {
  const props = {
    width: 16, height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: colour,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { flexShrink: 0 } as React.CSSProperties,
  }
  switch (type) {
    case 'flight':
      return (
        <svg {...props}>
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      )
    case 'hotel_checkin':
      return (
        <svg {...props}>
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    case 'hotel_checkout':
      return (
        <svg {...props}>
          <circle cx="7.5" cy="7.5" r="3.5" />
          <path d="M11 7.5H22M19 4l3 3.5-3 3.5" />
          <path d="M7.5 11v6" />
          <path d="M5 17h5" />
        </svg>
      )
    case 'travel':
      return (
        <svg {...props}>
          <rect x="1" y="10" width="18" height="8" rx="1" />
          <path d="M5 10V7a1 1 0 011-1h8a1 1 0 011 1v3" />
          <circle cx="5.5" cy="18.5" r="1.5" />
          <circle cx="14.5" cy="18.5" r="1.5" />
        </svg>
      )
    case 'meal':
      return (
        <svg {...props}>
          <path d="M18 8h1a4 4 0 010 8h-1" />
          <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
          <line x1="6" y1="1" x2="6" y2="4" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
      )
    case 'rest':
      return (
        <svg {...props}>
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )
    case 'gap':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      )
  }
}

// ── Location pin ──────────────────────────────────────────────────────

export function LocationPin({ location }: { location: string }) {
  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', color: 'inherit', marginTop: 3 }}
    >
      <MapPin size={12} color="var(--rmg-color-grey-1)" />
      <span style={{ fontSize: 12, color: 'var(--rmg-color-grey-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {location}
      </span>
    </a>
  )
}

// ── Session card ──────────────────────────────────────────────────────

function SessionCard({ session }: { session: ItinerarySession }) {
  const style = getCardStyle(session.session_type, session.team)
  const supplierColour = session.supplier_host ? (SUPPLIER_HEX[session.supplier_host] ?? null) : null
  const title = session.focus ?? typeLabel(session.session_type)
  const timeStr =
    session.time_start
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
        boxShadow: 'var(--rmg-shadow-subtle)',
        padding: '9px 13px 9px 16px',
        marginBottom: 8,
      }}
    >
      {/* Left accent bar */}
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
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--rmg-color-grey-1)',
            marginBottom: 3,
          }}
        >
          {timeStr}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SessionIcon type={session.session_type} colour={style.accent} />
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--rmg-color-black)',
            lineHeight: 1.35,
            flex: 1,
          }}
        >
          {title}
        </div>
      </div>

      {session.location && (
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 13,
            color: 'var(--rmg-color-grey-1)',
            marginTop: 3,
            lineHeight: 1.45,
          }}
        >
          {session.location}
        </div>
      )}

      {session.session_type === 'session' && supplierColour && session.supplier_host && (
        <div style={{ marginTop: 6 }}>
          <span
            style={{
              display: 'inline-flex',
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.06em',
              padding: '2px 9px',
              borderRadius: 'var(--rmg-radius-xl)',
              backgroundColor: `${supplierColour}18`,
              color: supplierColour,
              border: `1px solid ${supplierColour}`,
            }}
          >
            {session.supplier_host}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Filter bar ────────────────────────────────────────────────────────

type FilterKey = 'all' | 'delivery' | 'service' | 'travel' | 'flight' | 'hotel' | 'gap' | 'cgday'

const FILTER_CONFIG: { key: FilterKey; label: string; colour: string }[] = [
  { key: 'all',      label: 'All',      colour: '#6c4fc9' },
  { key: 'delivery', label: 'Delivery', colour: '#4a9eff' },
  { key: 'service',  label: 'Service',  colour: '#e8382a' },
  { key: 'travel',   label: 'Travel',   colour: '#8f9495' },
  { key: 'flight',   label: 'Flight',   colour: '#2a2a2d' },
  { key: 'hotel',    label: 'Hotel',    colour: '#1a9e8c' },
  { key: 'gap',      label: 'Gap',      colour: '#f3920d' },
  { key: 'cgday',    label: 'CG Day',   colour: '#e8382a' },
]

function isShared(s: ItinerarySession): boolean {
  const t = s.session_type ?? ''
  return (
    s.team === 'ALL' || s.team === null ||
    t === 'travel' || t === 'flight' ||
    t === 'hotel_checkin' || t === 'hotel_checkout' ||
    t === 'meal' || t === 'gap' || t === 'rest'
  )
}

function sessionMatchesFilter(s: ItinerarySession, dayDate: string, filters: FilterKey[]): boolean {
  if (filters.length === 0 || filters.includes('all')) return true
  return filters.some((f) => {
    switch (f) {
      case 'delivery': return s.team === 'DELIVERY' || isShared(s)
      case 'service':  return s.team === 'SERVICE'  || isShared(s)
      case 'travel':   return s.session_type === 'travel'
      case 'flight':   return s.session_type === 'flight'
      case 'hotel':    return s.session_type === 'hotel_checkin' || s.session_type === 'hotel_checkout'
      case 'gap':      return s.session_type === 'gap' || s.session_type === 'meal' || s.session_type === 'rest'
      case 'cgday':    return dayDate === CG_DAY_DATE
      default:         return false
    }
  })
}

function FilterBar({
  selectedFilters,
  onToggle,
}: {
  selectedFilters: FilterKey[]
  onToggle: (key: FilterKey) => void
}) {
  return (
    <div
      style={{
        background: 'var(--rmg-color-grey-4)',
        border: '1px solid var(--rmg-color-grey-3)',
        borderRadius: 'var(--rmg-radius-s)',
        padding: '10px 14px',
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: 'var(--rmg-spacing-05)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.08em',
          color: 'var(--rmg-color-text-light)',
          whiteSpace: 'nowrap',
          marginRight: 4,
        }}
      >
        Show:
      </span>
      {FILTER_CONFIG.map(({ key, label, colour }) => {
        const isActive = selectedFilters.includes(key)
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 12px',
              borderRadius: 'var(--rmg-radius-xl)',
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 11,
              fontWeight: isActive ? 700 : 500,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.06em',
              cursor: 'pointer',
              border: isActive
                ? `1.5px solid ${colour}`
                : '1.5px solid var(--rmg-color-grey-2)',
              backgroundColor: isActive ? `${colour}26` : 'transparent',
              color: isActive ? colour : 'var(--rmg-color-text-light)',
              whiteSpace: 'nowrap' as const,
              transition: 'all 120ms ease',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── Three-zone day layout ─────────────────────────────────────────────

export type DayZone = {
  sessions: ItinerarySession[]
  hasSplit: boolean
  delivery: ItinerarySession[]
  service:  ItinerarySession[]
  all:      ItinerarySession[]
}

export type DayZones = {
  morning:        DayZone
  working:        DayZone
  evening:        DayZone
  anyZoneHasSplit: boolean
}

function buildZone(list: ItinerarySession[]): DayZone {
  const sessions = [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const delivery = sessions.filter((s) => s.team === 'DELIVERY')
  const service  = sessions.filter((s) => s.team === 'SERVICE')
  const all      = sessions.filter((s) => s.team !== 'DELIVERY' && s.team !== 'SERVICE')
  return { sessions, delivery, service, all, hasSplit: delivery.length > 0 || service.length > 0 }
}

export function zonifyDay(sessions: ItinerarySession[]): DayZones {
  const m: ItinerarySession[] = []
  const w: ItinerarySession[] = []
  const e: ItinerarySession[] = []

  for (const s of sessions) {
    const t = s.time_start
    if (t === null) {
      if (s.session_type === 'hotel_checkout') m.push(s)
      else if (s.session_type === 'hotel_checkin') e.push(s)
      else w.push(s)
    } else if (t < '11:00') {
      m.push(s)
    } else if (t < '17:30') {
      w.push(s)
    } else {
      e.push(s)
    }
  }

  const morning = buildZone(m)
  const working = buildZone(w)
  const evening = buildZone(e)
  return {
    morning,
    working,
    evening,
    anyZoneHasSplit: morning.hasSplit || working.hasSplit || evening.hasSplit,
  }
}

// ── Column header ─────────────────────────────────────────────────────

function ColHeader({ label, colour, size = 13 }: { label: string; colour: string; size?: number }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        backgroundColor: 'var(--rmg-color-surface-light)',
        paddingTop: 6,
        paddingBottom: 10,
        fontFamily: 'var(--rmg-font-body)',
        fontSize: size,
        fontWeight: 700,
        color: colour,
        borderBottom: `2px solid ${colour}`,
      }}
    >
      {label}
    </div>
  )
}

// ── Day block ─────────────────────────────────────────────────────────

function DayBlock({
  day,
  sessions,
  isToday,
  isPast,
  expanded,
  onToggle,
}: {
  day: ItineraryDay
  sessions: ItinerarySession[]
  isToday: boolean
  isPast: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const [headerHovered, setHeaderHovered] = useState(false)
  const isCGDay = day.date === CG_DAY_DATE
  const { morning, working, evening, anyZoneHasSplit } = zonifyDay(sessions)

  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        marginBottom: 16,
        overflow: 'hidden',
        opacity: isPast ? 0.6 : 1,
        border: isToday ? '2px solid var(--rmg-color-green-contrast)' : '2px solid transparent',
      }}
    >
      {/* Collapsible header */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle() }}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '16px 20px',
          cursor: 'pointer',
          backgroundColor: isToday
            ? 'var(--rmg-color-tint-green)'
            : headerHovered
              ? 'var(--rmg-color-grey-4)'
              : 'transparent',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--rmg-color-text-heading)',
              whiteSpace: 'nowrap',
            }}
          >
            {day.day_label}
          </span>
          {isToday && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '2px 8px',
                backgroundColor: 'var(--rmg-color-green-contrast)',
                color: 'white',
                borderRadius: 'var(--rmg-radius-xl)',
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 10, fontWeight: 700,
                letterSpacing: '0.08em',
              }}
            >
              TODAY
            </span>
          )}
          {isCGDay && (
            <span
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 12,
                color: 'var(--track-a)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              CG Day
            </span>
          )}
        </div>

        <span
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 13,
            color: 'var(--rmg-color-text-light)',
            whiteSpace: 'nowrap',
          }}
        >
          {sessions.length} item{sessions.length === 1 ? '' : 's'}
        </span>

        <div style={{ flex: 1, height: 1, background: 'var(--rmg-color-grey-2)' }} />

        <span
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 16, color: 'var(--rmg-color-grey-1)', fontSize: 10,
            transition: 'transform 200ms ease',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▼
        </span>
      </div>

      {/* Body */}
      {expanded && (
        <>
          {anyZoneHasSplit && (
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 20,
                backgroundColor: 'var(--rmg-color-surface-light)',
                padding: '12px 20px',
                borderBottom: '2px solid var(--rmg-color-grey-2)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--rmg-font-display)',
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--rmg-color-text-heading)',
                  marginBottom: 8,
                }}
              >
                {day.day_label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ fontFamily: 'var(--rmg-font-body)', fontSize: 13, fontWeight: 700, color: '#4a9eff', borderBottom: '2px solid #4a9eff', paddingBottom: 4 }}>
                  Delivery — Matt &amp; Jonny
                </div>
                <div style={{ fontFamily: 'var(--rmg-font-body)', fontSize: 13, fontWeight: 700, color: '#e8382a', borderBottom: '2px solid #e8382a', paddingBottom: 4 }}>
                  Service — Clare &amp; Mandy
                </div>
              </div>
            </div>
          )}

          <div style={{ borderTop: anyZoneHasSplit ? 'none' : '1px solid var(--rmg-color-grey-3)', padding: '16px 20px' }}>
            {sessions.length === 0 ? (
              <p style={{ fontFamily: 'var(--rmg-font-body)', fontSize: 12, color: 'var(--rmg-color-grey-1)', margin: 0 }}>
                No sessions scheduled.
              </p>
            ) : (
              <>
                {[
                  { zone: morning, key: 'morning', label: 'Morning' },
                  { zone: working, key: 'working', label: 'Daytime' },
                  { zone: evening, key: 'evening', label: 'Evening' },
                ]
                  .filter(({ zone }) => zone.sessions.length > 0)
                  .map(({ zone, key, label }, i) => (
                    <Fragment key={key}>
                      {i > 0 && <div style={{ height: 1, background: 'var(--rmg-color-grey-3)', margin: '8px 0' }} />}
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--rmg-color-grey-1)', marginBottom: 6, marginTop: i === 0 ? 0 : 16, paddingLeft: 2, fontFamily: 'var(--rmg-font-body)' }}>
                        {label}
                      </div>
                      {zone.hasSplit ? (
                        <>
                          {zone.all.map((s) => <SessionCard key={s.id} session={s} />)}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'start' }}>
                            <div>{zone.delivery.map((s) => <SessionCard key={s.id} session={s} />)}</div>
                            <div>{zone.service.map((s) => <SessionCard key={s.id} session={s} />)}</div>
                          </div>
                        </>
                      ) : (
                        zone.sessions.map((s) => <SessionCard key={s.id} session={s} />)
                      )}
                    </Fragment>
                  ))}
              </>
            )}

            {day.notes && (
              <p
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 'var(--rmg-text-c2)',
                  color: 'var(--rmg-color-text-light)',
                  fontStyle: 'italic',
                  margin: '8px 0 0',
                  borderTop: '1px solid var(--rmg-color-grey-3)',
                  paddingTop: 8,
                }}
              >
                {day.notes}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Ghost button ──────────────────────────────────────────────────────

function GhostButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 12, fontWeight: 500,
        color: 'var(--rmg-color-text-body)',
        background: 'transparent',
        border: '2px solid var(--rmg-color-grey-2)',
        borderRadius: 'var(--rmg-radius-m)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// ── Address block ─────────────────────────────────────────────────────

function AddressBlock() {
  const cards = [
    {
      supplier: 'CG', colour: '#003C82',
      name: 'Capgemini Noida',
      lines: ['Plot No. 1, Sector 16A', 'Noida, Uttar Pradesh 201 301', 'India'],
    },
    {
      supplier: 'TCS', colour: '#9B0A6E',
      name: 'TCS Gurgaon',
      lines: ['12/4, Sector 44', 'Gurugram, Haryana 122 003', 'India'],
    },
  ] as const

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--rmg-spacing-05)',
        marginTop: 'var(--rmg-spacing-07)',
      }}
    >
      {cards.map((c) => (
        <div
          key={c.supplier}
          style={{
            backgroundColor: 'var(--rmg-color-surface-white)',
            borderRadius: 'var(--rmg-radius-m)',
            boxShadow: 'var(--rmg-shadow-card)',
            padding: 'var(--rmg-spacing-05)',
            borderTop: `3px solid ${c.colour}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: c.colour, letterSpacing: '0.06em' }}>
              {c.supplier}
            </span>
            <span style={{ fontFamily: 'var(--rmg-font-display)', fontSize: 'var(--rmg-text-c1)', fontWeight: 700, color: 'var(--rmg-color-text-heading)' }}>
              {c.name}
            </span>
          </div>
          {c.lines.map((line) => (
            <p key={line} style={{ fontFamily: 'var(--rmg-font-body)', fontSize: 'var(--rmg-text-c2)', color: 'var(--rmg-color-text-light)', margin: 0, lineHeight: 1.5 }}>
              {line}
            </p>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────

export function ItineraryClient({
  days,
  sessions,
  todayStr,
  tripState,
}: {
  days: ItineraryDay[]
  sessions: ItinerarySession[]
  todayStr: string
  tripState: TripState
}) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => {
    if (days.length === 0) return new Set()
    const todayDay = days.find((d) => d.date === todayStr)
    if (todayDay) return new Set([todayDay.id])
    if (todayStr < days[0].date) return new Set([days[0].id])
    return new Set([days[days.length - 1].id])
  })

  const [selectedFilters, setSelectedFilters] = useState<FilterKey[]>(['all'])

  function toggleFilter(key: FilterKey) {
    setSelectedFilters((prev) => {
      if (key === 'all') return ['all']
      const withoutAll = prev.filter((k) => k !== 'all')
      const next = withoutAll.includes(key)
        ? withoutAll.filter((k) => k !== key)
        : [...withoutAll, key]
      return next.length === 0 ? ['all'] : next
    })
  }

  const sessionsByDay = new Map<string, ItinerarySession[]>()
  for (const s of sessions) {
    const list = sessionsByDay.get(s.day_id) ?? []
    list.push(s)
    sessionsByDay.set(s.day_id, list)
  }

  const hasSplitDays = days.some((day) => {
    const ds = sessionsByDay.get(day.id) ?? []
    return ds.some((s) => s.team === 'DELIVERY') && ds.some((s) => s.team === 'SERVICE')
  })

  const filteredSessionsByDay = new Map<string, ItinerarySession[]>()
  for (const day of days) {
    const daySessions = sessionsByDay.get(day.id) ?? []
    filteredSessionsByDay.set(
      day.id,
      selectedFilters.includes('all')
        ? daySessions
        : daySessions.filter((s) => sessionMatchesFilter(s, day.date, selectedFilters)),
    )
  }

  function toggleDay(id: string) {
    setExpandedDays((prev) => {
      if (prev.has(id)) {
        const next = new Set(prev)
        next.delete(id)
        return next
      }
      return new Set([id])
    })
  }

  return (
    <>
      {/* Track info strip — only when split days exist */}
      {hasSplitDays && (
        <div
          style={{
            backgroundColor: 'var(--rmg-color-surface-white)',
            borderBottom: '1px solid var(--rmg-color-grey-3)',
            padding: '10px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--rmg-spacing-05)',
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 12,
              fontWeight: 700,
              color: '#4a9eff',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4a9eff', flexShrink: 0, display: 'inline-block' }} />
            Delivery — Matt &amp; Jonny
          </span>
          <div style={{ width: 1, height: 16, backgroundColor: 'var(--rmg-color-grey-2)' }} />
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 12,
              fontWeight: 700,
              color: '#e8382a',
            }}
          >
            Service — Clare &amp; Mandy
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#e8382a', flexShrink: 0, display: 'inline-block' }} />
          </span>
        </div>
      )}

      <FilterBar selectedFilters={selectedFilters} onToggle={toggleFilter} />

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 'var(--rmg-spacing-04)' }}>
        <GhostButton label="Expand all" onClick={() => setExpandedDays(new Set(days.map((d) => d.id)))} />
        <GhostButton label="Collapse all" onClick={() => setExpandedDays(new Set())} />
      </div>

      {/* Day blocks */}
      {days.map((day) => (
        <DayBlock
          key={day.id}
          day={day}
          sessions={filteredSessionsByDay.get(day.id) ?? []}
          isToday={tripState === 'active' && day.date === todayStr}
          isPast={tripState === 'active' && day.date < todayStr}
          expanded={expandedDays.has(day.id)}
          onToggle={() => toggleDay(day.id)}
        />
      ))}

      <AddressBlock />
    </>
  )
}
