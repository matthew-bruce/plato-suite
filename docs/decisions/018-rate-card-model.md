# ADR-018 — Rate Card Model: Supplier + Role Scoped with Resource Override

Date: 2026-04-19
Status: Accepted

## Decision
Day rates are supplier + role-type scoped via `supplier_rate_cards`.
Individual resources may have a `day_rate_override` which takes
precedence over the rate card. All rates are stored in integer pence.

```sql
supplier_rate_cards (
  supplier_id        — FK to suppliers
  role_definition_id — FK to role_definitions (ENG, DO, QA etc.)
  day_rate           — integer pence
  effective_from     — date this rate takes effect
)

resources (
  ...
  day_rate_override  — integer pence, nullable
                     — if set, ignores rate card entirely
)
```

## Rate resolution
1. If `resources.day_rate_override IS NOT NULL` → use override
2. Otherwise → find the most recent `supplier_rate_cards` row for
   this resource's supplier + their current role definition where
   `effective_from <= today`

The view `resources_current_rate` encapsulates this logic for UI use.

## Context
The per-supplier, per-role model reflects how most organisations
actually structure contractor and supplier agreements. When a supplier
renegotiates rates, one row update in `supplier_rate_cards` updates
all resources on that supplier/role combination automatically.

The override exists for the minority of cases where an individual
has a negotiated rate that differs from the standard card.

## Sensitivity
Both tables are commercially sensitive:
- `supplier_rate_cards` — superuser-only RLS
- `resources.day_rate_override` — write-gated to superuser via trigger;
  read-gating is the `@plato/schema` client layer's responsibility
  until a `resources_non_sensitive` view is added

## Consequences
- Day rate is never stored directly on a resource row (except override)
- Rate card changes are not retroactive — closed period snapshots
  retain the rate that was current at snapshot time (ADR-013)
- The finance calculator must resolve rates at snapshot time, not
  at query time
- Money is always stored as integer pence — never as DECIMAL or FLOAT.
  Display formatting to £ is the UI's responsibility.
