import { TesseraShell } from '@plato/ui/components/tessera'
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

export type AppGroupRef = {
  group_number: number
  group_name: string
}

export type SessionRef = {
  id: string
  session_name: string
  focus_area: string | null
  tessera_app_groups: AppGroupRef | AppGroupRef[] | null
  duration_hrs: number | null
}

export type LeadRow = {
  resource_id: string
  tessera_kt_sessions: SessionRef | SessionRef[] | null
}

export default async function PeoplePage() {
  const [resourcesRes, leadRes] = await Promise.all([
    supabase
      .from('resources')
      .select(
        'resource_id, resource_salutation, resource_name, resource_job_title, resource_function, resource_location, resource_country, resource_years_experience, resource_experience_as_of, resource_primary_tech_stack, resource_secondary_tech_stack, suppliers(supplier_name, supplier_abbreviation, supplier_colour)',
      )
      .order('resource_name'),
    supabase
      .from('tessera_kt_session_resources')
      .select(
        'resource_id, tessera_kt_sessions(id, session_name, focus_area, tessera_app_groups(group_number, group_name), duration_hrs)',
      )
      .eq('role', 'LEAD'),
  ])

  const resources = (resourcesRes.data ?? []) as Resource[]
  const leadRows = (leadRes.data ?? []) as LeadRow[]

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
        <PeopleClient resources={resources} leadRows={leadRows} />
      </div>
    </TesseraShell>
  )
}
