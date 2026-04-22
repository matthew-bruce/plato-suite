# ADR-013 — Temporal Modelling via Period Snapshots

Date: 2026-04-19
Status: Accepted

## Decision
Financial history is captured via period snapshots in
`resource_period_allocations`, not via temporal tables or audit logs.
Each snapshot records the day rate, utilisation, and capacity for a
resource in a specific period in a specific role. Closed periods become
read-only. Past rates are preserved permanently.

## Context
The primary financial use case is a quarterly day-rate spreadsheet:
"What was the blended rate for Platform X in Q3?" This requires knowing
what rate each resource was on in that quarter, not their current rate.

Temporal tables (valid-from / valid-to on the resources row itself)
were considered and rejected — they add significant query complexity
for a use case that is already well-served by the snapshot model.

## The snapshot model
```
periods                       — Q1 2026, Q2 2026, etc.
resource_period_allocations   — resource X, period Y, role Z:
  day_rate                    — rate at time of snapshot (pence)
  utilisation_percent         — e.g. 100.00, 50.00
  capacity_days               — working days in period × utilisation
  is_chargeable               — whether this allocation is billable
```

When a period is closed (`period_status = 'closed'`), the allocations
for that period are locked. Rate changes after that point do not
retroactively affect closed periods.

## Consequences
- The finance calculator reads from `resource_period_allocations`,
  not from `resources.day_rate_override` or `supplier_rate_cards` directly
- A resource's current rate is in `resources_current_rate` view —
  historical rates are in `resource_period_allocations`
- Correcting a past period requires reopening it (admin action) —
  this is intentional friction to prevent accidental historical edits
- `resource_period_allocations` is superuser-only RLS — commercially
  sensitive data
