/**
 * Resource Timeline engine diff (ADR-035 dual running).
 *
 * Runs the legacy engine (translator → deriveSegments) and the native
 * engagement engine over the same rows and writes a markdown report of every
 * per-person difference, each attributed to a settled rule or listed as
 * UNEXPLAINED.
 *
 * Two inputs:
 *   (a) the dudleyCohort regression fixture — its CASES are read straight out
 *       of the approved test file (transpiled, never copied or edited), and
 *       turned into engagements the way migration 037's backfill does;
 *   (b) a live snapshot JSON of the rows the page query reads, for the
 *       Q2 + Q3 FY26/27 window (short surrogate ids; see the snapshot query in
 *       docs/investigations/2026-09-30-timeline-engine-diff.md).
 *
 * Usage:
 *   npx vite-node scripts/timeline-engine-diff.ts <snapshot.json> <report.md>
 *
 * Read-only: no database connection, no writes anywhere but the report file.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'esbuild'
import {
  buildEngagementTimeline,
  buildLegacyTimeline,
  type AllocationRow,
  type EngagementRow,
  type MonthlyDaysRow,
  type RawTimelineRows,
  type ResourceRow,
  type SupplierRow,
} from '../packages/schema/src/queries/resourceTimelineBuild'
import { snapshotRows, type Snapshot } from './timelineSnapshot'
import {
  compareTimelines,
  renderDiffSection,
  renderRuleKey,
  type DiffAllocation,
  type DiffContext,
  type DiffEngagement,
} from '../packages/schema/src/lib/resource-timeline/engineDiff'
import type { DataIssue } from '../packages/schema/src/lib/resource-timeline/engagementEngine'
import type { AllocationInput, TransitionRecord } from '../packages/schema/src/lib/resource-timeline/types'

/* ── Shared ─────────────────────────────────────────────────────────── */

function contextFor(rows: RawTimelineRows): DiffContext {
  const nameById = new Map(rows.resources.map((r) => [r.resource_id, r.resource_name]))
  const abbrev = new Map(rows.suppliers.map((s) => [s.supplier_id, s.supplier_abbreviation]))
  const periodById = new Map([rows.coarse, rows.granular].map((p) => [p.period_id, p]))
  const monthly = new Map<string, Record<string, number>>()
  for (const m of rows.monthlyDays) {
    const rec = monthly.get(m.allocation_id) ?? {}
    rec[m.month_start_date.slice(0, 10)] = Number(m.days)
    monthly.set(m.allocation_id, rec)
  }

  const engagementsByName = new Map<string, DiffEngagement[]>()
  for (const e of rows.engagements) {
    const name = nameById.get(e.resource_id)
    if (!name) continue
    const list = engagementsByName.get(name) ?? []
    list.push({
      supplier: abbrev.get(e.supplier_id) ?? '?',
      rollOnDate: e.roll_on_date,
      rollOffDate: e.roll_off_date,
    })
    engagementsByName.set(name, list)
  }

  const allocationsByName = new Map<string, DiffAllocation[]>()
  for (const a of rows.allocations) {
    const name = a.resource_id ? nameById.get(a.resource_id) : undefined
    const period = periodById.get(a.period_id)
    if (!name || !period) continue
    const list = allocationsByName.get(name) ?? []
    list.push({
      supplier: (a.supplier_id && abbrev.get(a.supplier_id)) || '?',
      periodStart: period.period_start_date,
      periodEnd: period.period_end_date,
      code: a.planview_code ?? '',
      monthlyDays: monthly.get(a.allocation_id) ?? {},
    })
    allocationsByName.set(name, list)
  }

  return {
    window: { start: rows.coarse.period_start_date, end: rows.granular.period_end_date },
    coarsePeriod: { start: rows.coarse.period_start_date, end: rows.coarse.period_end_date },
    engagementsByName,
    allocationsByName,
  }
}

function issuesSection(issues: readonly DataIssue[], rows: RawTimelineRows): string {
  const nameById = new Map(rows.resources.map((r) => [r.resource_id, r.resource_name]))
  const lines = ['### Data issues (new engine)', '']
  if (issues.length === 0) lines.push('None — no engagement with a null roll-on, no unlinked allocation, no scheduled period without booked days inside its engagement.')
  for (const i of issues) {
    lines.push(`- ${i.kind}: ${nameById.get(i.resourceId) ?? i.resourceId} (engagement ${i.engagementId ?? '—'}, allocation ${i.allocationId ?? '—'}, period ${i.periodId ?? '—'})`)
  }
  lines.push('')
  return lines.join('\n')
}

function run(title: string, rows: RawTimelineRows): string {
  const oldData = buildLegacyTimeline(rows)
  const { data: newData, dataIssues } = buildEngagementTimeline(rows)
  const people = new Set([...(oldData?.resources ?? []), ...(newData?.resources ?? [])].map((r) => r.name)).size
  const diffs = compareTimelines(oldData, newData, contextFor(rows))
  const overlapLabels = (newData?.resources ?? []).filter((r) => r.status === 'overlap_risk').length
  const tentative = (newData?.resources ?? []).flatMap((r) => r.segments).filter((s) => s.tentative).length
  return [
    renderDiffSection(title, diffs, people),
    issuesSection(dataIssues, rows),
    `New engine: ${overlapLabels} overlap-risk labels, ${tentative} tentative segments.`,
    '',
  ].join('\n')
}

/* ── (a) dudleyCohort fixture ───────────────────────────────────────── */

interface DudleyCase {
  name: string
  transition: TransitionRecord | null
  q2: AllocationInput[]
  q3: AllocationInput[]
}

interface DudleyFixture {
  CASES: DudleyCase[]
  BANK_HOLIDAYS: string[]
  Q2: { start: string; end: string }
  Q3: { start: string; end: string }
}

/** Evaluate the approved test's data section without importing vitest. */
function loadDudleyFixture(): DudleyFixture {
  const path = fileURLToPath(
    new URL('../packages/schema/src/lib/resource-timeline/__tests__/dudleyCohort.test.ts', import.meta.url),
  )
  const source = readFileSync(path, 'utf8')
  const dataStart = source.indexOf('const BANK_HOLIDAYS')
  const dataEnd = source.indexOf("describe('Dudley cohort")
  const { code } = transformSync(source.slice(dataStart, dataEnd), { loader: 'ts' })
  return new Function(`${code}; return { CASES, BANK_HOLIDAYS, Q2, Q3 }`)() as DudleyFixture
}

/**
 * Engagements for one fixture case, built the way migration 037's backfill
 * built them live: one per supplier seen, rolled on at the earliest period
 * that supplier is scheduled in (the fixture's first period otherwise), then
 * the transition's "to" side sets a real roll-on (commercial start, else
 * joining date) and its "from" side sets roll-off = last working day.
 */
function dudleyRows(fx: DudleyFixture): RawTimelineRows {
  const supplierIds = new Map<string, string>()
  const sid = (abbr: string) => {
    if (!supplierIds.has(abbr)) supplierIds.set(abbr, `s-${abbr}`)
    return supplierIds.get(abbr)!
  }

  const allocations: AllocationRow[] = []
  const monthlyDays: MonthlyDaysRow[] = []
  const engagements: EngagementRow[] = []
  const resources: ResourceRow[] = []

  fx.CASES.forEach((c, i) => {
    const rid = `r${i}`
    const name = c.name.split(' — ')[0]!
    resources.push({ resource_id: rid, resource_name: name, disciplines: null, hidden_from_timeline: false })

    const earliest = new Map<string, string>()
    const noteSupplier = (abbr: string, date: string) => {
      const cur = earliest.get(abbr)
      if (cur === undefined || date < cur) earliest.set(abbr, date)
    }
    c.q2.forEach((a) => noteSupplier(a.supplier, fx.Q2.start))
    c.q3.forEach((a) => noteSupplier(a.supplier, fx.Q3.start))
    if (c.transition?.fromSupplier) noteSupplier(c.transition.fromSupplier, fx.Q2.start)
    if (c.transition?.toSupplier) noteSupplier(c.transition.toSupplier, fx.Q3.start)

    const engagementFor = new Map<string, string>()
    for (const [abbr, rollOn] of earliest) {
      const t = c.transition
      const isTo = t?.toSupplier === abbr
      const isFrom = t?.fromSupplier === abbr
      const eid = `${rid}-${abbr}`
      engagementFor.set(abbr, eid)
      engagements.push({
        engagement_id: eid,
        resource_id: rid,
        supplier_id: sid(abbr),
        roll_on_date: isTo ? (t!.commercialStart ?? t!.joiningDate ?? rollOn) : rollOn,
        roll_off_date: isFrom ? t!.lastWorkingDay : null,
        roll_on_estimated: !isTo,
        roll_on_tentative: isTo && t!.status === 'signed_doj_tbc',
      })
    }

    const addAllocs = (list: AllocationInput[], periodId: string) =>
      list.forEach((a, j) => {
        const aid = `${rid}-${periodId}-${j}`
        allocations.push({
          allocation_id: aid,
          period_id: periodId,
          resource_id: rid,
          supplier_id: sid(a.supplier),
          planview_code: a.code === 'NPC' ? 'NPC' : 'PR',
          engagement_id: engagementFor.get(a.supplier) ?? null,
          capacity_days: null,
        })
        for (const [month, days] of Object.entries(a.monthlyDays)) {
          monthlyDays.push({ allocation_id: aid, month_start_date: month, days })
        }
      })
    addAllocs(c.q2, 'P2')
    addAllocs(c.q3, 'P3')
  })

  const suppliers: SupplierRow[] = [...supplierIds].map(([abbr, id], i) => ({
    supplier_id: id,
    supplier_name: abbr,
    supplier_abbreviation: abbr,
    supplier_colour: null,
    sort_order: i,
  }))

  return {
    coarse: { period_id: 'P2', period_name: 'Q2 FY 26/27', period_start_date: fx.Q2.start, period_end_date: fx.Q2.end },
    granular: { period_id: 'P3', period_name: 'Q3 FY 26/27', period_start_date: fx.Q3.start, period_end_date: fx.Q3.end },
    suppliers,
    allocations,
    monthlyDays,
    bankHolidays: fx.BANK_HOLIDAYS,
    resources,
    teamAssignments: [],
    engagements,
  }
}

/* ── (b) live snapshot: see scripts/timelineSnapshot.ts ─────────────── */

/* ── Main ───────────────────────────────────────────────────────────── */

const [snapshotPath, reportPath] = process.argv.slice(2)
if (!snapshotPath || !reportPath) {
  console.error('Usage: npx vite-node scripts/timeline-engine-diff.ts <snapshot.json> <report.md>')
  process.exit(1)
}

const report = [
  renderRuleKey(),
  run('(a) dudleyCohort fixture', dudleyRows(loadDudleyFixture())),
  run('(b) Live data — Q2 + Q3 FY26/27', snapshotRows(JSON.parse(readFileSync(snapshotPath, 'utf8')) as Snapshot)),
].join('\n')

writeFileSync(reportPath, report)
console.log(`Wrote ${reportPath}`)
