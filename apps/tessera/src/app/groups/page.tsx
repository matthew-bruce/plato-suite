import { TesseraShell } from '@/components/TesseraShell'
import { supabase } from '@/lib/supabase'
import { buildSupplierMap } from '@plato/ui/tokens'
import { AppGroupsClient } from '@/components/AppGroupsClient'

export const dynamic = 'force-dynamic'

export type SupplierRef = {
  supplier_abbreviation: string
  supplier_colour: string
}

export type ResourceRef = {
  resource_id: string
  resource_name: string
  suppliers: SupplierRef | SupplierRef[] | null
}

export type GroupResourceRow = {
  role: 'LEAD' | 'PARTICIPANT' | 'OBSERVER'
  resources: ResourceRef | ResourceRef[] | null
}

export type Group = {
  id: string
  group_number: number
  group_name: string
  category: string | null
  total_planned_sessions: number
  total_planned_hours: number | null
  tessera_app_group_resources: GroupResourceRow[]
}

export type KtSession = {
  id: string
  session_name: string
  focus_area: string | null
  track: 'A' | 'B' | null
  is_playback: boolean
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED' | 'IN_PROGRESS'
  duration_hrs: number | null
  app_group_id: string | null
  lead_name: string | null
}

type SupplierRow = {
  supplier_abbreviation: string
  supplier_colour: string
}

type LeadRow = {
  session_id: string
  resources: { resource_name: string } | { resource_name: string }[] | null
}

export default async function AppGroupsPage() {
  const [groupsRes, sessionsRes, suppliersRes, leadRes] = await Promise.all([
    supabase
      .from('tessera_app_groups')
      .select(`
        id, group_number, group_name, category, total_planned_sessions, total_planned_hours,
        tessera_app_group_resources (
          role,
          resources (
            resource_id, resource_name,
            suppliers ( supplier_abbreviation, supplier_colour )
          )
        )
      `)
      .order('group_number'),
    supabase
      .from('tessera_kt_sessions')
      .select(
        'id, session_name, focus_area, track, is_playback, status, duration_hrs, app_group_id',
      )
      .order('sort_order'),
    supabase
      .from('suppliers')
      .select('supplier_abbreviation, supplier_colour')
      .order('sort_order'),
    supabase
      .from('tessera_kt_session_resources')
      .select('session_id, resources(resource_name)')
      .eq('role', 'LEAD'),
  ])

  if (groupsRes.error) console.error('[GroupsPage] groups error:', groupsRes.error)
  if (sessionsRes.error) console.error('[GroupsPage] sessions error:', sessionsRes.error)

  const groups = (groupsRes.data ?? []) as Group[]
  const supplierMap = buildSupplierMap((suppliersRes.data ?? []) as SupplierRow[])

  // Build session lead-name map
  const leadNameMap: Record<string, string> = {}
  for (const row of (leadRes.data ?? []) as LeadRow[]) {
    const r = row.resources
    if (!r) continue
    const name = Array.isArray(r) ? r[0]?.resource_name : r.resource_name
    if (name) leadNameMap[row.session_id] = name
  }

  // Normalise raw rows into typed KtSession[]
  const sessions: KtSession[] = (
    (sessionsRes.data ?? []) as Array<{
      id: string
      session_name: string
      focus_area: string | null
      track: string | null
      is_playback: boolean
      status: string
      duration_hrs: number | null
      app_group_id: string | null
    }>
  ).map((s) => ({
    id: s.id,
    session_name: s.session_name,
    focus_area: s.focus_area,
    track: s.track === 'A' || s.track === 'B' ? s.track : null,
    is_playback: s.is_playback,
    status: s.status as KtSession['status'],
    duration_hrs: s.duration_hrs,
    app_group_id: s.app_group_id,
    lead_name: leadNameMap[s.id] ?? null,
  }))

  const rawHours = groups.reduce(
    (sum, g) => sum + (Number(g.total_planned_hours) || 0),
    0,
  )
  const totalHours = Number.isInteger(rawHours) ? rawHours : rawHours.toFixed(1)

  return (
    <TesseraShell activeRoute="/groups">
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
              App Groups
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
              {groups.length} application groups · {sessions.length} sessions ·{' '}
              {totalHours} hrs
            </p>
          </div>
          <AppGroupsClient
            groups={groups}
            sessions={sessions}
            supplierMap={supplierMap}
          />
        </div>
      </div>
    </TesseraShell>
  )
}
