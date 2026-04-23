import { TesseraShell } from '@plato/ui/components/tessera'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const TRIP_START = new Date('2026-04-26T00:00:00Z')
const TRIP_END   = new Date('2026-05-01T23:59:59Z')

// Supplier / track colours
const DELIVERY_COLOUR = '#E8382A' // RMG red — Matt + Jonny
const SERVICE_COLOUR  = '#1565C0' // TCS blue — Clare + Mandy

const SUPPLIER_BADGE: Record<string, { bg: string; fg: string }> = {
  CG:  { bg: 'rgba(232, 56,  42,  0.12)', fg: DELIVERY_COLOUR },
  TCS: { bg: 'rgba(21,  101, 192, 0.12)', fg: SERVICE_COLOUR  },
}

type ItineraryDay = {
  id: string
  date: string
  day_label: string
  notes: string | null
}

type ItinerarySession = {
  id: string
  day_id: string
  team: 'DELIVERY' | 'SERVICE'
  location: string | null
  supplier_host: 'TCS' | 'CG'
  focus: string | null
}

type TripState = 'before' | 'active' | 'after'

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

export default async function ItineraryPage() {
  const [daysRes, sessionsRes] = await Promise.all([
    supabase
      .from('tessera_itinerary_days')
      .select('id, date, day_label, notes')
      .order('date'),
    supabase
      .from('tessera_itinerary_sessions')
      .select('id, day_id, team, location, supplier_host, focus'),
  ])

  const days     = (daysRes.data     ?? []) as ItineraryDay[]
  const sessions = (sessionsRes.data ?? []) as ItinerarySession[]

  const sessionsByDay = new Map<string, ItinerarySession[]>()
  for (const s of sessions) {
    const list = sessionsByDay.get(s.day_id) ?? []
    list.push(s)
    sessionsByDay.set(s.day_id, list)
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  let tripState: TripState = 'before'
  if (today > TRIP_END) {
    tripState = 'after'
  } else if (today >= TRIP_START) {
    tripState = 'active'
  }

  const daysToDepart = Math.ceil(
    (TRIP_START.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )

  return (
    <TesseraShell activeRoute="/itinerary">
      <div
        style={{
          maxWidth: 900,
          padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--rmg-spacing-05)',
            flexWrap: 'wrap',
            marginBottom: 'var(--rmg-spacing-07)',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: 'var(--rmg-font-display)',
                fontSize: 'var(--rmg-text-h2)',
                lineHeight: 'var(--rmg-leading-h2)',
                color: 'var(--rmg-color-text-heading)',
                margin: 0,
              }}
            >
              Itinerary
            </h1>
            <p
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-b3)',
                lineHeight: 'var(--rmg-leading-b3)',
                color: 'var(--rmg-color-text-light)',
                margin: 0,
                marginTop: 'var(--rmg-spacing-02)',
              }}
            >
              26 Apr – 1 May 2026 · Noida &amp; Gurgaon, India
            </p>
          </div>
          <TripStateBadge tripState={tripState} daysToDepart={daysToDepart} />
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--rmg-spacing-05)',
            flexWrap: 'wrap',
            marginBottom: 'var(--rmg-spacing-07)',
          }}
        >
          <LegendSwatch colour={DELIVERY_COLOUR} label="Delivery — Matt + Jonny" />
          <LegendSwatch colour={SERVICE_COLOUR}  label="Service — Clare + Mandy" />
        </div>

        {/* Day cards */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--rmg-spacing-05)',
          }}
        >
          {days.map((day) => {
            const daySessions = sessionsByDay.get(day.id) ?? []
            const isToday = tripState === 'active' && day.date === todayStr
            const isPast  = tripState === 'active' && day.date < todayStr
            return (
              <DayCard
                key={day.id}
                day={day}
                sessions={daySessions}
                isToday={isToday}
                isPast={isPast}
              />
            )
          })}
        </div>

        {/* Address reference */}
        <AddressBlock />
      </div>
    </TesseraShell>
  )
}

// ─── Trip state badge ─────────────────────────────────────────────────────────

function TripStateBadge({
  tripState,
  daysToDepart,
}: {
  tripState: TripState
  daysToDepart: number
}) {
  if (tripState === 'before') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: 'var(--rmg-spacing-02) var(--rmg-spacing-04)',
          backgroundColor: 'rgba(8, 146, 203, 0.12)',
          color: 'var(--rmg-color-blue)',
          borderRadius: 'var(--rmg-radius-xl)',
          fontFamily: 'monospace',
          fontSize: 'var(--rmg-text-c1)',
          fontWeight: 700,
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
        }}
      >
        {daysToDepart} DAY{daysToDepart === 1 ? '' : 'S'} TO DEPARTURE
      </span>
    )
  }
  if (tripState === 'after') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: 'var(--rmg-spacing-02) var(--rmg-spacing-04)',
          backgroundColor: 'var(--rmg-color-grey-4)',
          color: 'var(--rmg-color-text-light)',
          borderRadius: 'var(--rmg-radius-xl)',
          fontFamily: 'monospace',
          fontSize: 'var(--rmg-text-c1)',
          fontWeight: 700,
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
        }}
      >
        TRIP COMPLETE
      </span>
    )
  }
  return null
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function LegendSwatch({ colour, label }: { colour: string; label: string }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--rmg-spacing-02)' }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 2,
          backgroundColor: colour,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c1)',
          color: 'var(--rmg-color-text-light)',
        }}
      >
        {label}
      </span>
    </div>
  )
}

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayCard({
  day,
  sessions,
  isToday,
  isPast,
}: {
  day: ItineraryDay
  sessions: ItinerarySession[]
  isToday: boolean
  isPast: boolean
}) {
  const hasSessions = sessions.length > 0

  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        border: isToday
          ? '2px solid var(--rmg-color-green-contrast)'
          : '2px solid transparent',
        overflow: 'hidden',
        opacity: isPast ? 0.55 : 1,
      }}
    >
      {/* Day header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--rmg-spacing-04)',
          padding: 'var(--rmg-spacing-04) var(--rmg-spacing-05)',
          backgroundColor: isToday ? 'var(--rmg-color-tint-green)' : undefined,
          borderBottom: hasSessions ? '1px solid var(--rmg-color-grey-3)' : undefined,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--rmg-spacing-04)',
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h6)',
              lineHeight: 'var(--rmg-leading-h6)',
              color: 'var(--rmg-color-text-heading)',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {formatDate(day.date)}
          </span>
          <span
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-c1)',
              color: isToday
                ? 'var(--rmg-color-green-contrast)'
                : 'var(--rmg-color-text-light)',
              fontWeight: isToday ? 700 : 400,
            }}
          >
            {day.day_label}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--rmg-spacing-03)',
            flexShrink: 0,
          }}
        >
          {isToday && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                backgroundColor: 'var(--rmg-color-green-contrast)',
                color: 'var(--rmg-color-surface-white)',
                borderRadius: 'var(--rmg-radius-xl)',
                fontFamily: 'monospace',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.08em',
              }}
            >
              TODAY
            </span>
          )}
          {hasSessions && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 'var(--rmg-text-c2)',
                color: 'var(--rmg-color-text-light)',
              }}
            >
              {sessions.length} session{sessions.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {/* Transit / note-only days */}
      {!hasSessions && day.notes && (
        <div
          style={{
            padding: 'var(--rmg-spacing-04) var(--rmg-spacing-05)',
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-b3)',
            lineHeight: 'var(--rmg-leading-b3)',
            color: 'var(--rmg-color-text-light)',
          }}
        >
          {day.notes}
        </div>
      )}

      {/* Session rows */}
      {hasSessions && (
        <div>
          {sessions.map((session, idx) => (
            <SessionRow
              key={session.id}
              session={session}
              isLast={idx === sessions.length - 1 && !day.notes}
            />
          ))}
          {day.notes && (
            <div
              style={{
                padding: 'var(--rmg-spacing-03) var(--rmg-spacing-05)',
                borderTop: '1px solid var(--rmg-color-grey-3)',
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-c2)',
                lineHeight: 'var(--rmg-leading-c2)',
                color: 'var(--rmg-color-text-light)',
                fontStyle: 'italic',
              }}
            >
              {day.notes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Session row ──────────────────────────────────────────────────────────────

function SessionRow({
  session,
  isLast,
}: {
  session: ItinerarySession
  isLast: boolean
}) {
  const borderColour =
    session.team === 'DELIVERY' ? DELIVERY_COLOUR : SERVICE_COLOUR
  const badge = SUPPLIER_BADGE[session.supplier_host] ?? SUPPLIER_BADGE.TCS
  const teamLabel = session.team === 'DELIVERY' ? 'Delivery' : 'Service'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--rmg-spacing-04)',
        padding: 'var(--rmg-spacing-04) var(--rmg-spacing-05)',
        borderLeft: `4px solid ${borderColour}`,
        borderBottom: isLast ? undefined : '1px solid var(--rmg-color-grey-3)',
      }}
    >
      {/* Team label */}
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: borderColour,
          flexShrink: 0,
          paddingTop: 2,
          minWidth: 52,
        }}
      >
        {teamLabel}
      </span>

      {/* Supplier badge */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          backgroundColor: badge.bg,
          color: badge.fg,
          borderRadius: 'var(--rmg-radius-s)',
          fontFamily: 'monospace',
          fontSize: '10px',
          fontWeight: 700,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {session.supplier_host}
      </span>

      {/* Focus + location */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {session.focus && (
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-c1)',
              lineHeight: 'var(--rmg-leading-c1)',
              color: 'var(--rmg-color-text-body)',
              fontWeight: 500,
              margin: 0,
            }}
          >
            {session.focus}
          </p>
        )}
        {session.location && (
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-c2)',
              lineHeight: 'var(--rmg-leading-c2)',
              color: 'var(--rmg-color-text-light)',
              margin: 0,
              marginTop: session.focus ? 2 : 0,
            }}
          >
            {session.location}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Address reference block ──────────────────────────────────────────────────

function AddressBlock() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--rmg-spacing-05)',
        marginTop: 'var(--rmg-spacing-08)',
      }}
    >
      <AddressCard
        supplier="CG"
        name="Capgemini Noida"
        lines={['Plot No. 1, Sector 16A', 'Noida, Uttar Pradesh 201 301', 'India']}
        colour={DELIVERY_COLOUR}
      />
      <AddressCard
        supplier="TCS"
        name="TCS Gurgaon"
        lines={['12/4, Sector 44', 'Gurugram, Haryana 122 003', 'India']}
        colour={SERVICE_COLOUR}
      />
    </div>
  )
}

function AddressCard({
  supplier,
  name,
  lines,
  colour,
}: {
  supplier: string
  name: string
  lines: string[]
  colour: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: 'var(--rmg-spacing-05)',
        borderTop: `3px solid ${colour}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--rmg-spacing-02)',
          marginBottom: 'var(--rmg-spacing-03)',
        }}
      >
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '10px',
            fontWeight: 700,
            color: colour,
            letterSpacing: '0.06em',
          }}
        >
          {supplier}
        </span>
        <span
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 'var(--rmg-text-c1)',
            fontWeight: 700,
            color: 'var(--rmg-color-text-heading)',
          }}
        >
          {name}
        </span>
      </div>
      {lines.map((line) => (
        <p
          key={line}
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c2)',
            lineHeight: 'var(--rmg-leading-c2)',
            color: 'var(--rmg-color-text-light)',
            margin: 0,
          }}
        >
          {line}
        </p>
      ))}
    </div>
  )
}
