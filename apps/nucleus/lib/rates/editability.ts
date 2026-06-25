// Shared rate-editability check. Both rate-setting surfaces — the dedicated
// Blended Rates page and the inline widget on the Schedule page — gate edits
// through this one function so the rule lives in a single place.
//
// Three states, driven by a period's locked flag and status:
//   - locked              → hard-blocked, no edit affordance, not dismissible.
//   - unlocked + draft     → fully editable, no warning.
//   - unlocked + active/historic → editable, but a soft warning must be
//     acknowledged first (changing the rate affects already-active/historic
//     figures).
//
// A null period (the chosen effective-from falls within no period yet) is
// treated as freely editable — there is no active/historic context to disturb.

import type { PeriodStatus } from '@plato/schema'

export interface RateEditPeriod {
  locked: boolean
  period_status: PeriodStatus
}

export type RateEditState =
  | { kind: 'locked' }
  | { kind: 'editable' }
  | { kind: 'warn'; message: string }

export const RATE_EDIT_WARNING =
  'This period is no longer in draft — changing the rate now affects already-active or historic figures. Continue?'

export function getRateEditability(period: RateEditPeriod | null): RateEditState {
  if (!period) return { kind: 'editable' }
  if (period.locked) return { kind: 'locked' }
  if (period.period_status === 'draft') return { kind: 'editable' }
  // active or historic
  return { kind: 'warn', message: RATE_EDIT_WARNING }
}
