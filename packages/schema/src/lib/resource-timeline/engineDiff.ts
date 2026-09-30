// Diff harness for the dual-running phase (ADR-035): compares the legacy
// (translator → deriveSegments) and native (engagementEngine) outputs person
// by person, and attributes every difference to a settled rule — or, where no
// rule accounts for it, lists it as UNEXPLAINED.
//
// Attribution is deliberately evidence-based: a difference is only credited
// to a rule when the input rows show that rule applies to those exact days.
// Anything that cannot be matched that way is left unexplained for a human.

import type { IsoDate, PeriodWindow, SegmentCode } from './types'
import { addDays } from './workingDays'
import type { ResourceTimelineData, TimelineResource } from '../../types/resourceTimeline'

/* ── Inputs the attribution needs, per person ───────────────────────── */

export interface DiffEngagement {
  supplier: string
  rollOnDate: IsoDate | null
  rollOffDate: IsoDate | null
}

export interface DiffAllocation {
  supplier: string
  periodStart: IsoDate
  periodEnd: IsoDate
  code: string
  monthlyDays: Record<string, number>
}

export interface DiffContext {
  window: PeriodWindow
  /** The period the legacy engine treats as flat (no month granularity). */
  coarsePeriod: PeriodWindow
  engagementsByName: ReadonlyMap<string, readonly DiffEngagement[]>
  allocationsByName: ReadonlyMap<string, readonly DiffAllocation[]>
}

/* ── Rules ──────────────────────────────────────────────────────────── */

export type RuleId =
  | 'R2-roll-on'
  | 'R2/R6-roll-off'
  | 'R5-unscheduled'
  | 'SPEC-monthly-days'
  | 'SPEC-anchoring'
  | 'SPEC-category'
  | 'R7-overlap-risk'
  | 'R12-no-tentative'
  | 'SPEC-avatar'
  | 'R4-gaps'
  | 'R10-pieces'

export const RULE_TEXT: Record<RuleId, string> = {
  'R2-roll-on': 'Rule 2 — engagement roll-on is the actual and overrides the schedule',
  'R2/R6-roll-off': 'Rules 2 & 6 — the bar ends at roll-off; scheduled-after-leaving gets no treatment',
  'R5-unscheduled': 'Rule 5 — engaged but not scheduled: drawn from the engagement with the unscheduled marker',
  'SPEC-monthly-days':
    'Spec — part-time pattern comes from monthly days in every period (the old engine drew the first period flat and ignored its monthly rows)',
  'SPEC-anchoring':
    'Spec — start-anchoring as today, but "already present last month" now comes from the engagements, not the schedule',
  'SPEC-category':
    'Spec — transition category derived on the fly from the order of engagements intersecting the window (the translator read every engagement, and roll_on_estimated)',
  'R7-overlap-risk': 'Rule 7 — no stored labels; overlap risk is not produced',
  'R12-no-tentative': 'Rule 12 — no tentative roll-on/roll-off; nothing tentative or hatched',
  'SPEC-avatar': 'Spec — avatar split from the suppliers of engagements intersecting the window',
  'R4-gaps': 'Rule 4 — a gap is the space between consecutive engagements of one person',
  'R10-pieces':
    'Rule 10 — same cover, different piece boundaries (period seams / planview / scheduled-unscheduled pieces within one engagement)',
}

/* ── Output ─────────────────────────────────────────────────────────── */

export interface BarView {
  supplier: string
  code: SegmentCode
  start: IsoDate
  end: IsoDate
  unscheduled: boolean
}

export interface PersonView {
  bars: BarView[]
  status: string
  categoryLabel: string
  avatar: string
  gaps: string[]
}

export interface Finding {
  rule: RuleId | null
  text: string
}

export interface PersonDiff {
  name: string
  old: PersonView | null
  new: PersonView | null
  findings: Finding[]
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function barsOf(r: TimelineResource): BarView[] {
  return r.segments.map((s) => ({
    supplier: s.supplier,
    code: s.code,
    start: s.start,
    end: s.end,
    unscheduled: s.unscheduled === true,
  }))
}

function avatarOf(r: TimelineResource): string {
  const suppliers = r.windowSuppliers ?? r.segments.map((s) => s.supplier)
  if (suppliers.length === 0) return 'none'
  const from = suppliers[0]!
  const to = suppliers[suppliers.length - 1]!
  return from === to ? `solid ${from}` : `split ${from}→${to}`
}

function viewOf(r: TimelineResource): PersonView {
  return {
    bars: barsOf(r),
    status: r.status,
    categoryLabel: r.categoryLabel,
    avatar: avatarOf(r),
    gaps: r.gaps.map((g) => `${g.start} → ${g.end}`),
  }
}

function daysOf(bar: { start: IsoDate; end: IsoDate }): IsoDate[] {
  const days: IsoDate[] = []
  for (let d = bar.start; d <= bar.end; d = addDays(d, 1)) days.push(d)
  return days
}

/** Collapse consecutive days into [start, end] runs for readable output. */
function runsOf(days: readonly IsoDate[]): { start: IsoDate; end: IsoDate }[] {
  const sorted = [...days].sort()
  const runs: { start: IsoDate; end: IsoDate }[] = []
  for (const d of sorted) {
    const last = runs[runs.length - 1]
    if (last && addDays(last.end, 1) === d) last.end = d
    else runs.push({ start: d, end: d })
  }
  return runs
}

function fmtRun(r: { start: IsoDate; end: IsoDate }): string {
  return r.start === r.end ? r.start : `${r.start}–${r.end}`
}

/** code per covered day for one supplier; unscheduled days recorded separately. */
function coverage(bars: readonly BarView[], supplier: string): Map<IsoDate, { code: SegmentCode; unscheduled: boolean }> {
  const map = new Map<IsoDate, { code: SegmentCode; unscheduled: boolean }>()
  for (const bar of bars) {
    if (bar.supplier !== supplier) continue
    for (const d of daysOf(bar)) {
      const existing = map.get(d)
      // A day covered by both REG and NPC reads as REG + NPC; keep the pair stable.
      map.set(d, existing && existing.code !== bar.code ? { code: 'REG', unscheduled: existing.unscheduled && bar.unscheduled } : { code: bar.code, unscheduled: bar.unscheduled })
    }
  }
  return map
}

function barKey(b: BarView): string {
  return `${b.supplier}|${b.code}|${b.start}|${b.end}|${b.unscheduled ? 'U' : 'S'}`
}

/* ── Attribution ────────────────────────────────────────────────────── */

function engagementCovering(engs: readonly DiffEngagement[], supplier: string, day: IsoDate): DiffEngagement | undefined {
  return engs.find(
    (e) => e.supplier === supplier && e.rollOnDate !== null && e.rollOnDate <= day && (e.rollOffDate === null || e.rollOffDate >= day),
  )
}

function inRange(day: IsoDate, range: PeriodWindow): boolean {
  return day >= range.start && day <= range.end
}

/**
 * Days the old engine covered for a supplier that the new one does not.
 * Explained when the engagement dates exclude them (rule 2/6), or when they
 * sit in the flat period and that period's monthly rows don't book them.
 */
function explainOnlyOld(
  runs: readonly { start: IsoDate; end: IsoDate }[],
  supplier: string,
  ctx: DiffContext,
  engs: readonly DiffEngagement[],
  allocs: readonly DiffAllocation[],
): Finding[] {
  const findings: Finding[] = []
  for (const run of runs) {
    const days = daysOf(run)
    const outsideEngagement = days.every((d) => engagementCovering(engs, supplier, d) === undefined)
    if (outsideEngagement) {
      const before = engs.some((e) => e.supplier === supplier && e.rollOnDate !== null && run.end < e.rollOnDate)
      findings.push({
        rule: before ? 'R2-roll-on' : 'R2/R6-roll-off',
        text: `${supplier} ${fmtRun(run)} dropped: outside the ${supplier} engagement`,
      })
      continue
    }
    const inCoarse = days.every((d) => inRange(d, ctx.coarsePeriod))
    const coarseMonthly = allocs.some(
      (a) => a.supplier === supplier && a.periodStart === ctx.coarsePeriod.start && Object.keys(a.monthlyDays).length > 0,
    )
    if (inCoarse && coarseMonthly) {
      findings.push({ rule: 'SPEC-monthly-days', text: `${supplier} ${fmtRun(run)} no longer drawn: not booked in that period's monthly days` })
      continue
    }
    findings.push({ rule: null, text: `${supplier} ${fmtRun(run)} drawn by the old engine only` })
  }
  return findings
}

/**
 * Days the new engine covers that the old did not. Unscheduled days are rule
 * 5; scheduled days are explained by a roll-on override (rule 2) or by
 * engagement-based presence moving a partial first month to the front.
 */
function explainOnlyNew(
  runs: readonly { start: IsoDate; end: IsoDate; unscheduled: boolean }[],
  supplier: string,
  engs: readonly DiffEngagement[],
): Finding[] {
  const findings: Finding[] = []
  for (const run of runs) {
    if (run.unscheduled) {
      findings.push({ rule: 'R5-unscheduled', text: `${supplier} ${fmtRun(run)} unscheduled (on the platform, no schedule row)` })
      continue
    }
    const startsAtRollOn = engs.some((e) => e.supplier === supplier && e.rollOnDate === run.start)
    const endsAtRollOff = engs.some((e) => e.supplier === supplier && e.rollOffDate === run.end)
    if (startsAtRollOn) {
      findings.push({ rule: 'R2-roll-on', text: `${supplier} ${fmtRun(run)} added: bar starts at the ${run.start} roll-on` })
      continue
    }
    if (endsAtRollOff) {
      findings.push({ rule: 'R2/R6-roll-off', text: `${supplier} ${fmtRun(run)} added: bar runs to the ${run.end} roll-off` })
      continue
    }
    // Presence: the run sits at the start of a month the person was already
    // on the platform for (per engagements) the month before.
    const monthStart = `${run.start.slice(0, 7)}-01`
    const priorDay = addDays(monthStart, -1)
    const presentBefore = engs.some(
      (e) => e.rollOnDate !== null && e.rollOnDate <= priorDay && (e.rollOffDate === null || e.rollOffDate >= priorDay),
    )
    if (presentBefore && run.start.slice(0, 7) === run.end.slice(0, 7)) {
      findings.push({ rule: 'SPEC-anchoring', text: `${supplier} ${fmtRun(run)} added: front-anchored, on the platform the month before` })
      continue
    }
    findings.push({ rule: null, text: `${supplier} ${fmtRun(run)} drawn by the new engine only` })
  }
  return findings
}

function explainCategory(oldView: PersonView, newView: PersonView): Finding | null {
  if (oldView.categoryLabel === newView.categoryLabel && oldView.status === newView.status) return null
  const text = `category ${oldView.categoryLabel} (${oldView.status}) → ${newView.categoryLabel} (${newView.status})`
  if (oldView.status === 'mover_doj_tbc') return { rule: 'R12-no-tentative', text }
  if (oldView.status === 'overlap_risk') return { rule: 'R7-overlap-risk', text }
  return { rule: 'SPEC-category', text }
}

/* ── Compare ────────────────────────────────────────────────────────── */

export function compareTimelines(
  oldData: ResourceTimelineData | null,
  newData: ResourceTimelineData | null,
  ctx: DiffContext,
): PersonDiff[] {
  const oldByName = new Map((oldData?.resources ?? []).map((r) => [r.name, r]))
  const newByName = new Map((newData?.resources ?? []).map((r) => [r.name, r]))
  const names = [...new Set([...oldByName.keys(), ...newByName.keys()])].sort((a, b) => a.localeCompare(b))

  const diffs: PersonDiff[] = []
  for (const name of names) {
    const o = oldByName.get(name)
    const n = newByName.get(name)
    const oldView = o ? viewOf(o) : null
    const newView = n ? viewOf(n) : null
    const engs = ctx.engagementsByName.get(name) ?? []
    const allocs = ctx.allocationsByName.get(name) ?? []
    const findings: Finding[] = []

    const oldBars = oldView?.bars ?? []
    const newBars = newView?.bars ?? []
    const suppliers = [...new Set([...oldBars, ...newBars].map((b) => b.supplier))].sort()

    let coverChanged = false
    for (const supplier of suppliers) {
      const oldCover = coverage(oldBars, supplier)
      const newCover = coverage(newBars, supplier)

      const onlyOld = [...oldCover.keys()].filter((d) => !newCover.has(d))
      const onlyNew = [...newCover.keys()].filter((d) => !oldCover.has(d))
      if (onlyOld.length > 0 || onlyNew.length > 0) coverChanged = true

      findings.push(...explainOnlyOld(runsOf(onlyOld), supplier, ctx, engs, allocs))

      const newScheduled = onlyNew.filter((d) => !newCover.get(d)!.unscheduled)
      const newUnscheduled = onlyNew.filter((d) => newCover.get(d)!.unscheduled)
      findings.push(
        ...explainOnlyNew(
          [
            ...runsOf(newScheduled).map((r) => ({ ...r, unscheduled: false })),
            ...runsOf(newUnscheduled).map((r) => ({ ...r, unscheduled: true })),
          ],
          supplier,
          engs,
        ),
      )

      // Days covered by both, but where the new engine calls them unscheduled.
      const nowUnscheduled = [...newCover.entries()].filter(([d, v]) => v.unscheduled && oldCover.has(d)).map(([d]) => d)
      for (const run of runsOf(nowUnscheduled)) {
        findings.push({ rule: 'R5-unscheduled', text: `${supplier} ${fmtRun(run)} same cover, now marked unscheduled` })
      }

      // Planview (code) changes on commonly covered days.
      const codeChanged = [...newCover.entries()]
        .filter(([d, v]) => oldCover.has(d) && oldCover.get(d)!.code !== v.code)
        .map(([d]) => d)
      for (const run of runsOf(codeChanged)) {
        const unsched = newCover.get(run.start)?.unscheduled === true
        findings.push({
          rule: unsched ? 'R5-unscheduled' : null,
          text: `${supplier} ${fmtRun(run)} planview ${oldCover.get(run.start)!.code} → ${newCover.get(run.start)!.code}`,
        })
      }
    }

    // Same days, different piece boundaries.
    const oldKeys = oldBars.map(barKey).sort().join(',')
    const newKeys = newBars.map((b) => barKey({ ...b, unscheduled: b.unscheduled })).sort().join(',')
    if (!coverChanged && oldKeys !== newKeys && findings.every((f) => f.rule !== 'R5-unscheduled')) {
      findings.push({ rule: 'R10-pieces', text: `pieces ${oldBars.length} → ${newBars.length}, same cover` })
    }

    if (oldView && newView) {
      const cat = explainCategory(oldView, newView)
      if (cat) findings.push(cat)
      if (oldView.avatar !== newView.avatar) {
        findings.push({ rule: 'SPEC-avatar', text: `avatar ${oldView.avatar} → ${newView.avatar}` })
      }
      if (oldView.gaps.join(',') !== newView.gaps.join(',')) {
        findings.push({
          rule: 'R4-gaps',
          text: `gaps [${oldView.gaps.join('; ') || 'none'}] → [${newView.gaps.join('; ') || 'none'}]`,
        })
      }
    } else if (oldView && !newView) {
      // No row at all in the new engine is only explained when none of the
      // person's engagements reaches into the window.
      const inWindow = engs.some(
        (e) => e.rollOnDate !== null && e.rollOnDate <= ctx.window.end && (e.rollOffDate === null || e.rollOffDate >= ctx.window.start),
      )
      findings.push(
        inWindow
          ? { rule: null, text: 'row present in old engine only' }
          : { rule: 'R2/R6-roll-off', text: 'row dropped: no engagement intersects the window' },
      )
    } else if (newView && !oldView) {
      findings.push({ rule: null, text: 'row present in new engine only' })
    }

    if (findings.length > 0) diffs.push({ name, old: oldView, new: newView, findings })
  }
  return diffs
}

/* ── Markdown ───────────────────────────────────────────────────────── */

function barLine(b: BarView): string {
  return `${b.supplier}${b.code === 'NPC' ? ' NPC' : ''} ${b.start} → ${b.end}${b.unscheduled ? ' *(unscheduled)*' : ''}`
}

function personBlock(d: PersonDiff, onlyUnexplained: boolean): string {
  const findings = onlyUnexplained ? d.findings.filter((f) => f.rule === null) : d.findings
  const lines = [`#### ${d.name}`, '']
  lines.push(`- **Old:** ${d.old ? d.old.bars.map(barLine).join('; ') || '(no bars)' : '(no row)'}${d.old ? ` — ${d.old.categoryLabel}, avatar ${d.old.avatar}` : ''}`)
  lines.push(`- **New:** ${d.new ? d.new.bars.map(barLine).join('; ') || '(no bars)' : '(no row)'}${d.new ? ` — ${d.new.categoryLabel}, avatar ${d.new.avatar}` : ''}`)
  for (const f of findings) {
    lines.push(`- ${f.text} — ${f.rule ? `**${f.rule}**` : '**UNEXPLAINED**'}`)
  }
  lines.push('')
  return lines.join('\n')
}

export function renderDiffSection(title: string, diffs: readonly PersonDiff[], totalPeople: number): string {
  const unexplained = diffs.filter((d) => d.findings.some((f) => f.rule === null))
  const out: string[] = [`## ${title}`, '']
  out.push(`${totalPeople} people compared; ${diffs.length} differ; ${unexplained.length} with unexplained differences.`, '')

  out.push('### UNEXPLAINED', '')
  if (unexplained.length === 0) out.push('None.', '')
  for (const d of unexplained) out.push(personBlock(d, true))

  out.push('### All differences, by person', '')
  for (const d of diffs) out.push(personBlock(d, false))
  return out.join('\n')
}

export function renderRuleKey(): string {
  return ['## Rule key', '', ...Object.entries(RULE_TEXT).map(([id, text]) => `- **${id}** — ${text}`), ''].join('\n')
}
