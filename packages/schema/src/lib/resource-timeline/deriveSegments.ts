// Segment derivation for the Resource Timeline view.
//
// This is the business logic the whole view rests on, so it lives here as
// pure functions rather than inside a React component: it is the part most
// likely to be wrong, and the only part that can be tested properly.
//
// The rules, in the order they are applied:
//
//  1. The coarse period (Q2 FY26/27) has NO month-level granularity in
//     resource_period_allocation_monthly_days. It is always one flat
//     whole-quarter block, clipped only if a last working day lands inside it.
//  2. The granular period (Q3) is driven by monthly days. Each contiguous run
//     of months with days > 0 becomes one segment. An allocation that exists
//     in Q3 but has NO monthly rows at all falls back to the same flat
//     whole-quarter block Q2 always uses — "no monthly breakdown" means the
//     allocation was never entered month-by-month, not that the resource has
//     no Q3 presence. Do not drop the segment.
//  3. Noise threshold: a month short by fewer than NOISE_THRESHOLD_DAYS days
//     counts as full. TCS teams report ±1 day of regional calendar variance
//     and that is not a real partial start or end.
//  4. NPC (hypercare) segments are END-anchored; everything else is
//     START-anchored. Hypercare is a wind-down — its days sit at the start of
//     the month and the question is when it stops. A joiner's days sit at the
//     end and the question is when they begin.
//  5. Hard cap: no CG segment may run past the last working day of October
//     2026. Contractual fact, applied even when the data says otherwise.
//  6. joining_date NEVER sets geometry. Not as a start, not as an end, not as
//     a marker. Commercial presence is the only thing that moves a bar.

import {
  type IsoDate,
  type MonthStart,
  addDays,
  clampIso,
  firstWorkingDayOfMonth,
  isWeekend,
  fullMonthWorkingDays,
  lastWorkingDayOfMonth,
  maxIso,
  minIso,
  monthStartOf,
  nthWorkingDay,
} from './workingDays'
import type {
  AllocationInput,
  DeriveSegmentsInput,
  TimelineSegment,
  TransitionClassification,
  TransitionRecord,
} from './types'

/**
 * A month short by fewer than this many days is treated as full. Two is the
 * validated value: exactly 1 missing day is calendar noise between TCS teams,
 * exactly 2 is a real partial month.
 */
export const NOISE_THRESHOLD_DAYS = 2

/**
 * No Capgemini segment may extend beyond this date. October 2026's last
 * working day — 31 October is a Saturday, so several records carrying
 * "2026-10-31" as a last working day mean this in practice.
 */
export const CG_HARD_CAP = '2026-10-30'

export const CG_SUPPLIER = 'CG'

/** Sort key for a YYYY-MM-01 month string. Lexicographic order is chronological. */
function sortedMonths(monthlyDays: Record<MonthStart, number>): MonthStart[] {
  return Object.keys(monthlyDays).sort()
}

/**
 * Collapse allocations that render identically into one.
 *
 * A resource can hold several allocations against the same supplier in one
 * period — typically one PR and one F_Gov line — and every planview code
 * except NPC collapses to 'REG' here. Left alone they stack into two or three
 * pixel-identical bars on top of each other, which reads as a rendering
 * artefact and makes the tooltip pick an arbitrary one. Days are summed so a
 * genuinely split allocation still totals correctly.
 */
function mergeAllocations(allocations: readonly AllocationInput[]): AllocationInput[] {
  const merged = new Map<string, AllocationInput>()

  for (const alloc of allocations) {
    const key = `${alloc.supplier}::${alloc.code}`
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, { ...alloc, monthlyDays: { ...alloc.monthlyDays } })
      continue
    }
    for (const [month, days] of Object.entries(alloc.monthlyDays)) {
      existing.monthlyDays[month] = (existing.monthlyDays[month] ?? 0) + days
    }
  }
  return [...merged.values()]
}

/**
 * Split a month map into contiguous runs of months carrying days > 0.
 * "Contiguous" means adjacent in the month list, so a zero month breaks the
 * run — which is exactly how a November start after an empty October reads.
 */
function contiguousRuns(monthlyDays: Record<MonthStart, number>): MonthStart[][] {
  const runs: MonthStart[][] = []
  let current: MonthStart[] = []

  for (const month of sortedMonths(monthlyDays)) {
    if ((monthlyDays[month] ?? 0) > 0) {
      current.push(month)
    } else if (current.length > 0) {
      runs.push(current)
      current = []
    }
  }
  if (current.length > 0) runs.push(current)
  return runs
}

/**
 * Days missing from a month, after the noise threshold. Returns 0 for a month
 * that is full or only trivially short, so callers can treat "0 missing" as
 * "starts/ends at the month boundary" without repeating the threshold check.
 */
function missingDays(
  month: MonthStart,
  actualDays: number,
  bankHolidays: readonly IsoDate[],
): number {
  const full = fullMonthWorkingDays(month, bankHolidays)
  const missing = full - actualDays
  return missing < NOISE_THRESHOLD_DAYS ? 0 : missing
}

/** Apply the CG October cap. Clips; never extends. */
function applyCgCap(supplier: string, end: IsoDate): IsoDate {
  if (supplier !== CG_SUPPLIER) return end
  return minIso(end, CG_HARD_CAP)
}

/* ── Coarse period (Q2): flat whole-quarter blocks ─────────────────── */

function deriveCoarseSegments(
  allocations: readonly AllocationInput[],
  window: { start: IsoDate; end: IsoDate },
  transition: TransitionRecord | null,
): TimelineSegment[] {
  const lwd = transition?.lastWorkingDay ?? null

  return allocations.map((alloc): TimelineSegment => {
    // Clip to the last working day only when it actually falls inside this
    // window — a later LWD belongs to a subsequent period's segment, and an
    // earlier one predates the view entirely.
    const clipsHere = lwd !== null && lwd >= window.start && lwd <= window.end
    const end = applyCgCap(alloc.supplier, clipsHere ? lwd : window.end)

    return {
      supplier: alloc.supplier,
      code: alloc.code,
      start: window.start,
      end,
      // The window's opening edge is arbitrary — this view happens to begin at
      // 1 Jul, which is not a start date for anybody.
      realStart: false,
      realEnd: true,
      tentative: false,
      flag: null,
      commercialStartMismatch: null,
    }
  })
}

/* ── Granular period (Q3): monthly-days driven ─────────────────────── */

function deriveGranularSegments(
  allocations: readonly AllocationInput[],
  window: { start: IsoDate; end: IsoDate },
  transition: TransitionRecord | null,
  bankHolidays: readonly IsoDate[],
): TimelineSegment[] {
  const segments: TimelineSegment[] = []
  const isTentative = transition?.status === 'signed_doj_tbc'

  for (const alloc of allocations) {
    // No monthly rows at all for this allocation — not the same thing as
    // "no Q3 presence". It means the allocation was never broken down
    // month-by-month, so fall back to the same flat whole-quarter block Q2
    // always renders, rather than silently dropping the segment. This is
    // deliberately keyed on the monthlyDays map being empty (zero DB rows),
    // not on every value being zero: an allocation legitimately booked at
    // 0 days for a specific month (e.g. a joiner with an explicit October
    // row of 0) still has real rows and takes the month-accurate path below.
    if (Object.keys(alloc.monthlyDays).length === 0) {
      const isHypercare = alloc.code === 'NPC'
      const lwd = transition?.lastWorkingDay ?? null
      const clipsHere = lwd !== null && lwd >= window.start && lwd <= window.end
      const end = applyCgCap(alloc.supplier, clipsHere ? lwd : window.end)
      const isToSupplier = alloc.supplier === transition?.toSupplier

      segments.push({
        supplier: alloc.supplier,
        code: alloc.code,
        start: window.start,
        end,
        // Same as Q2's coarse block: the window's own edges aren't real
        // boundaries for anybody, only a last-working-day clip is.
        realStart: false,
        realEnd: true,
        tentative: isTentative && !isHypercare && isToSupplier,
        flag: isTentative && !isHypercare && isToSupplier ? (transition?.notes ?? null) : null,
        commercialStartMismatch: null,
      })
      continue
    }

    for (const run of contiguousRuns(alloc.monthlyDays)) {
      const firstMonth = run[0]!
      const lastMonth = run[run.length - 1]!
      const isHypercare = alloc.code === 'NPC'

      let start: IsoDate
      let end: IsoDate
      let realStart: boolean
      let realEnd: boolean

      if (isHypercare) {
        // END-anchored: hypercare runs from the start of the period and the
        // only real question is when it stops.
        start = firstWorkingDayOfMonth(firstMonth, bankHolidays)
        const missing = missingDays(lastMonth, alloc.monthlyDays[lastMonth] ?? 0, bankHolidays)
        end =
          missing > 0
            ? nthWorkingDay(lastMonth, (alloc.monthlyDays[lastMonth] ?? 0) - 1, bankHolidays)
            : lastWorkingDayOfMonth(lastMonth, bankHolidays)
        realStart = true
        realEnd = true
      } else {
        // START-anchored: a partial first month means the person joined
        // part-way through it, so the days sit at the END of that month.
        const missing = missingDays(firstMonth, alloc.monthlyDays[firstMonth] ?? 0, bankHolidays)
        start =
          missing > 0
            ? nthWorkingDay(firstMonth, missing, bankHolidays)
            : firstWorkingDayOfMonth(firstMonth, bankHolidays)
        // Ongoing unless the run genuinely stops before the window does.
        const runEndsEarly = lastMonth < monthStartOf(window.end)
        end = runEndsEarly ? lastWorkingDayOfMonth(lastMonth, bankHolidays) : window.end
        realStart = true
        realEnd = runEndsEarly
      }

      const cappedEnd = applyCgCap(alloc.supplier, end)
      // A cap that actually bit turns the window edge into a real boundary.
      const cappedRealEnd = realEnd || cappedEnd !== end

      // commercial_start is the agreed/reconciled value; monthly days are the
      // primary source. Record a divergence rather than silently picking one.
      const declared = transition?.commercialStart ?? null
      const mismatch =
        !isHypercare && declared !== null && declared !== start && alloc.supplier === transition?.toSupplier
          ? declared
          : null

      segments.push({
        supplier: alloc.supplier,
        code: alloc.code,
        start: clampIso(start, window.start, window.end),
        end: clampIso(maxIso(cappedEnd, start), window.start, window.end),
        realStart,
        realEnd: cappedRealEnd,
        tentative: isTentative && !isHypercare && alloc.supplier === transition?.toSupplier,
        flag:
          isTentative && !isHypercare && alloc.supplier === transition?.toSupplier
            ? (transition?.notes ?? null)
            : null,
        commercialStartMismatch: mismatch,
      })
    }
  }

  return segments
}

/**
 * Derive every timeline segment for one resource, chronologically ordered.
 *
 * A resource with no transition record and no granular data gets its flat
 * coarse block and nothing else — the view never fabricates a Q3 presence for
 * someone the data is simply silent about.
 */
export function deriveSegments(input: DeriveSegmentsInput): TimelineSegment[] {
  const coarse = deriveCoarseSegments(
    mergeAllocations(input.coarseAllocations),
    input.coarseWindow,
    input.transition,
  )
  const granular = deriveGranularSegments(
    mergeAllocations(input.granularAllocations),
    input.granularWindow,
    input.transition,
    input.bankHolidays,
  )

  return [...coarse, ...granular].sort((a, b) => {
    if (a.start !== b.start) return a.start < b.start ? -1 : 1
    if (a.end !== b.end) return a.end < b.end ? -1 : 1
    return a.supplier.localeCompare(b.supplier)
  })
}

/* ── Gaps ──────────────────────────────────────────────────────────── */

export interface CoverageGap {
  start: IsoDate
  end: IsoDate
}

/** Is there at least one working day strictly between these two dates? */
function hasWorkingDayBetween(
  after: IsoDate,
  before: IsoDate,
  bankHolidays: readonly IsoDate[],
): boolean {
  const holidays = new Set(bankHolidays.map((h) => h.slice(0, 10)))
  for (let d = addDays(after, 1); d < before; d = addDays(d, 1)) {
    if (!isWeekend(d) && !holidays.has(d)) return true
  }
  return false
}

/**
 * Gaps between consecutive segments — a person's cover ending before their
 * next cover starts.
 *
 * A gap needs at least one uncovered WORKING day to be real. Two things would
 * otherwise show up as gaps and neither is one: the Q2→Q3 seam, where cover
 * runs 30 Sep then resumes 1 Oct, and any handover across a weekend, where CG
 * ends on the Friday and TCS starts on the Monday. Both are continuous cover.
 *
 * Deliberately never produces a leading gap before the first segment. A gap
 * means "should have been covered and wasn't"; that does not apply to someone
 * who simply had not started yet, and rendering one for every new joiner was
 * the specific bug this rule exists to prevent.
 */
export function deriveGaps(
  segments: readonly TimelineSegment[],
  bankHolidays: readonly IsoDate[] = [],
): CoverageGap[] {
  const gaps: CoverageGap[] = []

  for (let i = 0; i < segments.length - 1; i += 1) {
    const current = segments[i]!
    const next = segments[i + 1]!
    if (next.start > current.end && hasWorkingDayBetween(current.end, next.start, bankHolidays)) {
      gaps.push({ start: current.end, end: next.start })
    }
  }
  return gaps
}

/* ── Classification ────────────────────────────────────────────────── */

const CATEGORY_LABELS: Record<string, string> = {
  transitioned: 'Transitioned to TCS',
  signed_tbc: 'Signed with TCS — start date TBC',
  established: 'Established at TCS (no CG history)',
  rolloff_hypercare: 'Rolling off, hypercare only — no TCS move',
  not_moving: 'Not moving — attrition',
}

export const NOT_IN_TRANSITION_LABEL = 'Not part of Dudley transition'

export const CATEGORY_ORDER: readonly string[] = [
  CATEGORY_LABELS.transitioned!,
  CATEGORY_LABELS.signed_tbc!,
  CATEGORY_LABELS.established!,
  CATEGORY_LABELS.rolloff_hypercare!,
  CATEGORY_LABELS.not_moving!,
  NOT_IN_TRANSITION_LABEL,
]

/**
 * Classify a resource against the Dudley transition.
 *
 * Note that hypercare-only classification requires a transition record: a
 * person can have an NPC segment without being part of the transition at all,
 * and calling them "rolling off" on that basis alone would be wrong.
 */
export function classifyTransition(
  transition: TransitionRecord | null,
  segments: readonly TimelineSegment[],
  granularWindowStart: IsoDate,
): TransitionClassification {
  const hasHypercare = segments.some((s) => s.code === 'NPC')
  const hasGranular = segments.some((s) => s.start >= granularWindowStart || s.end >= granularWindowStart)

  if (!transition) {
    // No transition record: either still here, or ran out before Q3 with no
    // recorded reason. Neither is part of the Dudley cohort.
    return hasGranular
      ? { status: 'incumbent', category: null, categoryLabel: NOT_IN_TRANSITION_LABEL }
      : { status: 'rolledoff', category: null, categoryLabel: NOT_IN_TRANSITION_LABEL }
  }

  if (transition.status === 'overlap_risk') {
    return {
      status: 'overlap_risk',
      category: 'transitioned',
      categoryLabel: CATEGORY_LABELS.transitioned!,
    }
  }

  const { fromSupplier, toSupplier } = transition

  if (fromSupplier && toSupplier) {
    return transition.status === 'signed_doj_tbc'
      ? { status: 'mover_doj_tbc', category: 'signed_tbc', categoryLabel: CATEGORY_LABELS.signed_tbc! }
      : { status: 'mover', category: 'transitioned', categoryLabel: CATEGORY_LABELS.transitioned! }
  }

  if (!fromSupplier && toSupplier) {
    return { status: 'joiner', category: 'established', categoryLabel: CATEGORY_LABELS.established! }
  }

  // Leaving with nowhere to go on this platform.
  return hasHypercare
    ? {
        status: 'rolledoff_hypercare',
        category: 'rolloff_hypercare',
        categoryLabel: CATEGORY_LABELS.rolloff_hypercare!,
      }
    : { status: 'rolledoff', category: 'not_moving', categoryLabel: CATEGORY_LABELS.not_moving! }
}
