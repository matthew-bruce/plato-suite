# ADR-007 — Single-Tenant Deployment Model

Date: 2026-04-19
Status: Accepted

## Decision
Each Plato installation runs against a single-organisation database.
There are no tenant_id columns. The `organisations` table exists as a
single-row configuration anchor, not as a multi-tenancy mechanism.

## Context
Multi-tenancy adds significant schema complexity: row-level security
policies must partition every query by tenant, foreign key relationships
become harder to reason about, and data isolation bugs are catastrophic.
The primary deployment model for Plato is one installation per client.
The Plato SaaS demo is itself a single-organisation installation.

## Alternatives Considered
**Multi-tenant with organisation_id on every table** — rejected. The
performance and complexity cost is not justified for v1. If multi-tenancy
is ever required, it is an explicit future migration, not a retrofit.

**Schema-per-tenant (Postgres schemas)** — rejected. Incompatible with
Supabase's RLS model and adds operational overhead for migrations.

## Consequences
- No `organisation_id` denormalisation across tables
- RLS policies gate on `plato_is_active_user()` / `plato_is_superuser()`
  rather than tenant ID
- Swapping between client installations means pointing env vars at a
  different database, not switching a query parameter
- Multi-tenancy, if ever needed, requires an explicit ADR and migration
