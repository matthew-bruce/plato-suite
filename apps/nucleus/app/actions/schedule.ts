'use server'

import { getSupabaseServerComponentClient } from '@plato/schema/server'
import type { ResourceLocation } from '@plato/schema'

/**
 * Toggle the `locked` flag on a period. Locking makes the Platform Schedule
 * read-only; unlocking re-enables editing. Returns the new locked state.
 *
 * Routed through the set_period_locked RPC so that a false→true transition
 * atomically captures a period_cost_snapshots row (the resolved rate/VAT/
 * on-costs at that instant) BEFORE the flag flips — freezing the period's cost
 * figures against any later rate-table edits. The RPC is SECURITY DEFINER; the
 * open/locked semantics are unchanged from before.
 */
export async function togglePeriodLocked(
  periodId: string,
  locked: boolean,
): Promise<{ locked: boolean }> {
  const supabase = await getSupabaseServerComponentClient()
  const { data, error } = await supabase.rpc('set_period_locked', {
    p_period_id: periodId,
    p_locked: locked,
  })

  if (error) throw new Error(`Failed to update period lock: ${error.message}`)
  return { locked: (data as boolean | null) ?? locked }
}

/**
 * Assign a resource to a TBC allocation row. Sets resource_id (and optionally
 * resource_location) and re-keys the vacant seat's team assignments onto the
 * resource. Routed through the assign_resource_to_vacant_allocation RPC
 * (migration 028) so both writes commit or roll back together — a failed
 * re-key can no longer leave the allocation named while its team assignment
 * row stays stranded on the vacant seat (the exact bug found in the
 * 2026-07-23 investigation; see
 * docs/investigations/2026-07-23-assignResource-silent-failure-challenge.md).
 * Returns { success: false } if the allocation does not exist or if either
 * write fails — no error is swallowed.
 */
export async function assignResourceToAllocation(
  allocationId: string,
  resourceId: string,
  resourceLocation?: ResourceLocation,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerComponentClient()

  const { error } = await supabase.rpc('assign_resource_to_vacant_allocation', {
    p_allocation_id: allocationId,
    p_resource_id: resourceId,
    p_resource_location: resourceLocation ?? null,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Remove a resource assignment, reverting the row to TBC. Sets resource_id to
 * NULL and updated_at. Returns { success: false } if the allocation does not exist.
 */
export async function unassignResourceFromAllocation(
  allocationId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerComponentClient()

  const { data: existing, error: fetchErr } = await supabase
    .from('resource_period_allocations')
    .select('resource_id, period_id')
    .eq('allocation_id', allocationId)
    .maybeSingle()

  if (fetchErr) return { success: false, error: fetchErr.message }
  if (!existing) return { success: false, error: 'Allocation not found' }

  const previousResourceId = (existing as { resource_id: string | null }).resource_id
  const periodId = (existing as { period_id: string }).period_id

  const { data, error } = await supabase
    .from('resource_period_allocations')
    .update({ resource_id: null, updated_at: new Date().toISOString() })
    .eq('allocation_id', allocationId)
    .select('allocation_id')

  if (error) return { success: false, error: error.message }
  if (!data || (data as unknown[]).length === 0) return { success: false, error: 'Allocation not found' }

  // Carry forward any team assignments the resource had while named: rekey
  // them from resource_id to the now-TBC allocation_id, symmetric with the
  // migration in assignResourceToAllocation. Non-fatal.
  if (previousResourceId) {
    const { error: migrateErr } = await supabase
      .from('resource_team_assignments')
      .update({ allocation_id: allocationId, resource_id: null })
      .eq('resource_id', previousResourceId)
      .eq('period_id', periodId)
      .is('deleted_at', null)

    if (migrateErr) {
      console.error('Failed to migrate team assignments to TBC:', migrateErr.message)
    }
  }

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

  const supabase = await getSupabaseServerComponentClient()

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

/**
 * Write part of an allocation's monthly day breakdown and re-sync its
 * capacity_days total in the same transaction.
 *
 * Routed through the set_allocation_monthly_days RPC (migration 029) rather
 * than an upsert followed by a separate capacity_days update: capacity_days is
 * what every cost figure on the page reads, so a half-applied write would
 * leave the authoritative total disagreeing with the breakdown it is supposed
 * to be the sum of.
 *
 * `months` and `days` are parallel arrays. A null in `days` clears that month
 * (deleting its row), which is how blanking a single month input is expressed.
 * Passing every month at once is how the "Populate working days" button lands
 * a whole quarter in one round trip. Returns the recomputed capacity_days.
 */
export async function setAllocationMonthlyDays(
  allocationId: string,
  months: string[],
  days: (number | null)[],
): Promise<{ success: boolean; capacityDays?: number; error?: string }> {
  if (months.length !== days.length) {
    return { success: false, error: 'months and days must be the same length' }
  }
  if (months.length === 0) {
    return { success: false, error: 'No months provided' }
  }

  const supabase = await getSupabaseServerComponentClient()

  const { data, error } = await supabase.rpc('set_allocation_monthly_days', {
    p_allocation_id: allocationId,
    p_months: months,
    p_days: days,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, capacityDays: Number(data ?? 0) }
}

/**
 * Drop an allocation's whole monthly breakdown, returning its total to direct
 * manual entry. capacity_days is deliberately left untouched by the RPC, so
 * the figure already on screen stays put and simply becomes editable again.
 */
export async function clearAllocationMonthlyDays(
  allocationId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerComponentClient()

  const { error } = await supabase.rpc('clear_allocation_monthly_days', {
    p_allocation_id: allocationId,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}
