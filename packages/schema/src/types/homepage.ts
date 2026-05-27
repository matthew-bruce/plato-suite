import type { PeriodStatus } from './schedule'

export interface PeriodSummary {
  period_id: string
  period_name: string
  period_start_date: string
  period_end_date: string
  period_status: PeriodStatus
  headcount: number
  base_cost_pence: number
  vat_cost_pence: number
  chargeable_cost_pence: number
}

export interface AttentionItem {
  type: 'missing_planview' | 'missing_capacity' | 'draft_period'
  label: string
  count: number
  href: string
}

export interface HomepageData {
  periods: Array<{ period_id: string; period_name: string; period_status: PeriodStatus }>
  activePeriod: PeriodSummary | null
  attentionItems: AttentionItem[]
}
