import { TesseraShell } from '@/components/TesseraShell'
import { supabase } from '@/lib/supabase'
import { buildSupplierMap } from '@plato/ui/tokens'
import { SessionsClient, type FlatSession } from '@/components/SessionsClient'

export const dynamic = 'force-dynamic'

type DbSession = {
  id: string
  session_name: string
  track: 'A' | 'B' | null
  is_playback: boolean
  status: string
  duration_hrs: number | null
  app_group_id: string | null
  sort_order: number | null
}

type DbAppGroup = {
  id: string
  group_number: number
  group_name: string
  sort_order: number
}

type SupplierRow = {
  supplier_abbreviation: string
  supplier_colour: string
}

type LeadRow = {
  session_id: string
  resources: { resource_name: string } | { resource_name: string }[] | null
}

export default async function SessionsPage() {
  const [sessionsRes, appGroupsRes, leadRes, suppliersRes] = await Promise.all([
    supabase
      .from('tessera_kt_sessions')
      .select('id, session_name, track, is_playback, status, duration_hrs, app_group_id, sort_order'),
    supabase
      .from('tessera_app_groups')
      .select('id, group_number, group_name, sort_order')
      .order('sort_order'),
    supabase
      .from('tessera_kt_session_resources')
      .select('session_id, resources(resource_name)')
      .eq('role', 'LEAD'),
    supabase
      .from('suppliers')
      .select('supplier_abbreviation, supplier_colour')
      .order('sort_order'),
  ])

  const allSessions = (sessionsRes.data ?? []) as DbSession[]
  const appGroups = (appGroupsRes.data ?? []) as DbAppGroup[]

  // Build supplier map (available for future use; not used in current flat-list UI)
  buildSupplierMap((suppliersRes.data ?? []) as SupplierRow[])

  // Build lead name lookup
  const leadMap: Record<string, string> = {}
  for (const row of (leadRes.data ?? []) as LeadRow[]) {
    const r = row.resources
    if (!r) continue
    const name = Array.isArray(r) ? r[0]?.resource_name : r.resource_name
    if (name) leadMap[row.session_id] = name
  }

  // Build group lookup: app_group_id → group metadata
  const groupMap = new Map(appGroups.map((g) => [g.id, g]))

  // Flatten sessions with joined group + lead data
  const flatSessions: FlatSession[] = allSessions.map((s) => {
    const group = s.app_group_id != null ? groupMap.get(s.app_group_id) : undefined
    return {
      id: s.id,
      session_name: s.session_name,
      track: s.track,
      is_playback: s.is_playback,
      status: s.status,
      duration_hrs: s.duration_hrs,
      group_number: group?.group_number ?? null,
      group_name: group?.group_name ?? null,
      lead_name: leadMap[s.id] ?? null,
      group_sort_order: group?.sort_order ?? null,
      session_sort_order: s.sort_order,
    }
  })

  const rawHours = allSessions.reduce(
    (sum, s) => sum + (Number(s.duration_hrs) || 0),
    0,
  )
  const totalHours = Number.isInteger(rawHours) ? rawHours : rawHours.toFixed(1)

  return (
    <TesseraShell activeRoute="/sessions">
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
          <div style={{ marginBottom: 'var(--rmg-spacing-05)' }}>
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
              KT Sessions
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
              {allSessions.length} sessions · {totalHours} hrs planned · 1 Apr → 3 Jul
              2026
            </p>
          </div>

          <SessionsClient sessions={flatSessions} />
        </div>
      </div>
    </TesseraShell>
  )
}
