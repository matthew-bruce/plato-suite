'use server'

import {
  getResourceAllocationHistory,
  getResourceCommercialSnapshot,
} from '@plato/schema/server'
import type { AllocationHistoryRow, CommercialSnapshot } from '@plato/schema'

/**
 * Allocation history for the People Directory detail panel. Reads the
 * non-sensitive resource_allocation_history view — never day_rate or
 * utilisation_percent.
 */
export async function fetchResourceAllocationHistory(resourceId: string): Promise<AllocationHistoryRow[]> {
  return getResourceAllocationHistory(resourceId)
}

/**
 * Commercial snapshot (current-period role_title + day_rate) for the
 * Commercial section. Gated server-side by plato_is_superuser() inside
 * getResourceCommercialSnapshot — a non-superuser's client never receives
 * day_rate at all; `authorized: false` is the only thing that comes back.
 */
export async function fetchResourceCommercialSnapshot(resourceId: string): Promise<CommercialSnapshot> {
  return getResourceCommercialSnapshot(resourceId)
}
