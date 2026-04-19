# ADR-008 — Soft Deletes with Partial Indexes

Date: 2026-04-19
Status: Accepted

## Decision
All deletions are soft deletes. Records are never hard deleted. Every
table has a `deleted_at TIMESTAMPTZ` column (nullable). NULL means active.
All unique constraints and lookup indexes are partial: `WHERE deleted_at
IS NULL`. The `@plato/schema` client must filter `deleted_at IS NULL` by
default on every query.

## Context
Hard deletes permanently destroy data. In a financial and planning tool
where historical records matter (rate cards, period allocations, role
assignments), silent data loss is unacceptable. Soft deletes preserve
audit trail and support recovery from accidental deletion.

## Alternatives Considered
**Hard delete with audit log table** — rejected. More complex, requires
maintaining a separate log schema per entity. Soft deletes are simpler
and sufficient.

**Archival to separate table** — rejected. Adds complexity without
meaningful benefit at this scale.

## Consequences
- Every query must include `.is('deleted_at', null)` — enforced at
  the `@plato/schema` abstraction layer
- Partial indexes on `deleted_at IS NULL` maintain query performance
- Unique constraints are partial so a deleted slug can be reused
- UI must never expose a hard delete option — confirmation dialogs
  result in setting `deleted_at`, never a DELETE statement
- Restore functionality is possible without any data recovery tooling
