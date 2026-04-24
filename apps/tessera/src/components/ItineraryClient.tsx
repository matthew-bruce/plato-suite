'use client'

import { useState } from 'react'
import type { ItineraryDay, ItinerarySession, TripState } from '@/app/itinerary/page'
import { TRACK_COLOURS } from '@plato/ui/tokens'

// ── Permitted non-token hex values (Tessera-specific exceptions) ──────
const PURPLE_SESSION = '#6C4FC9'   // no --rmg-* token equivalent
const TEAL_HOTEL     = '#1A9E8C'   // no --rmg-* token equivalent

// ── Supplier colours (SUPPLIER_COLOUR_FALLBACKS subset) ───────────────
const SUPPLIER_HEX: Record<string, string> = {
  CG:  '#003C82',
  TCS: '#9B0A6E',
}

// ── Card style ────────────────────────────────────────────────────────

type CardStyle = {
  bg: string
  borderColor: string
  borderStyle: 'solid' | 'dashed'
}

const CG_DAY_DATE = '2026-04-30'

function getCardStyle(
  sessionType: string | null,
  team: string | null,
  dayDate: string,
): CardStyle {
  const isCGDay = dayDate === CG_DAY_DATE
  const type = sessionType ?? 'session'

  switch (type) {
    case 'flight':
      return { bg: 'var(--rmg-color-grey-4)', borderColor: 'var(--rmg-color-dark-grey)', borderStyle: 'solid' }
    case 'travel':
      return { bg: 'rgba(238,238,238,0.7)', borderColor: 'var(--rmg-color-grey-1)', borderStyle: 'solid' }
    case 'hotel_checkin':
    case 'hotel_checkout':
      return { bg: 'rgba(26,158,140,0.06)', borderColor: TEAL_HOTEL, borderStyle: 'solid' }
    case 'meal':
      return { bg: 'rgba(254,235,135,0.4)', borderColor: 'var(--rmg-color-orange)', borderStyle: 'solid' }
    case 'rest':
      return { bg: 'var(--rmg-color-grey-4)', borderColor: 'var(--rmg-color-grey-2)', borderStyle: 'solid' }
    case 'gap':
      return { bg: 'rgba(255,189,128,0.4)', borderColor: 'var(--rmg-color-orange)', borderStyle: 'dashed' }
    case 'session':
      if (team === 'DELIVERY') {
        const col = isCGDay ? TRACK_COLOURS.A : TRACK_COLOURS.B
        return { bg: isCGDay ? 'rgba(218,32,42,0.06)' : 'rgba(8,146,203,0.06)', borderColor: col, borderStyle: 'solid' }
      }
      if (team === 'SERVICE') {
        return { bg: 'rgba(218,32,42,0.06)', borderColor: TRACK_COLOURS.A, borderStyle: 'solid' }
      }
      // ALL or unknown team
      return { bg: 'rgba(108,79,201,0.06)', borderColor: PURPLE_SESSION, borderStyle: 'solid' }
    default:
      return { bg: 'var(--rmg-color-grey-4)', borderColor: 'var(--rmg-color-grey-2)', borderStyle: 'solid' }
  }
}

// ── Full-width test ───────────────────────────────────────────────────

const FULL_WIDTH_TYPES = new Set([
  'flight', 'travel', 'hotel_checkin', 'hotel_checkout', 'meal', 'rest', 'gap',
])

function isFullWidth(s: ItinerarySession): boolean {
  return s.team === 'ALL' || FULL_WIDTH_TYPES.has(s.session_type ?? '')
}

// ── Session type label ────────────────────────────────────────────────

function typeLabel(t: string | null): string {
  switch (t) {
    case 'flight':        return 'Flight'
    case 'travel':        return 'Transfer'
    case 'hotel_checkin': return 'Hotel check-in'
    case 'hotel_checkout':return 'Hotel check-out'
    case 'meal':          return 'Meal'
    case 'rest':          return 'Rest'
    case 'gap':           return 'Gap'
    case 'session':       return 'Session'
    default:              return t ?? 'Session'
  }
}

// ── Icons ─────────────────────────────────────────────────────────────

function Icon({ type, colour }: { type: string | null; colour: string }) {
  const props = {
    width: 16, height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: colour,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { flexShrink: 0 },
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
    default: // session
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

// ── Session card ──────────────────────────────────────────────────────

function SessionCard({ session, dayDate }: { session: ItinerarySession; dayDate: string }) {
  const style = getCardStyle(session.session_type, session.team, dayDate)
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
        background: style.bg,
        borderLeft: `4px ${style.borderStyle} ${style.borderColor}`,
        borderRadius: `0 var(--rmg-radius-s) var(--rmg-radius-s) var(--rmg-radius-s)`,
        padding: '12px 16px',
        marginBottom: 8,
      }}
    >
      {/* Row 1: time */}
      {timeStr && (
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 11,
            color: 'var(--rmg-color-grey-1)',
            fontVariantNumeric: 'tabular-nums',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 4,
          }}
        >
          {timeStr}
        </div>
      )}

      {/* Row 2: icon + title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 6,
          marginBottom: session.location ? 4 : 0,
        }}
      >
        <Icon type={session.session_type} colour={style.borderColor} />
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--rmg-color-text-heading)',
            lineHeight: 1.35,
            flex: 1,
          }}
        >
          {title}
        </div>
      </div>

      {/* Row 3: location meta */}
      {session.location && (
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 13,
            color: 'var(--rmg-color-text-light)',
            paddingLeft: 22,
            marginBottom: supplierColour ? 6 : 0,
          }}
        >
          {session.location}
        </div>
      )}

      {/* Row 4: supplier pill */}
      {supplierColour && session.supplier_host && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 'var(--rmg-radius-xl)',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'var(--rmg-font-body)',
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

// ── Legend ────────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { label: 'All Team',  colour: PURPLE_SESSION,                  dashed: false },
  { label: 'Delivery',  colour: TRACK_COLOURS.B,                 dashed: false },
  { label: 'Service',   colour: TRACK_COLOURS.A,                 dashed: false },
  { label: 'Travel',    colour: 'var(--rmg-color-grey-1)',        dashed: false },
  { label: 'Flight',    colour: 'var(--rmg-color-dark-grey)',     dashed: false },
  { label: 'Hotel',     colour: TEAL_HOTEL,                      dashed: false },
  { label: 'Gap',       colour: 'var(--rmg-color-orange)',        dashed: true  },
  { label: 'CG Day',    colour: TRACK_COLOURS.A,                 dashed: false },
] as const

function Legend() {
  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-grey-4)',
        borderRadius: 'var(--rmg-radius-m)',
        padding: '10px 16px',
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: 'var(--rmg-spacing-05)',
      }}
    >
      {LEGEND_ITEMS.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 10, height: 10,
              borderRadius: '50%',
              backgroundColor: item.dashed ? 'transparent' : item.colour,
              border: item.dashed ? `2px dashed ${item.colour}` : undefined,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 12,
              color: 'var(--rmg-color-text-light)',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Column header ─────────────────────────────────────────────────────

function ColumnHeader({
  label,
  location,
  borderColour,
}: {
  label: string
  location: string | null
  borderColour: string
}) {
  return (
    <div
      style={{
        borderBottom: `2px solid ${borderColour}`,
        paddingBottom: 6,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'var(--rmg-color-text-body)',
        }}
      >
        {label}
      </div>
      {location && (
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 11,
            color: 'var(--rmg-color-text-light)',
            marginTop: 2,
          }}
        >
          {location}
        </div>
      )}
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

  const fullWidth   = sessions.filter(isFullWidth)
  const deliverySessions = sessions.filter((s) => !isFullWidth(s) && s.team === 'DELIVERY')
  const serviceSessions  = sessions.filter((s) => !isFullWidth(s) && s.team === 'SERVICE')
  const hasTwoColumns = deliverySessions.length > 0 && serviceSessions.length > 0

  const deliveryCol = isCGDay ? TRACK_COLOURS.A : TRACK_COLOURS.B
  const deliveryLocation = deliverySessions[0]?.location ?? null
  const serviceLocation  = serviceSessions[0]?.location  ?? null

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
        <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
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
                color: TRACK_COLOURS.A,
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
            marginRight: 12,
            whiteSpace: 'nowrap',
          }}
        >
          {sessions.length} item{sessions.length === 1 ? '' : 's'}
        </span>
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
        <div style={{ borderTop: '1px solid var(--rmg-color-grey-3)', padding: '16px 20px' }}>
          {sessions.length === 0 ? (
            <p style={{ fontFamily: 'var(--rmg-font-body)', fontSize: 12, color: 'var(--rmg-color-grey-1)', margin: 0 }}>
              No sessions scheduled.
            </p>
          ) : (
            <>
              {/* 1. Full-width cards */}
              {fullWidth.map((s) => (
                <SessionCard key={s.id} session={s} dayDate={day.date} />
              ))}

              {/* 2a. Two-column grid */}
              {hasTwoColumns && (
                <>
                  <style>{`
                    .it-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
                    @media (max-width: 768px) { .it-grid { grid-template-columns: 1fr; } }
                  `}</style>
                  <div className="it-grid">
                    <div>
                      <ColumnHeader label="Delivery — Matt & Jonny" location={deliveryLocation} borderColour={deliveryCol} />
                      {deliverySessions.map((s) => (
                        <SessionCard key={s.id} session={s} dayDate={day.date} />
                      ))}
                    </div>
                    <div>
                      <ColumnHeader label="Service — Clare & Mandy" location={serviceLocation} borderColour={TRACK_COLOURS.A} />
                      {serviceSessions.map((s) => (
                        <SessionCard key={s.id} session={s} dayDate={day.date} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 2b. Single-column (only delivery or only service) */}
              {!hasTwoColumns && deliverySessions.length > 0 && (
                <div>
                  <ColumnHeader label="Delivery — Matt & Jonny" location={deliveryLocation} borderColour={deliveryCol} />
                  {deliverySessions.map((s) => (
                    <SessionCard key={s.id} session={s} dayDate={day.date} />
                  ))}
                </div>
              )}
              {!hasTwoColumns && serviceSessions.length > 0 && (
                <div>
                  <ColumnHeader label="Service — Clare & Mandy" location={serviceLocation} borderColour={TRACK_COLOURS.A} />
                  {serviceSessions.map((s) => (
                    <SessionCard key={s.id} session={s} dayDate={day.date} />
                  ))}
                </div>
              )}

              {/* Day notes */}
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
            </>
          )}
        </div>
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
  const [expandedDays, setExpandedDays] = useState<Set<string>>(
    () => new Set(days.map((d) => d.id)),
  )

  const sessionsByDay = new Map<string, ItinerarySession[]>()
  for (const s of sessions) {
    const list = sessionsByDay.get(s.day_id) ?? []
    list.push(s)
    sessionsByDay.set(s.day_id, list)
  }

  function toggleDay(id: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <>
      <Legend />

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
          sessions={sessionsByDay.get(day.id) ?? []}
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
