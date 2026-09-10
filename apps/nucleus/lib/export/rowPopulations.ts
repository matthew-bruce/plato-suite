// Which rows count, for what — the two questions the exported workbooks ask
// of every allocation, kept deliberately apart.
//
// "Does this row cost the platform money" and "is this row a person we are
// showing" are different questions with different answers, and collapsing
// them into one "which rows count" filter is a regression that has already
// happened repeatedly on the Rate Calculator export (BAU dropping out of
// headcount because it was excluded from cost). The two functions below are
// named for the question each answers so the distinction is visible at every
// call site rather than living in a comment.
//
//   Row                          | getIncludedCostRows | getAllNamedPersonRows
//   PR, named person             | yes                 | yes
//   F_Gov, named person          | yes                 | yes
//   BAU, named person            | no  (costs £0)      | yes
//   NPC, named person            | no                  | yes
//   PR, vacant seat (TBC)        | yes (it has a rate) | no  (nobody in it)
//
// Note the last two rows especially: neither population contains the other.
// A BAU person is headcount without cost; a vacant PR seat is cost without
// headcount. Anything that tries to drive both from one predicate gets one
// of them wrong.

// Relative rather than '@/…': this module is unit-tested, and vitest in this
// repo runs without the Next.js path alias, so an aliased import here would
// make the test files unloadable.
import { isIncludedInBaseCost } from '../schedule/ui'

/** The minimum shape both questions need to be answerable. */
export interface PopulationRow {
  planview_code: string | null | undefined
  /** NULL for a vacant / TBC seat — a budgeted row with nobody in it yet. */
  resource_id: string | null
}

/**
 * Whether this row is a named person: someone with a `resources` row behind
 * the allocation, as opposed to a vacant seat still to be filled.
 *
 * Deliberately says nothing about planview code. The Platform Schedule export
 * shows everyone relevant to the platform — including the BAU and NPC rows the
 * Rate Calculator hides, and including people from another business unit or
 * another supplier — so its headcount asks only "is there a person here".
 */
export function isNamedPerson(row: PopulationRow): boolean {
  return row.resource_id !== null
}

/**
 * The rows that count toward COST — every money total, subtotal and blended
 * rate, in both export variants.
 *
 * Delegates to isIncludedInBaseCost, the Schedule page's own rule, rather than
 * restating it: the Platform Schedule export must produce cost figures
 * identical to the Rate Calculator's, and the only way to guarantee that is
 * for both to run the same predicate rather than two that happen to agree.
 */
export function getIncludedCostRows<T extends PopulationRow>(rows: T[]): T[] {
  return rows.filter((row) => isIncludedInBaseCost(row.planview_code))
}

/**
 * The rows that count toward HEADCOUNT on the Platform Schedule export —
 * every named person on the export, whatever their planview code and whatever
 * supplier or business unit they come from.
 *
 * NOT filtered by isIncludedInBaseCost. That is the entire point: a BAU person
 * costs the platform nothing and still shows up on a SOW reconciliation, so
 * they are headcount. The Rate Calculator's own headcount is a different
 * question again (isCountedInHeadcount in lib/schedule/ui) and is not affected
 * by this function.
 */
export function getAllNamedPersonRows<T extends PopulationRow>(rows: T[]): T[] {
  return rows.filter(isNamedPerson)
}
