/**
 * Whether an allocation is chargeable (cross-charged against a PR ticket):
 * PR and nothing else. Derived from planview_code alone.
 *
 * Never read resource_period_allocations.is_chargeable for this — that stored
 * column can disagree with planview_code (live F_Gov rows carry `true`, via
 * the column's `true` default and the create-period copy-forward), and every
 * reader must give the same answer the planview code does.
 */
export function isChargeableRow(planviewCode: string | null | undefined): boolean {
  return planviewCode === 'PR'
}
