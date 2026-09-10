// Row-visibility rule for the Rate Calculator export specifically. This is a
// third, independent question from the two lib/schedule/scheduleTotals.ts
// already answers — "does this row cost anything" (isIncludedInBaseCost) and
// "does this row count as a person" (isCountedInHeadcount): "is this row
// shown at all". Those two already distinguish BAU (a real, known person,
// £0 cost, but visible and counted) from NPC (£0 cost, not counted); this
// file is about NPC's other property — it must not be listed anywhere in
// this export, on any of its three tabs.
//
// NPC-coded roles never appear on supplier SOWs and are irrelevant to
// Finance's reconciliation — their mere presence in the file invites
// questions the business doesn't want asked. BAU rows are real, known
// people Finance already expects to see, so they stay visible everywhere;
// only NPC is hidden.
//
// Scoped to the Rate Calculator export (this route only). The separate Team
// Schedule export (not yet built, per the 2026-09 brief) is explicitly the
// "show everything including NPC" variant and must not import this.

export function isVisibleInRateCalculatorExport(planviewCode: string | null | undefined): boolean {
  return planviewCode !== 'NPC'
}
