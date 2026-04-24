import { TesseraShell } from '@/components/TesseraShell'
import { supabase } from '@/lib/supabase'
import { ItineraryClient } from '@/components/ItineraryClient'

export const dynamic = 'force-dynamic'

const TRIP_START = new Date('2026-04-27T00:00:00Z')
const TRIP_END   = new Date('2026-05-02T23:59:59Z')

export type ItineraryDay = {
  id: string
  date: string
  day_label: string
  notes: string | null
}

export type ItinerarySession = {
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

export type TripState = 'before' | 'active' | 'after'

export default async function ItineraryPage() {
  const [daysRes, sessionsRes] = await Promise.all([
    supabase
      .from('tessera_itinerary_days')
      .select('id, date, day_label, notes')
      .order('date'),
    supabase
      .from('tessera_itinerary_sessions')
      .select(
        'id, day_id, session_type, team, location, supplier_host, focus, time_start, time_end, sort_order',
      )
      .order('sort_order'),
  ])

  if (daysRes.error)     console.error('[ItineraryPage] days error:', daysRes.error)
  if (sessionsRes.error) console.error('[ItineraryPage] sessions error:', sessionsRes.error)

  const days     = (daysRes.data     ?? []) as ItineraryDay[]
  const sessions = (sessionsRes.data ?? []) as ItinerarySession[]

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  let tripState: TripState = 'before'
  if (today > TRIP_END)         tripState = 'after'
  else if (today >= TRIP_START) tripState = 'active'

  const daysToDepart =
    tripState === 'before'
      ? Math.max(0, Math.ceil((TRIP_START.getTime() - today.getTime()) / 86_400_000))
      : 0

  return (
    <TesseraShell activeRoute="/itinerary">
      <div
        style={{
          backgroundColor: 'var(--rmg-color-surface-light)',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            width: '100%',
            padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
            boxSizing: 'border-box',
          }}
        >
          {/* Page header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 'var(--rmg-spacing-05)',
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: 'var(--rmg-font-display)',
                  fontSize: '2rem',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                  color: 'var(--rmg-color-text-heading)',
                  margin: 0,
                }}
              >
                India Trip Itinerary
              </h1>
              <p
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 14,
                  color: 'var(--rmg-color-text-light)',
                  margin: 0,
                  marginTop: 6,
                }}
              >
                27 April – 2 May 2026 · Noida &amp; Gurgaon
              </p>
            </div>

            {/* Trip state badge */}
            {tripState === 'before' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 20px',
                  backgroundColor: 'var(--rmg-color-red)',
                  color: 'var(--rmg-color-yellow)',
                  borderRadius: 'var(--rmg-radius-m)',
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  whiteSpace: 'nowrap',
                }}
              >
                {daysToDepart} day{daysToDepart === 1 ? '' : 's'} to India
              </span>
            )}
            {tripState === 'active' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 20px',
                  backgroundColor: 'var(--rmg-color-tint-yellow)',
                  border: '1.5px solid var(--rmg-color-yellow)',
                  borderRadius: 'var(--rmg-radius-m)',
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--rmg-color-text-heading)',
                  whiteSpace: 'nowrap',
                }}
              >
                In India — Noida
              </span>
            )}
            {tripState === 'after' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 20px',
                  backgroundColor: 'var(--rmg-color-grey-4)',
                  color: 'var(--rmg-color-text-light)',
                  borderRadius: 'var(--rmg-radius-m)',
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  whiteSpace: 'nowrap',
                }}
              >
                Trip complete
              </span>
            )}
          </div>

          <ItineraryClient
            days={days}
            sessions={sessions}
            todayStr={todayStr}
            tripState={tripState}
          />
        </div>
      </div>
    </TesseraShell>
  )
}
