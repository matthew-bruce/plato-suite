# ADR-009 — Timestamp Nullability Convention

Date: 2026-04-19
Status: Accepted

## Decision
`created_at` and `updated_at` are `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
on every table. `deleted_at` is `TIMESTAMPTZ` (nullable) — NULL means
active, a value means soft-deleted. No other timestamp columns are
nullable without explicit justification in a separate ADR.

## Context
Nullable `created_at` or `updated_at` creates ambiguity: does NULL mean
"unknown" or "not yet set"? In a system where records are always created
by a known code path, there is no legitimate reason for these to be null.
The `updated_at` column is maintained by the shared `plato_set_updated_at()`
trigger — it is never null after the first write.

## Consequences
- All migrations must include `NOT NULL DEFAULT NOW()` on created_at
  and updated_at
- The nullable exception for deleted_at is intentional and load-bearing
  — it is how active vs deleted is distinguished
- Any future timestamp column (published_at, synced_at, etc.) defaults
  to nullable unless there is a strong reason otherwise
