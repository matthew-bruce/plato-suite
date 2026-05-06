import { TesseraShell } from '@/components/TesseraShell'
import { supabase } from '@/lib/supabase'
import { buildSupplierMap } from '@plato/ui/tokens'
import { SessionsClient } from '@/components/SessionsClient'

export const dynamic = 'force-dynamic'

// ── Exported types (consumed by SessionsClient) ───────────────────────────────

export type AppGroup = {
  id: string
  group_number: number
  group_name: string
  category: string | null
  is_active: boolean
  sort_order: number
}

export type KtSession = {
  id: string
  session_name: string
  app_group_id: string | null
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED' | 'IN_PROGRESS'
  planned_date: string | null
  duration_hrs: number | null
  outcome_score: number | null
  was_rescheduled: boolean
  cancellation_reason: string | null
  is_playback: boolean
  track: 'A' | 'B' | null
  sort_order: number | null
}

export type SessionLead = {
  session_id: string
  resource_name: string
  resource_id: string | null
  supplier_abbreviation: string | null
  supplier_colour: string | null
}

// ── Raw DB shapes ─────────────────────────────────────────────────────────────

type DbSession = {
  id: string
  session_name: string
  app_group_id: string | null
  status: string
  planned_date: string | null
  duration_hrs: number | null
  outcome_score: number | null
  was_rescheduled: boolean | null
  cancellation_reason: string | null
  is_playback: boolean | null
  track: string | null
  sort_order: number | null
}

type DbLeadRow = {
  session_id: string
  resources:
    | { resource_id: string; resource_name: string; suppliers: { supplier_abbreviation: string; supplier_colour: string } | null }
    | { resource_id: string; resource_name: string; suppliers: { supplier_abbreviation: string; supplier_colour: string } | null }[]
    | null
}

export default async function SessionsPage() {
  const [groupsRes, sessionsRes, leadsRes, suppliersRes] = await Promise.all([
    supabase
      .from('tessera_app_groups')
      .select('id, group_number, group_name, category, is_active, sort_order')
      .order('sort_order'),
    supabase
      .from('tessera_kt_sessions')
      .select(
        'id, session_name, app_group_id, status, planned_date, duration_hrs, outcome_score, was_rescheduled, cancellation_reason, is_playback, track, sort_order',
      )
      .order('sort_order'),
    supabase
      .from('tessera_kt_session_resources')
      .select(
        'session_id, resources(resource_id, resource_name, suppliers(supplier_abbreviation, supplier_colour))',
      )
      .eq('role', 'LEAD'),
    supabase
      .from('suppliers')
      .select('supplier_abbreviation, supplier_colour')
      .order('sort_order'),
  ])

  if (groupsRes.error) console.error('[SessionsPage] groups error:', groupsRes.error)
  if (sessionsRes.error) console.error('[SessionsPage] sessions error:', sessionsRes.error)

  const groups = (groupsRes.data ?? []) as AppGroup[]

  const sessions: KtSession[] = ((sessionsRes.data ?? []) as DbSession[]).map((s) => ({
    id: s.id,
    session_name: s.session_name,
    app_group_id: s.app_group_id,
    status: s.status as KtSession['status'],
    planned_date: s.planned_date,
    duration_hrs: s.duration_hrs,
    outcome_score: s.outcome_score,
    was_rescheduled: s.was_rescheduled ?? false,
    cancellation_reason: s.cancellation_reason,
    is_playback: s.is_playback ?? false,
    track: s.track === 'A' || s.track === 'B' ? s.track : null,
    sort_order: s.sort_order,
  }))

  const supplierMap = buildSupplierMap(
    (suppliersRes.data ?? []) as { supplier_abbreviation: string; supplier_colour: string }[],
  )

  const sessionLeads: SessionLead[] = []
  for (const row of (leadsRes.data ?? []) as DbLeadRow[]) {
    const r = Array.isArray(row.resources) ? row.resources[0] : row.resources
    if (!r) continue
    const sup = Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers
    sessionLeads.push({
      session_id: row.session_id,
      resource_id: r.resource_id,
      resource_name: r.resource_name,
      supplier_abbreviation: sup?.supplier_abbreviation ?? null,
      supplier_colour: sup?.supplier_colour ?? null,
    })
  }

  // Header metrics — exclude CANCELLED
  const activeSessions = sessions.filter((s) => s.status !== 'CANCELLED')
  const rawHours = activeSessions.reduce((sum, s) => sum + (Number(s.duration_hrs) || 0), 0)
  const totalHours: string | number = Number.isInteger(rawHours) ? rawHours : rawHours.toFixed(1)

  return (
    <TesseraShell activeRoute="/sessions">
      <div
        style={{
          backgroundColor: 'var(--rmg-color-surface-light)',
          minHeight: '100vh',
        }}
      >
        <SessionsClient
          groups={groups}
          sessions={sessions}
          sessionLeads={sessionLeads}
          supplierMap={supplierMap}
          metricGroups={groups.length}
          metricSessions={activeSessions.length}
          metricHours={totalHours}
        />
      </div>
    </TesseraShell>
  )
}
