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
}

export default async function PeoplePage() {
  const { data: resourcesData, error: resourcesError } = await supabase
    .from('resources')
    .select(
      'resource_id, resource_salutation, resource_name, resource_job_title, resource_function, resource_location, resource_country, resource_years_experience, resource_experience_as_of, resource_primary_tech_stack, resource_secondary_tech_stack, suppliers(supplier_name, supplier_abbreviation, supplier_colour)',
    )
    .order('resource_name')

  if (resourcesError) {
    console.error('[PeoplePage] resources error:', resourcesError)
  }

  const resources = (resourcesData ?? []) as Resource[]

  // Step 1: get session IDs where each resource is a LEAD
  const { data: leadLinks } = await supabase
    .from('tessera_kt_session_resources')
    .select('resource_id, session_id')
    .eq('role', 'LEAD')

  // Step 2: get the session details for those IDs
  const sessionIds = [...new Set((leadLinks ?? []).map((l) => l.session_id))]

  const { data: sessionRows } = sessionIds.length > 0
    ? await supabase
        .from('tessera_kt_sessions')
        .select('id, session_name, focus_area, duration_hrs')
        .in('id', sessionIds)
    : { data: [] as SessionRef[] }

  // Step 3: build a map from resource_id -> session[]
  const sessionMap = new Map<string, SessionRef[]>()
  for (const link of leadLinks ?? []) {
    const session = (sessionRows ?? []).find((s) => s.id === link.session_id)
    if (session) {
      const existing = sessionMap.get(link.resource_id) ?? []
      sessionMap.set(link.resource_id, [...existing, session as SessionRef])
    }
  }

  return (
    <TesseraShell activeRoute="/people">
      <div
        style={{
          padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07) var(--rmg-spacing-07)',
        }}
      >
        <div style={{ marginBottom: 'var(--rmg-spacing-05)' }}>
          <h1
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h2)',
              lineHeight: 'var(--rmg-leading-h2)',
              color: 'var(--rmg-color-text-heading)',
              margin: 0,
            }}
          >
            People
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
            All resources across the eBusiness transition programme
          </p>
        </div>
        <PeopleClient
          resources={resources}
          leadSessionsByResource={Object.fromEntries(sessionMap)}
        />
      </div>
    </TesseraShell>
  )
}
