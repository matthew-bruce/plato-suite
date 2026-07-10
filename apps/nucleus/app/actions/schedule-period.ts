'use server'

import { getSupabaseServerClient } from '@plato/schema'

export interface CreatePeriodParams {
  periodName: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  /** Source period to copy the schedule forward from, or null for an empty draft. */
  copyFromPeriodId: string | null
}

export interface CreatePeriodResult {
  success: boolean
  periodId?: string
  error?: string
}

/**
 * Creates a fresh draft period, optionally copying a source period's schedule
 * forward. Both the period insert and the allocation/team duplication happen
 * atomically inside the create_period_with_optional_copy RPC (migration 023) —
 * never as separate unguarded client-side steps.
 */
export async function createPeriod(params: CreatePeriodParams): Promise<CreatePeriodResult> {
  const name = params.periodName.trim()
  if (!name) return { success: false, error: 'Period name is required' }
  if (!params.startDate || !params.endDate) {
    return { success: false, error: 'Start and end dates are required' }
  }
  if (params.endDate < params.startDate) {
    return { success: false, error: 'End date cannot be before the start date' }
  }

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase.rpc('create_period_with_optional_copy', {
    p_period_name: name,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_copy_from_period_id: params.copyFromPeriodId,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, periodId: data as string }
}

/** Live count of non-deleted allocations in a period, for the copy-forward
 *  summary. Reads the source of truth so the figure is right even when the
 *  wizard is opened from a different period than the one being copied. */
export async function getPeriodAllocationCount(periodId: string): Promise<number> {
  const supabase = getSupabaseServerClient()
  const { count, error } = await supabase
    .from('resource_period_allocations')
    .select('allocation_id', { count: 'exact', head: true })
    .eq('period_id', periodId)
    .is('deleted_at', null)
  if (error) return 0
  return count ?? 0
}
