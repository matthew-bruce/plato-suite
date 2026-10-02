// A small schedule covering every row type the totals rules treat differently:
// PR, F_Gov, a stale F_Gov row whose stored is_chargeable is wrongly `true`,
// BAU (real days, £0), NPC (real cost, excluded), a vacant seat, a CG→TCS
// mover with two rows, and one Ad-hoc cost item.
//
// base_total_pence / vat_total_pence are derived with the production formulas
// (allocationBasePence / allocationVatPence), the same way the schedule query
// derives them, rather than typed in by hand.

import { vatRateMilliPct } from '@plato/schema'
import { allocationBasePence, allocationVatPence } from '../../scheduleTotals'

/** 7.082%, as the exact integer rate every money figure is built with. */
export const MIXED_VAT_RATE = vatRateMilliPct(7.082)

type Team = { teamId: string; teamName: string; capacitySplit: number }
const team = (teamName: string, capacitySplit = 1): Team => ({ teamId: teamName.toLowerCase(), teamName, capacitySplit })

export interface MixedRow {
  allocation_id: string
  resource_id: string | null
  resource_name: string | null
  role_title: string | null
  resource_location: string | null
  planview_code: string
  /** As stored — deliberately stale (true) on one F_Gov row. */
  is_chargeable: boolean
  capacity_days: number
  day_rate: number
  utilisation_percent: number
  vat_applies: boolean
  base_total_pence: number
  vat_total_pence: number
  teams: Team[]
}

function row(
  allocation_id: string,
  resource_id: string | null,
  planview_code: string,
  capacity_days: number,
  day_rate: number,
  utilisation_percent: number,
  teams: Team[],
  is_chargeable = planview_code === 'PR',
): MixedRow {
  const costed = { planview_code, capacity_days, day_rate, utilisation_percent, vat_applies: true }
  return {
    allocation_id,
    resource_id,
    resource_name: resource_id,
    role_title: 'Role',
    resource_location: 'onshore',
    is_chargeable,
    ...costed,
    base_total_pence: allocationBasePence(costed),
    vat_total_pence: allocationVatPence(costed, MIXED_VAT_RATE),
    teams,
  }
}

export const MIXED_ROWS: MixedRow[] = [
  row('a-pr', 'alice', 'PR', 60, 50_000, 100, [team('Alpha')]),
  row('a-fgov', 'bob', 'F_Gov', 40, 60_000, 50, [team('Alpha', 0.5), team('Beta', 0.5)]),
  row('a-fgov-stale', 'carol', 'F_Gov', 20, 55_000, 100, [team('Beta')], /* stale */ true),
  row('a-bau', 'matt', 'BAU', 64, 0, 100, [team('Alpha')]),
  row('a-npc', 'dan', 'NPC', 10, 45_000, 100, [team('Beta')]),
  row('a-vacant', null, 'PR', 30, 40_000, 100, [team('Alpha')]),
  row('a-mover-cg', 'eve', 'PR', 25, 50_000, 100, [team('Alpha')]),
  row('a-mover-tcs', 'eve', 'PR', 35, 46_000, 100, [team('Alpha')]),
]

export const MIXED_COST_ITEMS = [
  {
    cost_item_id: 'c-adhoc',
    label: 'Licences',
    cost_item_category: 'ADHOC',
    amount_pence: 100_000,
    vat_applies: true,
    is_confirmed: true,
  },
]

/** The rows the page displays with the Alpha team filter active. */
export const MIXED_ALPHA_ROWS = MIXED_ROWS.filter((r) => r.teams.some((t) => t.teamName === 'Alpha'))
