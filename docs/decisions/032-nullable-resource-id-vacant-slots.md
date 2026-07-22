# ADR-032 — Nullable `resource_id` for Vacant Schedule Slots

**Date:** 2026-05-28 (decision and migration applied); ADR written retroactively 2026-07-22
**Status:** Accepted

---

## Decision

`resource_period_allocations.resource_id` is nullable. A `NULL` `resource_id`
row represents a **vacant/TBC cost placeholder**: a role that exists and has
an agreed rate in a Statement of Work or Purchase Order, but no named person
has been identified yet.

```sql
ALTER TABLE resource_period_allocations
  ALTER COLUMN resource_id DROP NOT NULL;
```

---

## Context

The finance calculator needs to represent cost commitments that are real —
budgeted, contracted, agreed — before a specific person is attached to them.
Requiring `resource_id` to be `NOT NULL` made this impossible: a vacant seat
in a SoW/PO had nowhere to live in the schema until someone was actually
named against it, which understated committed cost and made vacant-seat
tracking a spreadsheet-only exercise.

`role_title` (added in migration `005_schedule_display_fields.sql`) already
exists as a snapshot column independent of any FK to `resources`, so it was
already positioned to describe a role with no attached person.

---

## Approved approach

- A `NULL` `resource_id` row is a valid, permanent state — not a transient
  placeholder awaiting cleanup.
- `role_title` describes the role for a vacant row.
- All cost and day calculations (`day_rate × capacity_days × utilisation_percent`)
  apply identically to vacant rows as to named ones — a vacant seat still
  carries its agreed rate and days.
- The UI renders a `NULL` `resource_name` as **"TBC"** or **"Vacant"** with a
  clear visual treatment (e.g. italic styling) — never as a broken or empty
  row.
- When the person is identified, `resource_id` is populated in place. The
  cost line was always present; only the attribution changes. See migration
  `019_resource_conflict_connect_rpcs.sql`'s `connect_resource_keep_existing`
  / `connect_resource_use_vacant` RPCs for the atomic fill-vacant-seat paths,
  including same-period conflict resolution when the incoming resource
  already holds another allocation.
- `resource_team_assignments.resource_id` was separately made nullable in
  migration `015_rta_allocation_id.sql`, keyed instead on `allocation_id`, so
  a vacant seat's team assignments can exist before a resource is attached.

---

## Consequences

- Vacant/TBC rows are first-class data, not a UI-only concept — they group,
  cost, and total identically to named allocations.
- `supplier_id` (migration `007` in the originally planned numbering, applied
  as part of the same body of work) must be set explicitly on vacant rows
  since there is no `resources.supplier_id` to fall back on; the schedule
  page groups by `resource_period_allocations.supplier_id`, never
  `resources.supplier_id`, for this reason.
- One Q4 Capgemini row was the original motivating case: "Non-Factory Service
  Engineer" (DevOps Senior Consultant, PR, 54 days, £209.48/day, offshore
  India) — inserted as a vacant row once this migration was live.

## Documentation note

This decision was implemented and applied directly against the live Supabase
project on 2026-05-28, but the ADR and the migration file were never
committed to the repo at the time — see
`026_rpa_nullable_resource_id_retroactive.sql` for the backfilled migration
record and the process rule added to `PROJECT_INSTRUCTIONS.md` to prevent
this happening again.
