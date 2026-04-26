# ADR-021 — Three-Tier User Role Model

Date: 2026-04-19
Status: Accepted

## Decision
The application has three user roles: `superuser`, `admin`, `viewer`.
Roles are enforced at the database level via Postgres Row Level Security,
not only in application code.

| Role | Access |
|---|---|
| `superuser` | Full access including commercially sensitive data: rate cards, day rates, cost configurations, period allocations. Can impersonate other roles for testing. |
| `admin` | General configuration access. Cannot see commercially sensitive data. |
| `viewer` | Read-only. Non-sensitive data only. |

## Commercially sensitive tables (superuser-only RLS)
- `supplier_rate_cards`
- `resource_period_allocations`
- `cost_configurations`
- `resources.day_rate_override` (write-gated via trigger; read-gating at client layer)

## Context
Platform Engineering tools routinely contain commercially sensitive
financial information: supplier day rates, individual contractor rates,
blended cost targets. This information must not be visible to all
users of the system. A Head of Platform needs it. A team member
browsing the org chart does not.

Enforcing this at the RLS layer rather than only in application code
means the restriction holds even for direct database queries,
API calls that bypass the application, and future integrations.

## RLS helper functions
```sql
plato_is_active_user()  — returns TRUE if auth.uid() maps to a non-deleted users row
plato_is_superuser()    — returns TRUE if that user has user_role = 'superuser'
```

Both are `SECURITY DEFINER` to avoid RLS recursion on the `users` table.

## Consequences
- Role assignment is managed via `users.user_role` — a single-field
  change is sufficient to promote or demote a user
- The `@plato/schema` client must not expose `day_rate_override` to
  non-superuser queries — a `resources_non_sensitive` view will
  be added in migration 002+
- Auth is not yet wired up (as of April 2026) — temporary anon RLS
  policies allow development access. These must be removed before
  any production deployment.
- The three-role model may be extended in future (e.g. a
  `platform_manager` role scoped to a specific platform) — any
  such extension requires an ADR
