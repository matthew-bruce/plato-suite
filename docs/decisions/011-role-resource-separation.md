# ADR-011 — Role/Resource Separation, No History Table

Date: 2026-04-19
Status: Accepted

## Decision
Roles and Resources are separate tables. A Role is a slot that can be
filled by a Resource. A Role can be vacant (`resource_id IS NULL`).
A Resource can fill multiple Roles simultaneously (split allocation).
There is no role assignment history table.

## Context
The naive model — a `role` column directly on a `resource` row — breaks
immediately when a person fills two roles, or when a role is vacant.
A separate `roles` table with a nullable `resource_id` FK supports both
cases cleanly.

History tracking (who filled role X between dates Y and Z) was
explicitly considered and rejected for v1. If history is ever needed,
Chronicle owns it as an evidence-capture concern — it is not a schema
concern for Nucleus.

## Data model
```
role_definitions  — lookup: ENG, DO, QA, PO, AC, SA
roles             — actual slots: ENG-001, ENG-002, DO-001 etc.
  resource_id     — nullable FK to resources. NULL = vacant slot.
resources         — people. No role field. No platform field.
```

## Key rules
- `roles.resource_id` is nullable — vacant role = NULL
- The same `resource_id` can appear on multiple `roles` rows —
  this represents a split allocation, not a data error
- Role codes (`ENG-001`) are monotonic per role_code, immutable,
  and not team-scoped
- Moving a person to a different role in the UI can mean either
  updating `roles.resource_id` (moving the person, keeping the slot)
  or updating both (moving the slot and the person) — this is a UI
  decision, not a schema constraint

## Consequences
- No history table in the schema — past assignments are not queryable
  without Chronicle integration
- The finance calculator uses `resource_period_allocations` for
  historical snapshots, which captures the rate at time of snapshot —
  this is sufficient for financial reporting without a full history table
- UI must handle the vacant/filled distinction clearly
