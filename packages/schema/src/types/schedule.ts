// Schedule page types — Platform Schedule (Nucleus / Finance)
// Money fields are stored as integer pence per ADR-029.

// 'NPC' (non-productive cover / hypercare) has always been permitted by the
// resource_period_allocations_planview_code_check constraint; it was missing
// here, so Q3 hypercare allocations typed as an invalid code.
export type PlanviewCode = 'PR' | 'F_Gov' | 'BAU' | 'ETP' | 'NPC'
export type PeriodStatus = 'draft' | 'active' | 'historic'
export type ResourceLocation = 'onshore' | 'nearshore' | 'offshore'

export interface Period {
  period_id: string
  period_name: string
  period_start_date: string
  period_end_date: string
  period_status: PeriodStatus
  locked: boolean
}

export interface CostConfiguration {
  cost_configuration_id: string
  platform_id: string
  vat_uplift_percent: number
  on_costs_uplift_percent: number
  blended_day_rate_override: number | null
  effective_from: string
}

export interface TeamAssignment {
  teamId: string
  teamName: string
  capacitySplit: number
}

export interface ScheduleAllocation {
  allocation_id: string
  resource_id: string | null
  resource_name: string | null
  role_title: string | null
  supplier_id: string | null
  supplier_name: string | null
  supplier_colour: string | null
  supplier_sort_order: number | null
  resource_location: ResourceLocation | null
  planview_code: PlanviewCode | null
  day_rate: number
  utilisation_percent: number
  capacity_days: number | null
  is_chargeable: boolean
  vat_applies: boolean
  is_confirmed: boolean
  /** Optional per-calendar-month breakdown of capacity_days, keyed by the
   *  month's first day (YYYY-MM-01). Empty when the allocation's total is
   *  entered directly. When non-empty, capacity_days is kept equal to the
   *  sum of these values — see migration 029. */
  monthly_days: Record<string, number>
  teams: TeamAssignment[]
  /** Missing capacity, as a whole percentage (e.g. 50 for a 50% split with no
   *  second team). Undefined/null when fully allocated or when there are no
   *  team assignments at all (zero is a valid, intentional state). */
  unallocatedPct?: number | null
  base_total_pence?: number
  vat_total_pence?: number
  display_order: number | null
}

export interface SchedulePageData {
  period: Period
  costConfig: CostConfiguration | null
  allocations: ScheduleAllocation[]
  allPeriods: Pick<Period, 'period_id' | 'period_name' | 'period_status' | 'period_start_date' | 'period_end_date'>[]
  costItems: PlatformCostItem[]
  /** England-and-Wales bank holiday dates (YYYY-MM-DD) covering the calendar
   *  years this period spans. Drives the "Populate working days" button; an
   *  empty year means that year has no seeded data and the button is disabled
   *  rather than silently producing an unadjusted figure. */
  bankHolidays: string[]
}

export type PlatformCostItem = {
  cost_item_id: string
  label: string
  amount_pence: number
  vat_applies: boolean
  sort_order: number
  notes: string | null
  cost_item_category: string
  is_confirmed: boolean
}
