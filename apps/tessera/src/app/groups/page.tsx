import { TesseraShell } from '@plato/ui/components/tessera'
import { supabase } from '@/lib/supabase'
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
  team: 'SERVICE' | 'SHARED'
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED'
  is_playback: boolean
  duration_hrs: number | null
  app_group_id: string | null
}

export default async function AppGroupsPage() {
  const [groupsRes, sessionsRes] = await Promise.all([
    supabase
      .from('tessera_app_groups')
      .select(
        `
          id,
          group_number,
          group_name,
          category,
          total_planned_sessions,
          total_planned_hours,
          tessera_app_group_resources (
            role,
            resources (
              resource_id,
              resource_name,
              suppliers ( supplier_abbreviation, supplier_colour )
            )
          )
        `,
      )
      .order('group_number'),
    supabase
      .from('tessera_kt_sessions')
      .select(
        'id, session_name, focus_area, team, status, is_playback, duration_hrs, app_group_id',
      )
      .order('sort_order'),
  ])

  const groups = (groupsRes.data ?? []) as Group[]
  const sessions = (sessionsRes.data ?? []) as KtSession[]

  if (groupsRes.error) {
    console.error('[GroupsPage] groups query error:', groupsRes.error)
  }
  if (sessionsRes.error) {
    console.error('[GroupsPage] sessions query error:', sessionsRes.error)
  }

  return (
    <TesseraShell activeRoute="/groups">
      <div style={{ padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)' }}>
        <div style={{ marginBottom: 'var(--rmg-spacing-06)' }}>
          <h1
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h2)',
              lineHeight: 'var(--rmg-leading-h2)',
              color: 'var(--rmg-color-text-heading)',
              margin: 0,
            }}
          >
            Application Groups
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
            13 groups · 125 sessions · 322 hrs planned · CG → TCS transition
          </p>
        </div>
        <AppGroupsClient groups={groups} sessions={sessions} />
      </div>
    </TesseraShell>
  )
}
