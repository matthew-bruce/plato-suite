// Types for the Resource Timeline view's derivation layer.
//
// The inputs here are deliberately plain data, not Supabase row shapes: the
// derivation is a pure function of "what the DB says" and is unit-tested
// without a database. queries/resourceTimeline.ts maps rows onto these.

import type { IsoDate, MonthStart } from './workingDays'

export type { IsoDate, MonthStart }

/**
 * Planview code as it affects rendering. Everything that is not hypercare
 * collapses to 'REG' — the timeline cares only whether a segment is
 * non-productive cover (NPC), because that flips the anchoring rule.
 */
export type SegmentCode = 'REG' | 'NPC'

/** Raw transition record. Mirrors resource_supplier_transitions. */
export interface TransitionRecord {
  fromSupplier: string | null
  toSupplier: string | null
  lastWorkingDay: IsoDate | null
  /**
   * Date of joining. Present for the record only — the derivation never reads
   * it for geometry. See the column comment in migration 033.
   */
  joiningDate: IsoDate | null
  commercialStart: IsoDate | null
  status: string
  notes: string | null
}

/** One (supplier, code) allocation within one period. */
export interface AllocationInput {
  supplier: string
  code: SegmentCode
  /**
   * Per-month day counts keyed YYYY-MM-01. Empty for Q2, which carries no
   * month-level granularity at all.
   */
  monthlyDays: Record<MonthStart, number>
}

export interface PeriodWindow {
  start: IsoDate
  end: IsoDate
}

/** One resource_team_assignments row, already filtered to deleted_at IS NULL. */
export interface TeamAssignmentInput {
  resourceId: string
  periodId: string
  teamName: string
  capacitySplit: number
}

/** A resource's resolved team, as resolveTeamsByResource() produces it. */
export interface TeamOutput {
  teamName: string
  capacitySplit: number
}

export interface DeriveSegmentsInput {
  transition: TransitionRecord | null
  /** Allocations in the coarse period (Q2) — rendered as flat whole-quarter blocks. */
  coarseAllocations: readonly AllocationInput[]
  /** Allocations in the month-granular period (Q3). */
  granularAllocations: readonly AllocationInput[]
  coarseWindow: PeriodWindow
  granularWindow: PeriodWindow
  bankHolidays: readonly IsoDate[]
}

export interface TimelineSegment {
  supplier: string
  code: SegmentCode
  start: IsoDate
  end: IsoDate
  /**
   * Whether the boundary is a real known fact (a last working day, a derived
   * commercial start, a hypercare end) rather than the artificial edge of the
   * view's window. Only real boundaries get a date printed in the bar label —
   * showing "from 1 Jul" would imply a start that isn't one.
   */
  realStart: boolean
  realEnd: boolean
  /** Dashed treatment — the segment's date is agreed in principle, not fixed. */
  tentative: boolean
  /** Free-text warning surfaced in the tooltip and as a flag dot. */
  flag: string | null
  /**
   * Set when resource_supplier_transitions.commercial_start disagrees with the
   * date derived from monthly days. The derived value still wins (monthly days
   * are the primary source per the algorithm); this exists so a divergence
   * surfaces as a data-quality signal instead of being silently resolved.
   */
  commercialStartMismatch: IsoDate | null
}

/** How a resource relates to the Dudley transition. Drives the status tag. */
export type TransitionStatus =
  | 'mover'
  | 'mover_doj_tbc'
  | 'joiner'
  | 'rolledoff'
  | 'rolledoff_hypercare'
  | 'overlap_risk'
  | 'incumbent'

export type TransitionCategory =
  | 'transitioned'
  | 'signed_tbc'
  | 'established'
  | 'rolloff_hypercare'
  | 'not_moving'
  | null

export interface TransitionClassification {
  status: TransitionStatus
  category: TransitionCategory
  categoryLabel: string
}
