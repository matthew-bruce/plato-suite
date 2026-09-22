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
//  4. Anchoring — which end of a partial month the booked days sit against.
//     FRONT-anchored (days at the START of the month, bar ends early) for
//     hypercare, and for any allocation the resource was ALREADY present for
//     in the immediately preceding month or period. BACK-anchored (days at
//     the END of the month, bar starts late) only where there was no such
//     prior presence — a genuine late start.
//
//     This used to branch on nothing but `code === 'NPC'`, which meant every
//     partial month for every other code was read as "joined late". That is
//     right for a new starter and wrong for everyone else: a continuing
//     resource tapering off, a permanently part-time resource, and a resource
//     rolling off the platform all got their bar shoved to the wrong end of
//     the month, and (rule 7) a fabricated gap in front of it.
//  5. The transition record outranks the day count. Where a
//     resource_supplier_transitions row exists for the allocation's supplier,
//     its last_working_day ends the outgoing bar and its commercial_start
//     begins the incoming one — whether or not monthly rows exist. The day
//     count only decides geometry the record is silent about.
//  6. Hard cap: no CG segment may run past the last working day of October
//     2026. Contractual fact, applied even when the data says otherwise.
//  7. joining_date NEVER sets geometry. Not as a start, not as an end, not as
//     a marker. Commercial presence is the only thing that moves a bar. It is
//     allowed to close a GAP (see deriveGaps) where commercial_start is null,
//     because a gap is a statement about cover, not a bar boundary.
//  8. A gap is only ever read off a transition record — never inferred from
//     the shape of the segments. See deriveGaps.

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
  monthStartsBetween,
  nthWorkingDay,
  previousMonthStart,
} from './workingDays'
import type {
  AllocationInput,
  DeriveSegmentsInput,
  PeriodWindow,
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

/* ── Prior presence ────────────────────────────────────────────────── */

/**
 * Where a resource was already present, as the granular pass needs to know it.
 *
 * This is the one piece of information the granular derivation cannot get from
 * its own inputs: whether a partial month is someone ARRIVING or someone
 * already here. The coarse period holds no month-level data at all, so "were
 * they here in September?" can only be answered by the coarse pass, and the
 * answer has to be carried across.
 *
 * Deliberately a summary rather than the raw coarse allocations. Two reasons:
 * the coarse block may have been clipped by a last working day, so "had a Q2
 * allocation" is not the same question as "was still covered in September";
 * and keeping it to two plain values means the dependency between the two
 * passes is one-directional, explicit, and testable on its own.
 */
export interface PriorPresence {
  /** Months INSIDE the granular window carrying any booked day, any allocation. */
  granularMonths: ReadonlySet<MonthStart>
  /** Last date covered in the coarse period, or null if absent from it entirely. */
  coarseCoverageEnd: IsoDate | null
}

/**
 * Summarise presence from the already-derived coarse segments and the raw
 * granular allocations.
 *
 * Presence is per RESOURCE, not per allocation: someone whose CG line stops
 * and whose TCS line starts is continuously present, and the TCS bar should
 * not be treated as a late start just because that particular allocation is
 * new. Every allocation in the period contributes, whatever its supplier or
 * code.
 */
export function buildPriorPresence(
  coarseSegments: readonly TimelineSegment[],
  granularAllocations: readonly AllocationInput[],
  granularWindow: PeriodWindow,
): PriorPresence {
  const granularMonths = new Set<MonthStart>()

  for (const alloc of granularAllocations) {
    // No monthly breakdown means a flat whole-quarter block (see rule 2), so
    // the resource is present in every month of the window.
    if (Object.keys(alloc.monthlyDays).length === 0) {
      for (const month of monthStartsBetween(granularWindow.start, granularWindow.end)) {
        granularMonths.add(month)
      }
      continue
    }
    for (const [month, days] of Object.entries(alloc.monthlyDays)) {
      if (days > 0) granularMonths.add(month)
    }
  }

  let coarseCoverageEnd: IsoDate | null = null
  for (const segment of coarseSegments) {
    if (coarseCoverageEnd === null || segment.end > coarseCoverageEnd) {
      coarseCoverageEnd = segment.end
    }
  }

  return { granularMonths, coarseCoverageEnd }
}

/**
 * Was the resource present in the month immediately before `month`?
 *
 * Inside the granular window that is a straight lookup. For the window's first
 * month the previous month belongs to the coarse period, which has no monthly
 * data — so the question becomes "did coarse cover reach into that month",
 * which correctly answers `false` for someone whose Q2 block was clipped by a
 * last working day back in July.
 */
export function hadPresenceBefore(
  month: MonthStart,
  presence: PriorPresence,
  granularWindow: PeriodWindow,
): boolean {
  const prior = previousMonthStart(month)

  if (prior >= monthStartOf(granularWindow.start)) {
    return presence.granularMonths.has(prior)
  }
  return presence.coarseCoverageEnd !== null && presence.coarseCoverageEnd >= prior
}

/**
 * The date a transition record says cover RESUMES, for gap purposes only.
 *
 * commercial_start where set, joining_date otherwise. joining_date is allowed
 * here and nowhere else: the schema is explicit that it must never set a bar's
 * start or end (rule 7), but a gap is a statement about when someone was
 * uncovered, not a bar boundary, and where no commercial start is recorded the
 * date of joining is the best evidence of when the gap closed.
 */
export function gapResumeDate(transition: TransitionRecord | null): IsoDate | null {
  if (!transition) return null
  return transition.commercialStart ?? transition.joiningDate
}

/** A record date, or null when it falls outside the window being derived. */
function withinWindow(date: IsoDate | null, window: PeriodWindow): IsoDate | null {
  if (date === null) return null
  return date >= window.start && date <= window.end ? date : null
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
  presence: PriorPresence,
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
    const isHypercare = alloc.code === 'NPC'
    const isToSupplier = alloc.supplier === transition?.toSupplier
    const isFromSupplier =
      transition?.fromSupplier != null && alloc.supplier === transition.fromSupplier
    const tentative = isTentative && !isHypercare && isToSupplier
    const flag = tentative ? (transition?.notes ?? null) : null

    if (Object.keys(alloc.monthlyDays).length === 0) {
      // No monthly breakdown at all, so there is no day count for the record to
      // outrank — whatever the record says is the only evidence there is. That
      // includes hypercare here, unlike the month-driven path below.
      const recordEnd = withinWindow(transition?.lastWorkingDay ?? null, window)
      const recordStart = isHypercare
        ? null
        : withinWindow(transition?.commercialStart ?? null, window)

      segments.push({
        supplier: alloc.supplier,
        code: alloc.code,
        start: recordStart ?? window.start,
        end: applyCgCap(alloc.supplier, recordEnd ?? window.end),
        // Same as Q2's coarse block: the window's own edges aren't real
        // boundaries for anybody, only a record date is.
        realStart: recordStart !== null,
        realEnd: true,
        tentative,
        flag,
        commercialStartMismatch: null,
      })
      continue
    }

    // Rule 5: the record outranks the day count. The outgoing bar ends on the
    // last working day, the incoming one starts on the commercial start —
    // whichever month the booked days happen to suggest. Hypercare is exempt:
    // its day count IS the wind-down, and a last working day describes the
    // substantive role rather than the tail of cover after it.
    const recordEnd =
      !isHypercare && isFromSupplier
        ? withinWindow(transition?.lastWorkingDay ?? null, window)
        : null
    const recordStart =
      !isHypercare && isToSupplier
        ? withinWindow(transition?.commercialStart ?? null, window)
        : null

    for (const run of contiguousRuns(alloc.monthlyDays)) {
      const firstMonth = run[0]!
      const lastMonth = run[run.length - 1]!
      const lastMonthDays = alloc.monthlyDays[lastMonth] ?? 0

      // Rule 4. Hypercare is always a wind-down. Everyone else is judged on
      // whether they were already here last month: if they were, a short month
      // is them tapering off or working part-time, and the days belong at the
      // front. If they weren't, it is a genuine late start.
      const frontAnchored = isHypercare || hadPresenceBefore(firstMonth, presence, window)

      let start: IsoDate
      if (frontAnchored) {
        start = firstWorkingDayOfMonth(firstMonth, bankHolidays)
      } else {
        // BACK-anchored: nobody was here last month, so a partial first month
        // means they arrived part-way through it and the days sit at its END.
        const missing = missingDays(firstMonth, alloc.monthlyDays[firstMonth] ?? 0, bankHolidays)
        start =
          missing > 0
            ? nthWorkingDay(firstMonth, missing, bankHolidays)
            : firstWorkingDayOfMonth(firstMonth, bankHolidays)
      }

      // The END is a separate question from the start. A short FINAL month is
      // cover running out, whichever way the run's first month was anchored —
      // someone who arrives in October and tapers through November is still
      // tapering. The one exception is a back-anchored single-month run: there
      // the days were just placed against the end of that month, so the bar
      // already finishes there and tapering it again would halve it.
      const daysSitAtMonthEnd = !frontAnchored && firstMonth === lastMonth
      const endMissing = daysSitAtMonthEnd
        ? 0
        : missingDays(lastMonth, lastMonthDays, bankHolidays)

      let end: IsoDate
      let realEnd: boolean
      if (endMissing > 0) {
        end = nthWorkingDay(lastMonth, lastMonthDays - 1, bankHolidays)
        realEnd = true
      } else {
        // Ongoing unless the run genuinely stops before the window does.
        // Hypercare never runs to the window edge — it stops at its last
        // booked month by definition.
        const runEndsEarly = lastMonth < monthStartOf(window.end)
        const stops = runEndsEarly || isHypercare
        end = stops ? lastWorkingDayOfMonth(lastMonth, bankHolidays) : window.end
        realEnd = stops
      }

      // What the days alone said, kept so a divergence from the record can be
      // surfaced rather than silently resolved.
      const derivedStart = start
      if (recordStart !== null) start = recordStart
      if (recordEnd !== null) {
        end = recordEnd
        realEnd = true
      }

      const cappedEnd = applyCgCap(alloc.supplier, end)
      // A cap that actually bit turns the window edge into a real boundary.
      const cappedRealEnd = realEnd || cappedEnd !== end

      segments.push({
        supplier: alloc.supplier,
        code: alloc.code,
        start: clampIso(start, window.start, window.end),
        end: clampIso(maxIso(cappedEnd, start), window.start, window.end),
        realStart: true,
        realEnd: cappedRealEnd,
        tentative,
        flag,
        commercialStartMismatch:
          recordStart !== null && recordStart !== derivedStart ? derivedStart : null,
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

  // The two passes are no longer independent. The granular one has to know
  // whether the resource was already present immediately beforehand, and only
  // the coarse pass can answer that for the window's first month — so coarse
  // is derived first and summarised into the one value granular needs. The
  // dependency runs one way only: nothing about the granular period can change
  // a coarse bar.
  const granularAllocations = mergeAllocations(input.granularAllocations)
  const presence = buildPriorPresence(coarse, granularAllocations, input.granularWindow)

  const granular = deriveGranularSegments(
    granularAllocations,
    input.granularWindow,
    input.transition,
    input.bankHolidays,
    presence,
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
 * The uncovered span in a resource's move between suppliers — read off the
 * transition record, and ONLY off the transition record.
 *
 * This used to walk the segment list and call any daylight between two bars a
 * gap. That made the gap a function of the bars' geometry, so every anchoring
 * mistake manufactured a matching fake gap: a part-timer, someone tapering
 * off, and someone rolling off the platform entirely were all drawn as having
 * abandoned their post and come back. None of them had a transition record,
 * and none of them had a gap.
 *
 * A gap is a claim that someone SHOULD have been covered and wasn't. Only a
 * recorded move supports that claim, so only a record can produce one:
 * last_working_day to the date cover resumes (commercial_start, or
 * joining_date where that is null — see gapResumeDate). No record, no gap,
 * however the bars happen to fall.
 *
 * The working-day check remains, but as a sanity guard rather than a detector:
 * CG finishing on the Friday and TCS starting on the Monday is a clean
 * handover, and drawing a weekend as a coverage failure would be wrong even
 * with a record behind it.
 */
export function deriveGaps(
  transition: TransitionRecord | null,
  bankHolidays: readonly IsoDate[] = [],
): CoverageGap[] {
  const lastWorkingDay = transition?.lastWorkingDay ?? null
  const resumesOn = gapResumeDate(transition)

  if (lastWorkingDay === null || resumesOn === null) return []
  if (resumesOn <= lastWorkingDay) return []
  if (!hasWorkingDayBetween(lastWorkingDay, resumesOn, bankHolidays)) return []

  return [{ start: lastWorkingDay, end: resumesOn }]
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
