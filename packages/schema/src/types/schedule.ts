// Schedule page types — Platform Schedule (Nucleus / Finance)
// Money fields are stored as integer pence per ADR-029.

export type PlanviewCode = 'PR' | 'F_Gov' | 'BAU' | 'ETP'
export type PeriodStatus = 'draft' | 'active' | 'closed'
export type ResourceLocation = 'onshore' | 'nearshore' | 'offshore'

export interface Period {
  period_id: string
  period_name: string
  period_start_date: string
  period_end_date: string
  period_status: PeriodStatus
}

export interface CostConfiguration {
  cost_configuration_id: string
  platform_id: string
  vat_uplift_percent: number
  on_costs_uplift_percent: number
  blended_day_rate_override: number | null
  effective_from: string
}

export interface ScheduleAllocation {
  allocation_id: string
  resource_name: string | null
  role_title: string | null
  supplier_name: string | null
  supplier_colour: string | null
  resource_location: ResourceLocation | null
  planview_code: PlanviewCode | null
  day_rate: number
  utilisation_percent: number
  capacity_days: number | null
  is_chargeable: boolean
  team_name: string | null
  base_total_pence?: number
  vat_total_pence?: number
}

export interface SchedulePageData {
  period: Period
  costConfig: CostConfiguration | null
  allocations: ScheduleAllocation[]
  allPeriods: Pick<Period, 'period_id' | 'period_name' | 'period_status'>[]
}
