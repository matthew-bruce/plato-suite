# ADR-027 — Database Vendor Abstraction via @plato/schema

Date: 2026-04-19
Status: Accepted

## Decision
No application code in any `apps/` directory may import from
`@supabase/supabase-js` directly. All database access flows through
`@plato/schema`, which exposes `getSupabaseServerClient()` and
`getSupabaseBrowserClient()`. Swapping database vendors requires
changing one package — nothing in any app changes.

```ts
// ❌ Wrong — vendor lock-in
import { createClient } from '@supabase/supabase-js'

// ✅ Correct — abstracted interface
import { getSupabaseServerClient } from '@plato/schema'
```

## Context
This is the application of ADR-003 (Vendor Abstraction Pattern)
specifically to the database layer. It was formalised when `packages/schema`
was created as a proper workspace package in April 2026.

## Package structure
```
packages/schema/
  src/
    server.ts  — getSupabaseServerClient() — uses service role key
    client.ts  — getSupabaseBrowserClient() — singleton, anon key
    index.ts   — barrel export of both
  package.json — @plato/schema, peerDep on @supabase/supabase-js ^2
```

## Server vs browser client
- `getSupabaseServerClient()` — for use in server components, server
  actions, and API routes. Prefers `SUPABASE_SERVICE_ROLE_KEY` (bypasses
  RLS). Falls back to anon key if service role key is not set.
- `getSupabaseBrowserClient()` — for use in client components.
  Singleton pattern. Uses anon key + user session for RLS enforcement.
  Never has access to service role key.

## Consequences
- `apps/nucleus/next.config.ts` must include `@plato/schema` in
  `transpilePackages` — the package ships TypeScript source, not
  compiled JS
- `apps/nucleus/package.json` references `"@plato/schema": "*"` as
  a workspace dependency
- All queries in `apps/nucleus/lib/supabase/*.ts` import exclusively
  from `@plato/schema`
- Violating this rule is caught at TypeScript build time if
  `@supabase/supabase-js` is not listed as a direct dependency of
  the app (it is only a peer dep of `@plato/schema`)
