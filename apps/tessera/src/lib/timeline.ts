import { supabase } from '@/lib/supabase'

export interface TimelineResource {
  resource_id: string
  resource_name: string
  resource_job_title: string | null
  resource_function: string | null
  resource_onboarded_date: string | null
  resource_rolloff_date: string | null
  resource_location: string | null
  supplier_abbreviation: string
  supplier_colour: string
  supplier_sort: number
}

const EXCLUDE_NAMES    = new Set(['Robert Parker', 'Sean Hall', 'Rajat Jain'])
const EXCLUDE_SUPPLIERS = new Set(['EPAM', 'TAAS', 'LT'])

export async function getTimelineResources(): Promise<TimelineResource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select(`
      resource_id,
      resource_name,
      resource_job_title,
      resource_function,
      resource_onboarded_date,
      resource_rolloff_date,
      resource_location,
      suppliers!inner (
        supplier_abbreviation,
        supplier_colour,
        sort_order
      )
    `)
    .is('deleted_at', null)
    .or('resource_function.eq.FACTORY,resource_function.is.null')
    .order('resource_name')

  if (error || !data) {
    if (error) console.error('[timeline] query error:', error)
    return []
  }

  return (data as any[])
    .filter((r) => {
      const s = Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers
      const abbr: string = s?.supplier_abbreviation ?? ''
      return !EXCLUDE_NAMES.has(r.resource_name) && !EXCLUDE_SUPPLIERS.has(abbr)
    })
    .map((r) => {
      const s = Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers
      return {
        resource_id:          r.resource_id,
        resource_name:        r.resource_name,
        resource_job_title:   r.resource_job_title ?? null,
        resource_function:    r.resource_function ?? null,
        resource_onboarded_date: r.resource_onboarded_date ?? null,
        resource_rolloff_date:   r.resource_rolloff_date ?? null,
        resource_location:    r.resource_location ?? null,
        supplier_abbreviation: s?.supplier_abbreviation ?? '',
        supplier_colour:       s?.supplier_colour ?? '#999999',
        supplier_sort:         s?.sort_order ?? 99,
      }
    })
}
