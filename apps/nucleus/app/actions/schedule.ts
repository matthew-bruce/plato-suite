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
