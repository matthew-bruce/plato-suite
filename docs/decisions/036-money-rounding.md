# ADR-036 — One money-rounding rule

**Date:** 2026-10-01
**Status:** Accepted
**Builds on:** ADR-029 (money stored as integer pence)

---

## Decision

**Money: per-row integer pence, half-up, VAT via integer rate in thousandths
of a percent; round only at display.**

- **Row base**, whole pence: `basePence = round_half_up(day_rate_pence × capacity_days × utilisation%)`.
- **Row VAT**, whole pence, integer arithmetic only. The VAT rate is held as
  an integer in thousandths of a percent (7.082% → `7082`), and
  `vatPence = round_half_up(basePence × 7082 / 100000)`. A row with
  `vat_applies = false` has `vatPence = 0`.
- **Totals** are sums of row pence. Nothing is rounded again on the way up.
- **Team proration** prorates a row's already-computed pence and does not
  round. Rounding happens only when the figure is displayed, so a
  team-filtered view can differ from the unfiltered total by pennies. That is
  expected. Do not force the two to tie.
- **Locked periods** use the same function, with the period's frozen VAT rate
  (`period_cost_snapshots`, via `resolveAppliedCostConfiguration*`).
- **Exports** do the same in the workbook: each detail row's base is
  `ROUND((H*I)*J,2)` and its inc-VAT is `ROUND(L*multiplier,2)`, so the
  workbook recalculates to the screen's total. Raw Data and Summary values
  come from the shared function.

There is exactly one implementation: `computeRowMoneyPence`,
`computeVatPence` and `vatRateMilliPct` in `packages/schema/src/utils/money.ts`.
No other code computes VAT. `vatRateMilliPct` parses the stored decimal
exactly. It never multiplies a float, and it throws on a rate it cannot
represent rather than rounding the rate silently.

## Context

Q3 FY 26/27 produced three different totals from the same rows:

| Surface | Total | Why |
|---|---|---|
| Schedule page | £2,892,442.35 | `1 + 7.082/100` is `1.0708199999999999` in IEEE double, so 8 rows sitting exactly on a half-penny of VAT rounded down |
| Export Summary | £2,892,442.43 | per-row, half-up, exact `1.07082` |
| Export detail sheets | £2,892,442.37 | no per-row rounding at all |

Under this rule all three give **£2,892,442.43**. The reference is pinned in
`apps/nucleus/app/api/export/schedule/__tests__/moneyRule.test.ts`.

## Consequences

- Every surface (page rows, footer, KPI cards, Copy view, both export
  Summaries, the detail sheets and Raw Data) shows the same total to the penny.
- `capacity_days` and `utilisation_percent` are normalised to their stored
  2 dp before they are multiplied. This absorbs float noise from client-side
  sums such as month breakdowns.
- `cost_configurations.vat_uplift_percent` is `numeric(10,5)`, which can store
  a rate finer than 0.001%. Such a rate would make `vatRateMilliPct` throw.
  A check constraint limiting the column to 3 dp would make that impossible
  at the source.
