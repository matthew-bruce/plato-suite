# ADR-030 — Despatch Migration Strategy into Plato Suite

Date: 2026-04-19
Status: Accepted

## Decision
Despatch (pi-planning-tool) is migrated into the Plato Suite monorepo
as `apps/dispatch`. The view and business logic components are preserved
largely intact. The following changes are mandatory before the migration
is considered complete:

1. **Vendor abstraction** — all `@supabase/supabase-js` direct imports
   replaced with `@plato/schema` imports
2. **Token system** — hardcoded hex values in `tailwind.config.ts`
   replaced with `@plato/config` preset and `--rmg-*` / `--plato-*`
   CSS variables
3. **Auth** — `@plato/auth` wired in (currently no auth in Despatch)
4. **Schema reconciliation** — shared tables (`platforms`, `teams`,
   `arts`, `workstreams`) point to core schema; Despatch-specific
   tables (`planning_cycles`, `features`, `stories`, `dependencies`,
   `sprints` etc.) live in Despatch-owned migrations
5. **Client fingerprint removal** — RMG-specific seed data moved to
   `scripts/seed-demo.ts`; demo data replaced with generic fictional
   dataset; Royal Mail logo removed from codebase

## What is preserved
- All five main views: Sorting Frame, Dashboard, Team Planning, 
  Dependencies, Activity Feed
- The planning logic in `lib/planning/` (sprint generation, sprint
  mapping, sprint numbering) — migrated to `@plato/planning` utility
  or kept in `apps/dispatch/lib/planning/`
- The import pipeline (`lib/admin/imports.ts`) — rebuild sequence
  order is critical and must not change
- The server component data fetching pattern — already matches
  ADR-028
- 53 existing passing tests

## Schema extension pattern
`planning_increments` lives in core schema (ADR-017) with only the
lightweight fields (id, name, slug, dates). Despatch-specific
operational fields are added via a Despatch-owned migration:

```sql
-- apps/dispatch/migrations/001_planning_increment_extensions.sql
ALTER TABLE planning_increments
  ADD COLUMN is_active         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN is_archived       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN current_stage     SMALLINT,
  ADD COLUMN sprint_count      INTEGER,
  ADD COLUMN sprint_length_days INTEGER;
```

## Phase 2 renames (deferred)
The following DB renames are deferred to a dedicated session after
migration is stable:
- `planning_cycles` → `planning_increments` (already done in core)
- `initiatives` → `value_streams`
- `team_cycle_participation` → `team_pi_participation`
- `dependency_type` etc. → remove redundant prefix

## Consequences
- Despatch cannot be migrated until Nucleus has established the
  monorepo structure, `@plato/schema`, and the shared component
  library — Nucleus is the prerequisite
- The Zustand store and localStorage pattern in Despatch is retained
  for demo mode and the Triage page — it is not replaced with
  server-side data fetching until those features are connected to
  Supabase
- The existing Despatch Supabase project (`mwhpgrmnphfyqscxobuw`)
  remains the data source during migration — no data migration is
  required until go-live
