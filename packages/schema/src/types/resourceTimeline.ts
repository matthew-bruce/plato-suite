// Resource Timeline view types (Nucleus / Finance).
//
// The page consumes fully-derived rows: every date here is a real rendering
// boundary produced by lib/resource-timeline/deriveSegments.ts, not a raw DB
// value. That split is deliberate — it keeps the derivation testable and lets
// the standalone HTML export serialise the same post-computation dataset the
// live page renders.

import type { CoverageGap } from '../lib/resource-timeline/deriveSegments'
import type {
  IsoDate,
  TimelineSegment,
  TransitionCategory,
  TransitionStatus,
} from '../lib/resource-timeline/types'

export type { CoverageGap, IsoDate, TimelineSegment, TransitionCategory, TransitionStatus }

export interface TimelineTeam {
  teamName: string
  /** 0–1. Rendered as "Pulsar · 50%" when a person is split across teams. */
  capacitySplit: number
}

export interface TimelineSupplier {
  abbreviation: string
  name: string
  colour: string
  sortOrder: number
}

export interface TimelineResource {
  resourceId: string
  name: string
  initials: string
  /** Role taxonomy — "Skillset" in the UI. Null where none is recorded. */
  discipline: string | null
  teams: TimelineTeam[]
  status: TransitionStatus
  category: TransitionCategory
  categoryLabel: string
  segments: TimelineSegment[]
  gaps: CoverageGap[]
  /** Transition record fields kept for the tooltip. Never used for geometry. */
  joiningDate: IsoDate | null
  notes: string | null
}

export interface ResourceTimelineData {
  /** Full render window — the coarse period start through the granular end. */
  windowStart: IsoDate
  windowEnd: IsoDate
  /** Month columns spanning the window, as YYYY-MM-01. */
  months: IsoDate[]
  resources: TimelineResource[]
  suppliers: TimelineSupplier[]
  teams: string[]
  disciplines: string[]
  coarsePeriodName: string
  granularPeriodName: string
  /**
   * First month (YYYY-MM-01) of the granular period. Splits `months` into
   * the coarse-quarter group and the granular-quarter group for the
   * timeline header's quarter row — kept as a real boundary rather than
   * assuming an even split, so it stays correct if the two periods are ever
   * different lengths.
   */
  granularWindowStart: IsoDate
}
