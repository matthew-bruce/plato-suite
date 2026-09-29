# ADR-035 — Resource engagements replace supplier transitions

**Date:** 2026-09-29
**Status:** Accepted

---

## Decision

- `resources` is the person: a stable identity. `resource_engagements` holds
  one row per stint that person has on the platform (supplier, roll-on,
  roll-off). Rolling off and back on, even with the same supplier, is a new
  engagement. A supplier move is one engagement ending and another beginning.
- `resource_period_allocations.engagement_id` is set by a DB trigger
  (`resource_period_allocations_set_engagement`, migration 037). App code
  never sets it.
- Schedule days are the cost forecast. On the Resource Timeline, an
  engagement's roll-off overrides scheduled days.
- The CG hard cap is removed from the Timeline: end dates come from data only.

## Phasing

- **Phase 1 (this change):** the Timeline reads `resource_engagements` through
  a translator (`engagementsToTransitionRecords`) that produces the existing
  `TransitionRecord` shape, so the derivation engine is unchanged.
- **Phase 2 (next):** the Timeline engine is rebuilt natively on engagements.
  Status labels are derived from data on the fly (or dropped), never stored.
  The translator and `resource_supplier_transitions` are removed.

## Follow-up

- Remove `resources.resource_onboarded_date` / `resources.resource_rolloff_date`
  once Tessera no longer reads them.
