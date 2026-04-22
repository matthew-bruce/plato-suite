# ADR-003 — Vendor Abstraction Pattern

Date: 2026-04-19
Status: Accepted

## Decision
No vendor SDK is called directly from application code. Every external
dependency is wrapped behind a package-level interface. Swapping
providers requires changing one file in `packages/` — nothing in
any `apps/` directory changes.

```ts
// ❌ Wrong — vendor lock-in in application code
import { createClient } from '@supabase/supabase-js'
import { createClient } from '@sendgrid/mail'

// ✅ Correct — abstracted interface
import { getSupabaseServerClient } from '@plato/schema'
import { sendEmail } from '@plato/notifications'
```

## Applies to
- Database: `@supabase/supabase-js` → `@plato/schema`
- Auth: identity provider SDKs → `@plato/auth`
- Storage: storage SDKs → `@plato/storage` (future)
- Email: email provider SDKs → `@plato/notifications` (future)
- Observability: Sentry, PostHog → wrapped in `@plato/observability` (future)

## Context
The primary deployment target is Vercel with Supabase. But enterprise
clients deploy to Azure with their own identity providers, and may
require different storage or email solutions. Vendor lock-in in
application code means changing provider requires touching every
file that imports the SDK. Behind an interface, it means changing
one implementation file.

## Consequences
- Every package in `packages/` represents a boundary behind which
  one or more vendor SDKs may live
- Application code only depends on internal `@plato/*` packages,
  never on vendor packages directly
- Vendor packages are listed as `peerDependencies` or
  `devDependencies` in the package that wraps them — not as direct
  dependencies of any app
- This pattern is enforced by code review — there is no automated
  lint rule preventing direct vendor imports, so discipline is required
