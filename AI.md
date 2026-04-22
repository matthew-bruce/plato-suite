# AI.md — Plato Suite

> This is the tooling-agnostic AI coding context file for the Plato monorepo.
> Tool-specific files (CLAUDE.md, .cursorrules, etc.) are derivatives of this file.
> Always update this file first. Derivatives should reference or mirror it.

---

## What This Project Is

Plato is a modular SaaS platform for Platform Engineering teams. It
provides productivity tooling for managing teams, resources, org
structures, finances, roadmaps, PI planning, and knowledge management.

Each module is independently shippable as a standalone product, or used
as part of the integrated Plato suite. The suite must feel cohesive
whether a client uses one module or all of them.

**Tessera** (`apps/tessera`) is a client-specific internal tool for the
RMG eBusiness supplier transition. It lives in this monorepo but is
intentionally exempt from several architectural principles for its current
phase. See ADR-TESS-001 and ADR-TESS-002 for the documented exceptions.

---

## North Star Principle

> Container-portable, vendor-abstracted, loosely coupled, config-driven —
> each concern independently replaceable.

Every architectural decision flows from this. If a proposed implementation
violates any of these four properties, it requires an ADR and explicit
justification before proceeding.

---

## Monorepo Structure

```
plato/
  apps/
    nucleus/      ← Module 1 — foundational data layer (teams, resources)
    dispatch/     ← Module 2 — PI planning orchestration
    chronicle/    ← Module 3 — knowledge and evidence OS
    roadmap/      ← Module 4 — executive canvas
    tessera/      ← Internal tool — KT OS (RMG transition, see ADR-TESS-002)
  packages/
    ui/           ← design system, all shared components
    schema/       ← shared DB types, Supabase client abstraction
    auth/         ← single OIDC-standard auth implementation
    config/       ← Tailwind, ESLint, TSConfig, tenant config
  docs/
    decisions/    ← ADRs 001–031, ADR-TESS-001, ADR-TESS-002
  scripts/
    seed-demo.ts  ← demo tenant seed data
```

---

## Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Monorepo | Turborepo | Task caching, parallel builds |
| Framework | Next.js 16.x App Router | Upgraded to 16.2.4 in April 2026 (CVE-2025-66478). Do not use Pages Router. |
| UI Layer | React 19 | Component layer, used via Next.js |
| Language | TypeScript | Strict mode. No `any`. |
| Styling | Tailwind CSS v3 + CSS tokens | Brand-swappable via config. Do not upgrade to v4 without ADR. |
| Database | Supabase (Postgres) | Abstracted via `@plato/schema`. Tessera exception: see ADR-TESS-002. |
| Auth | Supabase Auth / OIDC | See auth section. Tessera has no auth (ADR-TESS-001). |
| Hosting | Vercel / Docker | See deployment section |
| Node | 24.x | Current on all Vercel deployments |

---

## Package Conventions

All internal packages are scoped `@plato/[name]`.

```ts
// Always import from package — never reach into another app directly
import { Button } from '@plato/ui'
import { db } from '@plato/schema'
import { authProvider } from '@plato/auth'
import { tenantConfig } from '@plato/config'
```

Never import across `apps/`. Cross-module concerns belong in `packages/`.

**Tessera exception:** `apps/tessera` calls Supabase directly. See
ADR-TESS-002.

---

## Vendor Abstraction Pattern

Never call vendor SDKs directly from application code. Always use your own
interface.

```ts
// ❌ Wrong — vendor lock-in
import { createClient } from '@supabase/supabase-js'

// ✅ Correct — abstracted interface
import { db } from '@plato/schema'
```

The vendor SDK lives behind the package interface. Swapping providers means
rewriting one file in `packages/` — nothing in `apps/` changes.

This applies to: database, auth, storage, email, queues, observability.

---

## Auth Architecture

### Own SaaS (plato.io or equivalent)
Supabase Auth — email/password or social login.

### Enterprise clients
OIDC-standard. Four environment variables configure any compliant provider:

```
OIDC_ISSUER_URL=
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_REDIRECT_URI=
```

---

## Shared Core Schema

All product modules reference these tables. No module may duplicate them.

```sql
organisations   -- single-row config anchor (single-tenant, see ADR-007)
teams           -- teams within the organisation
resources       -- named individuals, roles, day rates
users           -- auth-linked user accounts
```

Modules extend via foreign keys and additive tables only.

**Tessera schema:** Tessera uses `kt_` prefixed tables in the Nucleus
Supabase project (`nwltpivvqynkfghazjpi`). These are not in the shared
schema. See ADR-TESS-002.

---

## Tenant & White-Label Configuration

```ts
// packages/config/tenant.config.ts
export const tenantConfig = {
  suiteName: 'Plato',
  modules: {
    nucleus:   { displayName: 'Org Chart',  enabled: true },
    dispatch:  { displayName: 'Dispatch',   enabled: true },
    chronicle: { displayName: 'Chronicle',  enabled: true },
    roadmap:   { displayName: 'Roadmap',    enabled: true },
  },
  theme: 'plato-default',
}
```

Tessera is not in the config — it is not a white-label product module.

---

## Design System

Lives in `packages/ui/`. All components are built here. No app builds its
own components.

- **Inline styles only** in `packages/ui/` — no Tailwind in the package
  layer (ADR-023)
- CSS custom properties (`--rmg-*` token namespace for RMG skin)
- Theme switching via swapping a CSS token file — no component changes
- WCAG AA accessibility as standard

Apps (including `apps/tessera`) may use Tailwind for page-level layout.
The restriction applies to `packages/ui/` only.

---

## Deployment Architecture

### Plato SaaS
Vercel — native Next.js, preview deployments per branch, zero-config.

### Enterprise (e.g. Azure, AWS, GCP)
Docker container. All apps must be container-portable.

Rules:
- No Vercel-proprietary APIs in application code
- All config via environment variables
- Docker-ready from day one
- ADO pipeline config ships alongside GitHub Actions config for enterprise

### Live deployments (April 2026)
- `plato-nucleus.vercel.app` — Nucleus, Supabase `nwltpivvqynkfghazjpi`
- `plato-tessera.vercel.app` — Tessera, same Supabase project

---

## Demo / Sandbox

- Demo is a seeded `tenant.type: 'demo'` organisation — not a separate build
- `scripts/seed-demo.ts` populates realistic fictional data
- Supabase branch for demo environment

Tessera has no demo mode. It is an internal tool with live programme data.

---

## File & Naming Conventions

- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- DB schema files: `snake_case.sql`
- Constants: `SCREAMING_SNAKE_CASE`
- CSS tokens: `--plato-[category]-[variant]` or `--rmg-[category]-[variant]`
- ADR files: `docs/decisions/NNN-short-description.md` or
  `docs/decisions/ADR-TESS-NNN.md` for Tessera-specific

---

## What Belongs Where

| Concern | Location |
|---|---|
| Shared UI components | `packages/ui/` |
| DB types and client | `packages/schema/` |
| Auth logic | `packages/auth/` |
| Tailwind / ESLint / TS config | `packages/config/` |
| Tenant / brand config | `packages/config/tenant.config.ts` |
| Module-specific components | `apps/[module]/components/` |
| Module-specific API routes | `apps/[module]/app/api/` |
| Seed data | `scripts/` |
| Architectural decisions | `docs/decisions/` |
| Tessera KT schema migrations | `apps/tessera/supabase/migrations/` |

---

## Design System Principles

Four rules applying in every session touching UI:

1. **Consistency over creativity** — every page must look like the same
   product
2. **Tokens over values** — never hardcode a colour or spacing value
3. **Components over repetition** — if you style something twice, it
   belongs in `packages/ui/`
4. **Data speaks, design supports** — colour communicates state, not
   decoration

### Token Naming
```
--plato-color-primary       ← generic skin
--rmg-color-red             ← RMG skin (Nucleus and Tessera)
--rmg-spacing-04
--rmg-font-display
```

### Skin Architecture
- `plato-default` — generic product skin, the design baseline
- `rmg` — Royal Mail Group brand tokens, demonstrates white-label

Switching skins is a single token file swap. No component code changes.

---

## Coding Conventions

- TypeScript strict mode — no `any`, no exceptions
- Never call vendor SDKs directly — always use `@plato/[package]`
  abstraction (Tessera exception: ADR-TESS-002)
- Never use arbitrary Tailwind hex values — extend `tailwind.config.ts`
  with named tokens
- Any new pure function gets a unit test at the same time
- Check every new component at 390px width before considering it done
- Commit and push at the end of every task
- Use **vitest** for all unit and integration tests
- Test file naming: `functionName.test.ts` in `__tests__/`
- Files under 300 lines — if a file grows beyond this, split it
- CRUD is always complete — create, edit, and delete built at the same time
- Confirm before destructive actions — no silent deletes
- Soft deletes only — set `deleted_at`, never hard delete

---

## Database Standards

### Deployment Model
Single-tenant per deployment (ADR-007). One Supabase project per client.
The `organisations` table is a single-row config anchor.

### Field Naming
```sql
-- ❌ Wrong — ambiguous across tables
name, description, status

-- ✅ Correct — explicit
team_name, resource_name, supplier_name
```

### Timestamps
```sql
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
deleted_at    TIMESTAMPTZ           -- soft delete
```

### Environment Variables
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
```

### Duration Storage
Integer minutes in DB. Display as `2h 30m`, `45m` in UI.

### Date Display
en-GB format: `24 Mar 2026`. Never raw ISO strings in UI.

---

## .NET Interoperability

Plato is TypeScript end-to-end. Enterprise clients running .NET are
consumers of Plato's interfaces — REST APIs, OIDC tokens, Postgres
connections. No .NET code inside Plato.

---

## Reference Implementations (pre-rebrand)

- `matthew-bruce/pi-planning-tool` → Dispatch
- `matthew-bruce/vibe-engineering-chronicle` → Chronicle
- `matthew-bruce/platform-org-structure` → Nucleus
- `matthew-bruce/platform-roadmap-poc` → Roadmap
