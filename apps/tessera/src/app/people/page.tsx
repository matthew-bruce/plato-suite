import { TesseraShell } from '@/components/TesseraShell'
import { supabase } from '@/lib/supabase'
import { PeopleClient } from '@/components/PeopleClient'

export const dynamic = 'force-dynamic'

export type SupplierInfo = {
  supplier_name: string
  supplier_abbreviation: string
  supplier_colour: string
}

export type Resource = {
  resource_id: string
  resource_salutation: string | null
  resource_name: string
  resource_job_title: string | null
  resource_function: string | null
  resource_location: string | null
  resource_country: string | null
  resource_years_experience: number | null
  resource_experience_as_of: string | null
  resource_primary_tech_stack: string | null
  resource_secondary_tech_stack: string | null
  suppliers: SupplierInfo | SupplierInfo[] | null
}

export type SessionRef = {
  id: string
  session_name: string
  focus_area: string | null
  duration_hrs: number | null
  track: 'A' | 'B' | null
  group_name: string | null
}

type DbSessionRow = {
  id: string
  session_name: string
  focus_area: string | null
  duration_hrs: number | null
  track: string | null
  tessera_app_groups: { group_name: string } | { group_name: string }[] | null
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ resource?: string }>
}) {
  const { resource: initialSelectedId = null } = await searchParams
  const [resourcesRes, suppliersRes] = await Promise.all([
    supabase
      .from('resources')
      .select(
        'resource_id, resource_salutation, resource_name, resource_job_title, resource_function, resource_location, resource_country, resource_years_experience, resource_experience_as_of, resource_primary_tech_stack, resource_secondary_tech_stack, suppliers(supplier_name, supplier_abbreviation, supplier_colour)',
      )
      .is('deleted_at', null)
      .order('resource_name'),
    supabase
      .from('suppliers')
      .select('supplier_abbreviation, supplier_colour, supplier_name')
      .order('sort_order'),
  ])

  if (resourcesRes.error) {
    console.error('[PeoplePage] resources error:', resourcesRes.error)
  }

  const resources = (resourcesRes.data ?? []) as Resource[]
  const suppliers = (suppliersRes.data ?? []) as SupplierInfo[]

  // Step 1: get session IDs where each resource is a LEAD
  const { data: leadLinks } = await supabase
    .from('tessera_kt_session_resources')
    .select('resource_id, session_id')
    .eq('role', 'LEAD')

  // Step 2: get session details for those IDs (with track + app group)
  const sessionIds = [...new Set((leadLinks ?? []).map((l) => l.session_id))]

  const { data: sessionRows } =
    sessionIds.length > 0
      ? await supabase
          .from('tessera_kt_sessions')
          .select(
            'id, session_name, focus_area, duration_hrs, track, tessera_app_groups(group_name)',
          )
          .in('id', sessionIds)
      : { data: [] as DbSessionRow[] }

  // Step 3: build a map from resource_id -> SessionRef[]
  const sessionMap = new Map<string, SessionRef[]>()
  for (const link of leadLinks ?? []) {
    const row = (sessionRows ?? []).find(
      (s) => (s as DbSessionRow).id === link.session_id,
    ) as DbSessionRow | undefined
    if (row) {
      const ag = row.tessera_app_groups
      const groupName = Array.isArray(ag)
        ? (ag[0]?.group_name ?? null)
        : (ag?.group_name ?? null)
      const session: SessionRef = {
        id: row.id,
        session_name: row.session_name,
        focus_area: row.focus_area,
        duration_hrs: row.duration_hrs,
        track: row.track === 'A' || row.track === 'B' ? row.track : null,
        group_name: groupName,
      }
      const existing = sessionMap.get(link.resource_id) ?? []
      sessionMap.set(link.resource_id, [...existing, session])
    }
  }

  return (
    <TesseraShell activeRoute="/people">
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
              People
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
              {resources.length} people across {suppliers.length} suppliers
            </p>
          </div>
          <PeopleClient
            resources={resources}
            leadSessionsByResource={Object.fromEntries(sessionMap)}
            suppliers={suppliers}
            initialSelectedId={initialSelectedId}
          />
        </div>
      </div>
    </TesseraShell>
  )
}
