import { TesseraShell } from '@plato/ui/components/tessera'
import { supabase } from '@/lib/supabase'
import { buildSupplierMap, type SupplierColourMap } from '@plato/ui/tokens'
import {
  SessionsClient,
  type ClientSession,
  type ClientAppGroup,
} from '@/components/SessionsClient'

export const dynamic = 'force-dynamic'

type KtSession = {
  id: string
  session_name: string
  focus_area: string | null
  track: 'A' | 'B' | null
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED'
  planned_date: string | null
  duration_hrs: number | null
  app_group_id: string | null
}

type AppGroup = {
  id: string
  group_number: number
  group_name: string
  category: string | null
  supplier_abbreviation: string | null
  total_planned_sessions: number
  total_planned_hours: number | null
}

type SupplierRow = {
  supplier_abbreviation: string
  supplier_colour: string
}

export default async function SessionsPage() {
  const [sessionsRes, appGroupsRes, leadRes, suppliersRes] = await Promise.all([
    supabase
      .from('tessera_kt_sessions')
      .select(
        'id, session_name, focus_area, track, status, planned_date, duration_hrs, app_group_id',
      )
      .order('planned_date', { ascending: true }),
    supabase
      .from('tessera_app_groups')
      .select(
        'id, group_number, group_name, category, supplier_abbreviation, total_planned_sessions, total_planned_hours',
      )
      .order('group_number'),
    supabase
      .from('tessera_kt_session_resources')
      .select('session_id, resources(resource_name)')
      .eq('role', 'LEAD'),
    supabase
      .from('suppliers')
      .select('supplier_abbreviation, supplier_colour')
      .order('sort_order'),
  ])

  const allSessions = (sessionsRes.data ?? []) as KtSession[]
  const appGroups = (appGroupsRes.data ?? []) as AppGroup[]
  const supplierMap: SupplierColourMap = buildSupplierMap(
    (suppliersRes.data ?? []) as SupplierRow[],
  )

  type LeadRow = {
    session_id: string
    resources: { resource_name: string } | { resource_name: string }[] | null
  }
  const leadMap: Record<string, string> = {}
  for (const row of (leadRes.data ?? []) as LeadRow[]) {
    const r = row.resources
    if (!r) continue
    const name = Array.isArray(r) ? r[0]?.resource_name : r.resource_name
    if (name) leadMap[row.session_id] = name
  }

  const totalSessions = allSessions.length
  const totalGroups = appGroups.length

  const clientSessions: ClientSession[] = allSessions.map((s) => ({
    id: s.id,
    session_name: s.session_name,
    focus_area: s.focus_area,
    track: s.track,
    status: s.status,
    planned_date: s.planned_date,
    duration_hrs: s.duration_hrs,
    app_group_id: s.app_group_id,
  }))

  const clientAppGroups: ClientAppGroup[] = appGroups.map((g) => ({
    id: g.id,
    group_number: g.group_number,
    group_name: g.group_name,
    category: g.category,
    supplier_abbreviation: g.supplier_abbreviation,
    total_planned_sessions: g.total_planned_sessions,
    total_planned_hours: g.total_planned_hours,
  }))

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
            maxWidth: 1280,
            margin: '0 auto',
            padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
          }}
        >
          {/* Page header */}
          <div style={{ marginBottom: 'var(--rmg-spacing-06)' }}>
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
              Sessions
            </h1>
            <p
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 14,
                color: 'var(--rmg-color-text-light)',
                margin: 0,
                marginTop: 'var(--rmg-spacing-02)',
              }}
            >
              {totalSessions} sessions planned across {totalGroups} application groups
            </p>
          </div>

          <SessionsClient
            sessions={clientSessions}
            appGroups={clientAppGroups}
            supplierMap={supplierMap}
            leadMap={leadMap}
          />
        </div>
      </div>
    </TesseraShell>
  )
}
