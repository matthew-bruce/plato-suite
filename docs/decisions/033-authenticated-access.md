# ADR-033 — Authenticated Access (Supabase Auth) for Nucleus and Tessera

**Date:** 2026-07-22
**Status:** Accepted

**Supersedes:** ADR-031 (Temporary Anon RLS Policies), ADR-TESS-001 (Tessera: Open RLS, No Authentication for MVP)
**Implements (first phase of):** ADR-004 (OIDC-Standard Authentication), ADR-003 (Vendor Abstraction Pattern)

---

## Decision

Both apps now require a logged-in Supabase Auth session. Email/password only in
this phase (no signup, no magic link, no MFA, no cross-app SSO — those are
separate later ADRs). All authentication lives behind a new `@plato/auth`
package; application code never calls `supabase.auth.*` directly.

Every `USING (true)` / anon RLS policy that made the databases publicly
readable/writable has been removed (migration `024_authenticated_rls.sql`).

---

## Context

Before this change, both apps were publicly reachable Vercel URLs with no login
wall, and every table carried open RLS policies (`USING (true)` and/or `anon`
grants). Anyone with a URL could read supplier day rates, cost configurations
and KT programme data, and in most cases write to them. ADR-031 and ADR-TESS-001
both explicitly flagged this as a temporary, pre-production state to be closed
before any real deployment. This ADR closes it.

---

## What was built

### `@plato/auth` (new package)

The only place `@supabase/ssr` / `supabase.auth.*` is used. Public API is
provider-agnostic (generic names, not Supabase-shaped), so the eventual swap to
OIDC (ADR-004) is a change inside this package, not across both apps (ADR-003):

- `signIn(email, password)`, `signOut()`, `getCurrentUser()`,
  `requestPasswordReset(email, redirectTo?)`, `updatePassword(newPassword)`,
  `onAuthStateChange(callback)` — client-side, cookie-backed.
- `createServerSupabaseClient()` (`@plato/auth/server`) — cookie-aware server
  client for server components / actions / route handlers.
- `updateSession(request)` (`@plato/auth/middleware`) — refreshes the session
  and returns the verified user for each app's middleware. Uses
  `auth.getUser()` (revalidates the JWT), never `getSession()`.
- Pure helpers `isPublicPath()`, `isValidEmail()`, `validatePasswordReset()`
  (unit-tested).

### Middleware (both apps)

`apps/*/middleware.ts` redirect any request without a valid session to `/login`,
except the public auth routes (`/login`, `/forgot-password`, `/reset-password`,
`/auth/*`).

### Auth pages (both apps)

`/login`, `/forgot-password`, `/reset-password` (RMG-styled, ADR-023) plus an
`/auth/callback` route handler that exchanges the password-reset code for a
session. Login and forgot-password never reveal whether an email has an account.

### Data-layer changes

- **Tessera** previously bypassed `@plato/schema` with a module-level anon
  client (an ADR-027 violation). It now routes through `@plato/schema`: server
  components use the cookie-aware `getSupabaseServerComponentClient()` (queries
  as the logged-in user, so the new authenticated RLS is satisfied), client
  components use the cookie-aware `getSupabaseBrowserClient()`.
- **`@plato/schema`'s** browser client is now `@supabase/ssr`'s
  `createBrowserClient` (cookie-backed) so client-side queries in **both** apps
  carry the logged-in session for RLS.

### RLS (migration 024)

- **Nucleus** already had the correct ADR-021 role-gated policies
  (`plato_is_active_user()` generally, `plato_is_superuser()` on
  `cost_configurations` / `supplier_rate_cards` / `resource_period_allocations`)
  underneath the ADR-031 open policies. Per the SCHEMA_DESIGN §4a "dead
  auth-gated policy" trap, the open policies OR'd alongside and negated them, so
  the migration **drops every open/anon policy and adds nothing** — leaving the
  ADR-021 policies as the sole gate. The three-tier role model is unchanged.
- **Tessera** has no role model; its open policies are replaced with a single
  `FOR ALL TO authenticated USING (auth.role() = 'authenticated')` policy per
  table. No sensitive-data tiering was invented for Tessera in this phase.

Verified post-migration: `pg_policies` shows **zero** `USING (true)` or anon
policies across the whole `public` schema; the ADR-021 policies are intact; each
of the 17 `tessera_*` tables has exactly one authenticated policy.

---

## Consequences

- Both apps are login-walled. No public data exposure.
- Nucleus server reads still use the service-role client (bypasses RLS); the
  middleware is the gate for server-rendered pages, RLS is defence-in-depth for
  client-side queries. `SUPABASE_SERVICE_ROLE_KEY` must be set in Vercel for
  Nucleus (unchanged requirement, called out in ADR-031's removal checklist).
- Nucleus client-side queries (and the superuser-gated tables) require the
  logged-in user to have a non-deleted `public.users` row — see "Follow-ups".
- No new environment variables: auth uses the existing
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Follow-ups (explicitly out of scope here)

- **User provisioning.** A `public.users` row (with `user_role`) must exist for
  a logged-in user to pass `plato_is_active_user()` / `plato_is_superuser()`.
  No auto-provisioning trigger and no seeded users are included (deliberate).
  The initial superuser row for the first account is inserted manually.
- **`platform_cost_items` / `period_cost_snapshots`** only ever had open
  policies (never an ADR-021 role-gated one), so after the drop they are
  service-role-only. Server reads (the normal path) are unaffected; a
  client-side read of `platform_cost_items` in the Schedule page will return
  empty until it is either moved server-side or given a role-gated policy — a
  deliberate follow-up, not resolved here (erring to more-restrictive).
- OIDC provider swap (ADR-004), magic link, MFA, cross-app SSO — later ADRs.
