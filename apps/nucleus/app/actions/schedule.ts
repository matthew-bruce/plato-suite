'use server'

import { getSupabaseServerClient } from '@plato/schema'

/**
 * Toggle the `locked` flag on a period. Locking makes the Platform Schedule
 * read-only; unlocking re-enables editing. Returns the new locked state.
 */
export async function togglePeriodLocked(
  periodId: string,
  locked: boolean,
): Promise<{ locked: boolean }> {
  const supabase = getSupabaseServerClient()
  const { error } = await supabase
    .from('periods')
    .update({ locked })
    .eq('period_id', periodId)
    .is('deleted_at', null)

  if (error) throw new Error(`Failed to update period lock: ${error.message}`)
  return { locked }
}

/**
 * Assign a resource to a TBC allocation row. Sets resource_id and updated_at.
 * Returns { success: false } if the allocation does not exist.
 */
export async function assignResourceToAllocation(
  allocationId: string,
  resourceId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServerClient()

  const { data, error } = await supabase
    .from('resource_period_allocations')
    .update({ resource_id: resourceId, updated_at: new Date().toISOString() })
    .eq('allocation_id', allocationId)
    .select('allocation_id')

  if (error) return { success: false, error: error.message }
  if (!data || (data as unknown[]).length === 0) return { success: false, error: 'Allocation not found' }
  return { success: true }
}

/**
 * Remove a resource assignment, reverting the row to TBC. Sets resource_id to
 * NULL and updated_at. Returns { success: false } if the allocation does not exist.
 */
export async function unassignResourceFromAllocation(
  allocationId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServerClient()

  const { data, error } = await supabase
    .from('resource_period_allocations')
    .update({ resource_id: null, updated_at: new Date().toISOString() })
    .eq('allocation_id', allocationId)
    .select('allocation_id')

  if (error) return { success: false, error: error.message }
  if (!data || (data as unknown[]).length === 0) return { success: false, error: 'Allocation not found' }
  return { success: true }
}

/**
 * Persist a new manual ordering for a set of allocations. Each entry maps an
 * allocation to its new `display_order` within its supplier group. Used by the
 * Platform Schedule drag-and-drop reordering. Returns `{ success: true }` on
 * success, or `{ success: false, error }` if validation or any write fails.
 */
export async function batchUpdateDisplayOrder(
  updates: Array<{ allocationId: string; displayOrder: number }>,
): Promise<{ success: boolean; error?: string }> {
  if (!Array.isArray(updates) || updates.length === 0) {
    return { success: false, error: 'No updates provided' }
  }

  const supabase = getSupabaseServerClient()

  try {
    for (const { allocationId, displayOrder } of updates) {
      const { error } = await supabase
        .from('resource_period_allocations')
        .update({ display_order: displayOrder, updated_at: new Date().toISOString() })
        .eq('allocation_id', allocationId)

      if (error) throw new Error(error.message)
    }
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update display order'
    return { success: false, error: message }
  }
}
