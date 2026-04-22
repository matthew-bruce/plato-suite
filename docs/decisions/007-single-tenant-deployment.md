# ADR-007 — Single-Tenant Deployment Model

**Date:** 2026-04-19
**Status:** Accepted
**Supersedes:** Early design sketches that proposed a multi-tenant shared-database model

---

## Decision

Each Plato deployment is single-tenant. One Supabase project serves one organisation. The `organisations` table exists as a single-row configuration anchor, not as a partition key for multiple tenants.

---

## Context

During initial schema design (April 2026), the first instinct was to build multi-tenant from day one — denormalising `organisation_id` onto every table, enforcing cross-tenant isolation via RLS policies that filtered by the authenticated user's organisation membership.

The argument for that approach was: "Plato will eventually serve many clients from shared infrastructure, so model for it now." This is a common and reasonable instinct.

However, when examined against Plato's actual deployment model, the assumption didn't hold.

Plato's enterprise deployment target is **Azure Container Apps + self-hosted Supabase**, one stack per client. RMG get their own database. Another enterprise client gets theirs. This is the model clients expect, the model that satisfies their data residency requirements, and the model Plato will lead with in sales.

The SaaS model (many clients, shared infrastructure) is a later-stage concern. Designing the database schema for it now — before a single paying SaaS customer exists — creates real cost today (extra column on every table, more complex RLS policies, a second `organisation_id` concept to explain to every contributor) in exchange for a hypothetical future benefit.

---

## Alternatives Considered

### Option A — Multi-tenant shared database (rejected)

Denormalise `organisation_id` onto every table. RLS policies filter by authenticated user's org membership via a `plato_current_user_orgs()` helper.

**Why rejected:**
- Every new table requires remembering to add `organisation_id` and a matching RLS policy. Forgetting either creates a silent data leak.
- Performance cost on every query (even when the table will only ever have one tenant's data).
- Adds conceptual overhead for contributors who are building for a single client.
- Not required by any current deployment target. We would be solving a problem we don't have.

### Option B — Schema-per-tenant (rejected)

Each client gets their own Postgres schema within a shared database.

**Why rejected:**
- Migration operational cost scales linearly with client count.
- Breaks shared connection pooling in Supabase.
- Forces schema-aware queries throughout application code.
- Not supported cleanly by Supabase's tooling.

### Option C — Single-tenant per deployment (accepted)

One Supabase project per client. The `organisations` table holds one row — the config anchor for that deployment (name, slug, type, theme). No cross-tenant RLS. No `organisation_id` foreign key on every table.

---

## Decision

Option C. Single-tenant deployment.

The `organisations` table:
- Contains exactly one row per deployment
- Serves as a configuration anchor (display name, branding, `tenant_type: 'demo' | 'production'`)
- Is **not** used as a partition key — other tables do not carry `organisation_id`

RLS policies are auth-check only — "is the user authenticated?" — not cross-tenant scope checks.

---

## Migration Path to Multi-Tenant

If Plato later needs to serve multiple organisations from a single database (e.g. a true SaaS with hundreds of small clients on shared infrastructure), the migration is:

1. Add `organisation_id` to all tenant-scoped tables in a single migration
2. Backfill with the existing single organisation's ID
3. Replace auth-check-only RLS with cross-tenant scope RLS
4. Update `@plato/schema` client to inject `organisation_id` into all queries

This is non-trivial but it is a contained migration. The risk of doing it later is lower than the cost of maintaining the complexity now.

---

## Consequences

**Positive:**
- Schema is simpler. No `organisation_id` column on every table.
- RLS policies are trivial — auth check only.
- Contributors don't need to think about tenant scoping when adding new tables.
- Aligns with the actual deployment target (dedicated infrastructure per enterprise client).

**Negative:**
- Migrating to multi-tenant in future requires a non-trivial schema change.
- SaaS at scale (shared infrastructure, hundreds of small tenants) is not supported without that migration.
- Developer must remember this constraint when designing features that could span multiple tenants in future.

---

## Note on `organisation_id` in existing tables

The core schema (`001_core_schema.sql`) does include `organisation_id` on the `organisations` table itself and on a small number of reference tables — this is by design for those specific cases and does not represent a multi-tenant pattern. It is not propagated to all tables.
