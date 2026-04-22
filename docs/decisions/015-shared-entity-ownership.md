# ADR-015 — Shared Entity Ownership

Date: 2026-04-19
Status: Accepted

## Decision
TypeScript types for all database tables live in `@plato/schema` — the
single type registry for the entire suite. CRUD UI for shared entities
(those referenced by more than one module) may be implemented in any
module that needs it, but must use the shared types and the shared
`@plato/schema` data access layer.

## The three tiers

| Tier | Definition | Examples |
|---|---|---|
| Platform primitives | Required by all modules. No module runs without these. | `organisations`, `users` |
| Shared entities | Referenced by more than one module. Table in `@plato/schema`. | `platforms`, `teams`, `workstreams`, `arts`, `resources`, `suppliers` |
| Module entities | Owned and written by one module only. Others may read via FK. | `roles`, `planning_increments`, `periods`, `cost_configurations` |

## The standalone CRUD rule
A richer management experience may exist in one module, but no other
module may depend on it. Each module that needs to reference a shared
entity must implement sufficient CRUD to operate standalone.

Shared entity CRUD is implemented via:
- `@plato/schema` — server-side data access functions
- `@plato/ui` — shared form/display components where reuse is justified

## Context
Without this rule, modules develop hidden dependencies on each other.
Nucleus becomes a required prerequisite for Despatch, which becomes a
required prerequisite for Cursus. This violates the independently-
deployable principle.

## Consequences
- Nucleus provides the richest management UI for platforms, teams,
  resources, suppliers. But Despatch and Cursus can manage these
  entities themselves if deployed standalone.
- Schema changes to shared entities require coordinating across all
  modules that reference them — use an ADR
- Module-specific fields on shared entities go in separate
  module-owned tables, not on the shared table itself
