// Resource Timeline engine built natively on resource_engagements (ADR-035,
// Phase 2 groundwork). Runs alongside the translator-based engine
// (deriveSegments + engagementsToTransitionRecords) until the diff report has
// been reviewed; neither path is removed yet.
//
// The rules, as settled:
//
//  1. The schedule is the forecast (capacity bought). It is never rewritten.
//  2. Engagement roll_on_date / roll_off_date are the actuals and override the
//     schedule. Both are inclusive: roll-on is the first day available to the
//     platform, roll-off the last day on it.
//  3. Each engagement is a separate stint and becomes its own bar, clipped to
//     the window. A null roll-off is open-ended. A null roll-on is not a
//     confirmed stint, so it draws nothing and is reported as a data issue.
//  4. A date inside engagement E is SCHEDULED iff a non-deleted allocation
//     linked to E exists for the period containing that date. Otherwise it is
//     UNSCHEDULED and is drawn as full availability with the unscheduled
//     marker. The forecast itself is left alone.
//  5. Inside scheduled periods, planview and part-time pattern come from the
//     allocations and monthly days, reusing the existing monthly-days logic:
//     contiguous runs, the noise threshold, hypercare (NPC) end-anchoring and
//     start-anchoring. "Already present last month" is now answered by the
//     engagements themselves, not by the schedule.
//  6. Scheduled after leaving gets no treatment — the bar ends at roll-off.
//  7. A gap is the space between consecutive engagements of one person.
//  8. Status labels are derived on the fly from the engagements, never stored.
//     No overlap-risk, no tentative, no hatched output.
//  9. Nothing here knows a supplier name, a date, or a supplier-specific rule.
//     It never reads the estimated or the tentative roll-on flag.

import { contiguousRuns, missingDays } from './deriveSegments'
import type { CoverageGap } from './deriveSegments'
import type {
  IsoDate,
  MonthStart,
  PeriodWindow,
  SegmentCode,
  TimelineSegment,
  TransitionCategory,
  TransitionStatus,
} from './types'
import {
  addDays,
  firstWorkingDayOfMonth,
  isWeekend,
  lastWorkingDayOfMonth,
  maxIso,
  minIso,
  monthStartOf,
  nthWorkingDay,
  previousMonthStart,
} from './workingDays'

/* ── Inputs ─────────────────────────────────────────────────────────── */

/** One non-deleted resource_engagements row, supplier already abbreviated. */
export interface EngineEngagement {
  engagementId: string
  resourceId: string
  supplier: string
  rollOnDate: IsoDate | null
  rollOffDate: IsoDate | null
}

/** One non-deleted resource_period_allocations row for a named resource. */
export interface EngineAllocation {
  allocationId: string
  resourceId: string
  engagementId: string | null
  periodId: string
  code: SegmentCode
  /** Per-month day counts keyed YYYY-MM-01; empty when never broken down. */
  monthlyDays: Record<MonthStart, number>
}

export interface EnginePeriod {
  periodId: string
  start: IsoDate
  end: IsoDate
}

export interface EngagementTimelineInput {
  engagements: readonly EngineEngagement[]
  allocations: readonly EngineAllocation[]
  periods: readonly EnginePeriod[]
  window: PeriodWindow
  bankHolidays: readonly IsoDate[]
}

/* ── Outputs ────────────────────────────────────────────────────────── */

/** The statuses this engine can produce. No tentative, no overlap risk. */
export type EngineStatus = Exclude<TransitionStatus, 'mover_doj_tbc' | 'overlap_risk'>
export type EngineCategory = Exclude<TransitionCategory, 'signed_tbc'>

export interface EngineClassification {
  status: EngineStatus
  category: EngineCategory
}

export interface EngineResource {
  resourceId: string
  segments: TimelineSegment[]
  gaps: CoverageGap[]
  /** Suppliers of window-intersecting engagements, chronological, repeats collapsed. */
  windowSuppliers: string[]
  classification: EngineClassification
}

export type DataIssueKind =
  | 'null_roll_on'
  | 'allocation_without_engagement'
  | 'scheduled_without_days_in_span'

export interface DataIssue {
  kind: DataIssueKind
  resourceId: string
  engagementId: string | null
  allocationId: string | null
  periodId: string | null
}

export interface EngagementTimelineOutput {
  resources: Map<string, EngineResource>
  dataIssues: DataIssue[]
}

/* ── Date ranges ────────────────────────────────────────────────────── */

function intersect(a: PeriodWindow, b: PeriodWindow): PeriodWindow | null {
  const start = maxIso(a.start, b.start)
  const end = minIso(a.end, b.end)
  return start <= end ? { start, end } : null
}

function contains(range: PeriodWindow, date: IsoDate): boolean {
  return date >= range.start && date <= range.end
}

/**
 * An engagement's span clipped to a range. Open-ended roll-off runs to the
 * range's end. Null roll-on has no span at all.
 */
export function engagementSpanWithin(
  engagement: Pick<EngineEngagement, 'rollOnDate' | 'rollOffDate'>,
  range: PeriodWindow,
): PeriodWindow | null {
  if (engagement.rollOnDate === null) return null
  return intersect(
    { start: engagement.rollOnDate, end: engagement.rollOffDate ?? range.end },
    range,
  )
}

/** Does any engagement cover at least one day of the given range? */
function coveredDuring(engagements: readonly EngineEngagement[], range: PeriodWindow): boolean {
  return engagements.some((e) => engagementSpanWithin(e, range) !== null)
}

/**
 * Split the window into consecutive slices: each period's part of the window,
 * plus any stretch no period covers (periodId null — never scheduled).
 */
function windowSlices(
  periods: readonly EnginePeriod[],
  window: PeriodWindow,
): { periodId: string | null; range: PeriodWindow }[] {
  const inWindow = periods
    .map((p) => ({ periodId: p.periodId, range: intersect({ start: p.start, end: p.end }, window) }))
    .filter((p): p is { periodId: string; range: PeriodWindow } => p.range !== null)
    .sort((a, b) => (a.range.start < b.range.start ? -1 : 1))

  const slices: { periodId: string | null; range: PeriodWindow }[] = []
  let cursor = window.start
  for (const p of inWindow) {
    if (p.range.start > cursor) {
      slices.push({ periodId: null, range: { start: cursor, end: addDays(p.range.start, -1) } })
    }
    if (p.range.end >= cursor) {
      slices.push({ periodId: p.periodId, range: { start: maxIso(p.range.start, cursor), end: p.range.end } })
      cursor = addDays(p.range.end, 1)
    }
  }
  if (cursor <= window.end) slices.push({ periodId: null, range: { start: cursor, end: window.end } })
  return slices
}

/* ── Scheduled pieces (monthly-days logic) ──────────────────────────── */

interface RawPiece {
  code: SegmentCode
  start: IsoDate
  end: IsoDate
}

/** Collapse one engagement's allocations in one period by planview code. */
function mergeByCode(allocations: readonly EngineAllocation[]): { code: SegmentCode; monthlyDays: Record<MonthStart, number> }[] {
  const merged = new Map<SegmentCode, Record<MonthStart, number>>()
  for (const alloc of allocations) {
    const existing = merged.get(alloc.code)
    if (!existing) {
      merged.set(alloc.code, { ...alloc.monthlyDays })
      continue
    }
    for (const [month, days] of Object.entries(alloc.monthlyDays)) {
      existing[month] = (existing[month] ?? 0) + days
    }
  }
  return [...merged.entries()].map(([code, monthlyDays]) => ({ code, monthlyDays }))
}

/**
 * Geometry the booked days imply inside one period, before the engagement's
 * own dates are applied. Same rules as the legacy granular pass: a period with
 * no monthly rows is one flat block; otherwise each contiguous run of months
 * with days is a piece, front-anchored for hypercare or where the person was
 * already on the platform the month before, back-anchored otherwise, with a
 * short final month tapering the end.
 */
function bookedPieces(
  code: SegmentCode,
  monthlyDays: Record<MonthStart, number>,
  period: PeriodWindow,
  presentBefore: (month: MonthStart) => boolean,
  bankHolidays: readonly IsoDate[],
): RawPiece[] {
  const periodFirstMonth = monthStartOf(period.start)
  const periodLastMonth = monthStartOf(period.end)
  const inPeriod: Record<MonthStart, number> = {}
  for (const [month, days] of Object.entries(monthlyDays)) {
    if (month >= periodFirstMonth && month <= periodLastMonth) inPeriod[month] = days
  }

  if (Object.keys(inPeriod).length === 0) {
    return [{ code, start: period.start, end: period.end }]
  }

  const isHypercare = code === 'NPC'
  const pieces: RawPiece[] = []

  for (const run of contiguousRuns(inPeriod)) {
    const firstMonth = run[0]!
    const lastMonth = run[run.length - 1]!
    const lastMonthDays = inPeriod[lastMonth] ?? 0

    const frontAnchored = isHypercare || presentBefore(firstMonth)

    let start: IsoDate
    if (frontAnchored) {
      start = firstWorkingDayOfMonth(firstMonth, bankHolidays)
    } else {
      const missing = missingDays(firstMonth, inPeriod[firstMonth] ?? 0, bankHolidays)
      start =
        missing > 0
          ? nthWorkingDay(firstMonth, missing, bankHolidays)
          : firstWorkingDayOfMonth(firstMonth, bankHolidays)
    }

    const daysSitAtMonthEnd = !frontAnchored && firstMonth === lastMonth
    const endMissing = daysSitAtMonthEnd ? 0 : missingDays(lastMonth, lastMonthDays, bankHolidays)

    let end: IsoDate
    if (endMissing > 0) {
      end = nthWorkingDay(lastMonth, lastMonthDays - 1, bankHolidays)
    } else {
      const stops = lastMonth < periodLastMonth || isHypercare
      end = stops ? lastWorkingDayOfMonth(lastMonth, bankHolidays) : period.end
    }

    pieces.push({ code, start: maxIso(start, period.start), end: minIso(maxIso(end, start), period.end) })
  }
  return pieces
}

/**
 * Scheduled pieces for one engagement in one period. The booked-days geometry
 * is computed first; then the engagement's dates override it (rule 2): a
 * roll-on inside the period becomes the first piece's start, a roll-off inside
 * the period becomes the last piece's end, and everything is clipped to the
 * engagement's span within the period (rule 6).
 */
function scheduledPieces(
  allocations: readonly EngineAllocation[],
  engagement: EngineEngagement,
  period: PeriodWindow,
  span: PeriodWindow,
  presentBefore: (month: MonthStart) => boolean,
  bankHolidays: readonly IsoDate[],
): RawPiece[] {
  const booked = mergeByCode(allocations)
    .flatMap(({ code, monthlyDays }) => bookedPieces(code, monthlyDays, period, presentBefore, bankHolidays))
    .filter((p) => p.end >= span.start && p.start <= span.end)
    .sort((a, b) => (a.start !== b.start ? (a.start < b.start ? -1 : 1) : a.end < b.end ? -1 : 1))

  if (booked.length === 0) return []

  const rollOn = engagement.rollOnDate
  const rollOff = engagement.rollOffDate
  if (rollOn !== null && contains(period, rollOn)) {
    booked[0] = { ...booked[0]!, start: rollOn }
  }
  if (rollOff !== null && contains(period, rollOff)) {
    let lastIndex = 0
    booked.forEach((p, i) => {
      if (p.end >= booked[lastIndex]!.end) lastIndex = i
    })
    booked[lastIndex] = { ...booked[lastIndex]!, end: rollOff }
  }

  return booked
    .map((p) => ({ ...p, start: maxIso(p.start, span.start), end: minIso(p.end, span.end) }))
    .filter((p) => p.start <= p.end)
}

/* ── Gaps, suppliers, classification ────────────────────────────────── */

function hasWorkingDayBetween(after: IsoDate, before: IsoDate, bankHolidays: readonly IsoDate[]): boolean {
  const holidays = new Set(bankHolidays.map((h) => h.slice(0, 10)))
  for (let d = addDays(after, 1); d < before; d = addDays(d, 1)) {
    if (!isWeekend(d) && !holidays.has(d)) return true
  }
  return false
}

/**
 * Gaps between consecutive engagements of one person: from the earlier one's
 * roll-off to the later one's roll-on. Same CoverageGap shape as before
 * (start = last day on, end = first day back), and only where at least one
 * working day actually falls between. Kept when any part touches the window.
 */
export function engagementGaps(
  engagements: readonly EngineEngagement[],
  window: PeriodWindow,
  bankHolidays: readonly IsoDate[] = [],
): CoverageGap[] {
  const ordered = engagements
    .filter((e): e is EngineEngagement & { rollOnDate: IsoDate } => e.rollOnDate !== null)
    .sort((a, b) => (a.rollOnDate < b.rollOnDate ? -1 : a.rollOnDate > b.rollOnDate ? 1 : 0))

  const gaps: CoverageGap[] = []
  for (let i = 1; i < ordered.length; i++) {
    const before = ordered[i - 1]!
    const after = ordered[i]!
    if (before.rollOffDate === null) continue
    if (after.rollOnDate <= before.rollOffDate) continue
    if (!hasWorkingDayBetween(before.rollOffDate, after.rollOnDate, bankHolidays)) continue
    if (before.rollOffDate > window.end || after.rollOnDate < window.start) continue
    gaps.push({ start: before.rollOffDate, end: after.rollOnDate })
  }
  return gaps
}

/** Engagements with at least one day inside the window, chronological. */
export function windowEngagements(
  engagements: readonly EngineEngagement[],
  window: PeriodWindow,
): EngineEngagement[] {
  return engagements
    .filter((e) => engagementSpanWithin(e, window) !== null)
    .sort((a, b) => ((a.rollOnDate ?? '') < (b.rollOnDate ?? '') ? -1 : 1))
}

/**
 * Suppliers for the avatar: those of the engagements that intersect the given
 * window, chronological, consecutive repeats collapsed. The window is a
 * parameter so a future date filter narrows the avatar with it.
 */
export function windowSuppliers(
  engagements: readonly EngineEngagement[],
  window: PeriodWindow,
): string[] {
  const suppliers: string[] = []
  for (const e of windowEngagements(engagements, window)) {
    if (suppliers[suppliers.length - 1] !== e.supplier) suppliers.push(e.supplier)
  }
  return suppliers
}

/**
 * Today's transition categories, derived on the fly from the order of the
 * engagements that intersect the window (unscheduled time counts as ordinary
 * engagement time):
 *
 *  - a supplier change between consecutive engagements → transitioned (mover)
 *  - otherwise, the first engagement rolls on inside the window → established
 *    (joiner). Takes precedence over a later roll-off, as the translator did.
 *  - otherwise, the last engagement rolls off inside the window (its final
 *    day counts: roll-off is inclusive) → hypercare
 *    only if any hypercare piece is drawn, else not moving
 *  - otherwise → not part of a transition (incumbent)
 *
 * "Signed, start date TBC" depended on tentativeness and is not produced.
 */
export function classifyEngagements(
  engagements: readonly EngineEngagement[],
  segments: readonly Pick<TimelineSegment, 'code'>[],
  window: PeriodWindow,
): EngineClassification {
  const inWindow = windowEngagements(engagements, window)

  for (let i = 1; i < inWindow.length; i++) {
    if (inWindow[i]!.supplier !== inWindow[i - 1]!.supplier) {
      return { status: 'mover', category: 'transitioned' }
    }
  }

  const first = inWindow[0]
  if (first?.rollOnDate != null && first.rollOnDate > window.start) {
    return { status: 'joiner', category: 'established' }
  }

  const last = inWindow[inWindow.length - 1]
  if (last?.rollOffDate != null && last.rollOffDate <= window.end) {
    return segments.some((s) => s.code === 'NPC')
      ? { status: 'rolledoff_hypercare', category: 'rolloff_hypercare' }
      : { status: 'rolledoff', category: 'not_moving' }
  }

  return { status: 'incumbent', category: null }
}

/* ── Per resource ───────────────────────────────────────────────────── */

function compareSegments(a: TimelineSegment, b: TimelineSegment): number {
  if (a.start !== b.start) return a.start < b.start ? -1 : 1
  if (a.end !== b.end) return a.end < b.end ? -1 : 1
  return a.supplier.localeCompare(b.supplier)
}

function deriveResource(
  resourceId: string,
  engagements: readonly EngineEngagement[],
  allocations: readonly EngineAllocation[],
  slices: readonly { periodId: string | null; range: PeriodWindow }[],
  window: PeriodWindow,
  bankHolidays: readonly IsoDate[],
  issues: DataIssue[],
): EngineResource {
  const dated = engagements.filter((e) => e.rollOnDate !== null)

  // "Was this person on the platform last month?" — answered by the
  // engagements (the actuals), across every supplier.
  const presentBefore = (month: MonthStart): boolean =>
    coveredDuring(dated, { start: previousMonthStart(month), end: addDays(month, -1) })

  const allocsByEngagementPeriod = new Map<string, EngineAllocation[]>()
  for (const alloc of allocations) {
    if (alloc.engagementId === null) continue
    const key = `${alloc.engagementId}::${alloc.periodId}`
    const list = allocsByEngagementPeriod.get(key) ?? []
    list.push(alloc)
    allocsByEngagementPeriod.set(key, list)
  }

  const segments: TimelineSegment[] = []

  for (const engagement of dated) {
    const span = engagementSpanWithin(engagement, window)
    if (span === null) continue

    const pieces: (RawPiece & { unscheduled: boolean })[] = []
    for (const slice of slices) {
      const within = intersect(span, slice.range)
      if (within === null) continue

      const linked =
        slice.periodId === null
          ? []
          : (allocsByEngagementPeriod.get(`${engagement.engagementId}::${slice.periodId}`) ?? [])

      if (linked.length === 0) {
        pieces.push({ code: 'REG', start: within.start, end: within.end, unscheduled: true })
        continue
      }

      const scheduled = scheduledPieces(linked, engagement, slice.range, within, presentBefore, bankHolidays)
      if (scheduled.length === 0) {
        issues.push({
          kind: 'scheduled_without_days_in_span',
          resourceId,
          engagementId: engagement.engagementId,
          allocationId: null,
          periodId: slice.periodId,
        })
      }
      for (const p of scheduled) pieces.push({ ...p, unscheduled: false })
    }

    pieces.sort((a, b) => (a.start !== b.start ? (a.start < b.start ? -1 : 1) : a.end < b.end ? -1 : 1))

    // A boundary is printed only where the engagement's cover really starts
    // or stops — not at a period seam inside one continuous stint, and never
    // at the window's own edges.
    pieces.forEach((piece, i) => {
      const touchesPrevious = pieces.some((o, j) => j !== i && o.end >= addDays(piece.start, -1) && o.start < piece.start)
      const touchesNext = pieces.some((o, j) => j !== i && o.start <= addDays(piece.end, 1) && o.end > piece.end)
      segments.push({
        supplier: engagement.supplier,
        code: piece.code,
        start: piece.start,
        end: piece.end,
        realStart: piece.start > window.start && !touchesPrevious,
        realEnd: piece.end < window.end && !touchesNext,
        tentative: false,
        flag: null,
        commercialStartMismatch: null,
        engagementId: engagement.engagementId,
        unscheduled: piece.unscheduled,
      })
    })
  }

  segments.sort(compareSegments)

  return {
    resourceId,
    segments,
    gaps: engagementGaps(dated, window, bankHolidays),
    windowSuppliers: windowSuppliers(dated, window),
    classification: classifyEngagements(dated, segments, window),
  }
}

/**
 * Derive every resource's bars, gaps, avatar suppliers and transition
 * category from engagements, allocations and monthly days. A resource appears
 * in the output when it has any engagement or allocation; one with no bars in
 * the window comes back with an empty segment list.
 */
export function deriveEngagementTimeline(input: EngagementTimelineInput): EngagementTimelineOutput {
  const issues: DataIssue[] = []
  const slices = windowSlices(input.periods, input.window)

  const engagementsByResource = new Map<string, EngineEngagement[]>()
  for (const e of input.engagements) {
    if (e.rollOnDate === null) {
      issues.push({ kind: 'null_roll_on', resourceId: e.resourceId, engagementId: e.engagementId, allocationId: null, periodId: null })
    }
    const list = engagementsByResource.get(e.resourceId) ?? []
    list.push(e)
    engagementsByResource.set(e.resourceId, list)
  }

  const allocationsByResource = new Map<string, EngineAllocation[]>()
  for (const a of input.allocations) {
    if (a.engagementId === null) {
      issues.push({ kind: 'allocation_without_engagement', resourceId: a.resourceId, engagementId: null, allocationId: a.allocationId, periodId: a.periodId })
    }
    const list = allocationsByResource.get(a.resourceId) ?? []
    list.push(a)
    allocationsByResource.set(a.resourceId, list)
  }

  const resourceIds = new Set([...engagementsByResource.keys(), ...allocationsByResource.keys()])
  const resources = new Map<string, EngineResource>()
  for (const resourceId of resourceIds) {
    resources.set(
      resourceId,
      deriveResource(
        resourceId,
        engagementsByResource.get(resourceId) ?? [],
        allocationsByResource.get(resourceId) ?? [],
        slices,
        input.window,
        input.bankHolidays,
        issues,
      ),
    )
  }

  return { resources, dataIssues: issues }
}
