/**
 * Maps a live Resource Timeline snapshot (compact JSON with short surrogate
 * ids, produced by the read-only query in
 * docs/investigations/2026-09-30-timeline-engine-diff.md) onto the
 * RawTimelineRows both builders take. Shared by the engine diff and the
 * export/screenshot checks so every consumer reads the snapshot identically.
 */

import type { RawTimelineRows } from '../packages/schema/src/queries/resourceTimelineBuild'

export interface Snapshot {
  periods: [string, string, string, string][]
  suppliers: [string, string, string | null, number | null][]
  /** [id, name, hidden, discipline?, discipline sort?] */
  resources: [string, string, boolean, (string | null)?, (number | null)?][]
  engagements: [string, string, string, string | null, string | null, boolean, boolean][]
  /** [id, period, resource, supplier, planview, engagement, capacity_days?] */
  allocations: [string, string, string, string | null, string | null, string | null, (number | null)?][]
  monthly: [string, string, number][]
  /** [resource, period, capacity split, team name] — optional in older snapshots. */
  teams?: [string, string, number, string][]
  holidays: string[]
}

export function snapshotRows(snap: Snapshot): RawTimelineRows {
  const [coarse, granular] = [...snap.periods]
    .sort((a, b) => (a[2] < b[2] ? -1 : 1))
    .map(([id, name, start, end]) => ({ period_id: id, period_name: name, period_start_date: start, period_end_date: end }))
  return {
    coarse: coarse!,
    granular: granular!,
    suppliers: snap.suppliers.map(([abbr, name, colour, sort]) => ({
      supplier_id: abbr,
      supplier_name: name,
      supplier_abbreviation: abbr,
      supplier_colour: colour,
      sort_order: sort,
    })),
    allocations: snap.allocations.map(([aid, pid, rid, sup, code, eid, cap]) => ({
      allocation_id: aid,
      period_id: pid,
      resource_id: rid,
      supplier_id: sup,
      planview_code: code,
      engagement_id: eid,
      capacity_days: cap ?? null,
    })),
    monthlyDays: snap.monthly.map(([aid, month, days]) => ({ allocation_id: aid, month_start_date: `${month}-01`, days })),
    bankHolidays: snap.holidays,
    resources: snap.resources.map(([rid, name, hidden, discipline, sort]) => ({
      resource_id: rid,
      resource_name: name,
      disciplines: discipline ? { discipline_name: discipline, sort_order: sort ?? null } : null,
      hidden_from_timeline: hidden,
    })),
    teamAssignments: (snap.teams ?? []).map(([rid, pid, split, team]) => ({
      resource_id: rid,
      period_id: pid,
      capacity_split: split,
      teams: { team_name: team },
    })),
    engagements: snap.engagements.map(([eid, rid, sup, on, off, est, tent]) => ({
      engagement_id: eid,
      resource_id: rid,
      supplier_id: sup,
      roll_on_date: on,
      roll_off_date: off,
      roll_on_estimated: est,
      roll_on_tentative: tent,
    })),
  }
}
