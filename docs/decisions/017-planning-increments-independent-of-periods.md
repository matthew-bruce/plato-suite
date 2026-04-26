# ADR-017 — Planning Increments and Financial Periods Are Separate Concerns

Date: 2026-04-19
Status: Accepted

## Decision
`planning_increments` (PI Planning cycles) and `periods` (financial/
reporting periods) are completely separate tables with no foreign key
relationship between them. They may coincidentally align in time, but
they are independently managed and serve different purposes.

| Concept | Table | Owner | Nature |
|---|---|---|---|
| Financial/reporting periods | `periods` | Nucleus | Fixed by business calendar. Quarterly. Feed the finance calculator. |
| PI Planning cycles | `planning_increments` | Despatch | Fully flexible dates. Can slip, shorten, overlap. |

## Context
A PI (Program Increment) in SAFe is a planning and delivery cycle —
typically 8–12 weeks with flexible dates that can change as planning
matures. A financial period is fixed by the business calendar — Q1 is
Q1 regardless of delivery cadence. Conflating them creates a dependency
between financial reporting and delivery planning that does not exist
in the real world.

## Why planning_increments lives in core schema
Despite being primarily a Despatch concern, `planning_increments` lives
in the core schema (not in a Despatch-only migration) because other
modules may reference PI boundaries. A Roadmap item (Cursus) may be
aligned to PI5. A Chronicle evidence entry may be tagged to a PI.
Keeping the table in core enables these cross-module references without
creating a dependency on Despatch.

The Despatch-specific operational fields (`is_active`, `is_archived`,
`current_stage`, `sprint_count`, `sprint_length_days`) live in a
Despatch-owned extension migration, not in core.

## Consequences
- No FK between `periods` and `planning_increments`
- The finance calculator never queries `planning_increments`
- Despatch never queries `periods`
- Cross-module features (e.g. "show roadmap items per PI") join
  on date ranges, not on FKs
- Despatch may operate entirely without `periods` existing
- Nucleus may operate entirely without `planning_increments` existing
