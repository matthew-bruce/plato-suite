# AI.md — Plato Suite

> This is the tooling-agnostic AI coding context file for the Plato monorepo.
> Tool-specific files (CLAUDE.md, .cursorrules, etc.) are derivatives of this file.
> Always update this file first. Derivatives should reference or mirror it.

---

## Standard Prompt Preamble (use at the start of every Claude Code prompt)

Every prompt that involves writing or modifying code must begin with the following block, verbatim:

```
Work directly on the main branch. Do not create a new branch.
Before writing any code, read the following files in full:

* docs/design/PLATO-DESIGN-SYSTEM.md
* packages/ui/components/rmg/index.ts
* Find and read the rmg CSS tokens file (likely packages/ui/styles/rmg.css or similar)

Design system rules that apply to every line of code:

* Only use --rmg-* CSS variables for colours, spacing, and typography
* Never hardcode hex values — if a colour is needed it must exist as an --rmg-* token
* Never use arbitrary Tailwind values (no text-[`#DA202A`], no bg-[`#F5F5F5`] etc)
* Use existing RMG components from packages/ui/components/rmg/ wherever applicable
* Components in packages/ui use inline styles + --rmg-* CSS variables only — Tailwind does not scan packages/ui
* For apps/* code, Tailwind is fine but only with named tokens defined in tailwind.config.ts
```

---

## What This Project Is

Plato is a modular SaaS platform for Platform Engineering teams. It provides productivity tooling for managing teams, resources, org structures, finances, roadmaps, PI planning, and knowledge management.

Each module is independently shippable as a standalone product, or used as part of the integrated Plato suite. The suite must feel cohesive whether a client uses one module or all of them.

**Tessera** (`apps/tessera`) is a client-specific internal tool for the RMG eBusiness supplier transition. It lives in this monorepo and remains intentionally exempt from a few architectural principles (RMG-specific data hardcoded, `kt_` tables living in the Nucleus Supabase project, no demo mode) — see ADR-TESS-002. Its auth and vendor-abstraction exceptions (ADR-TESS-001, ADR-TESS-002 §3) were resolved by ADR-033 (2026-07-22).

---

## North Star Principle

> Container-portable, vendor-abstracted, loosely coupled, config-driven — each concern independently replaceable.

Every architectural decision flows from this. If a proposed implementation violates any of these four properties, it requires an ADR and explicit justification before proceeding.

---

## Monorepo Structure

```
plato/
  apps/
    nucleus/      ← Module 1 — foundational data layer (teams, resources, org chart)
    dispatch/     ← Module 2 — PI planning orchestration
    chronicle/    ← Module 3 — knowledge and evidence OS
    roadmap/      ← Module 4 — executive canvas
    tessera/      ← Internal tool — KT Operating System (RMG transition, see ADR-TESS-002)
  packages/
    ui/           ← design system, all shared components
    schema/       ← shared DB types, Supabase client abstraction
    auth/         ← single OIDC-standard auth implementation
    config/       ← Tailwind, ESLint, TSConfig, tenant config
  docs/
    decisions/    ← Architecture Decision Records (ADRs 001–034, ADR-TESS-001, ADR-TESS-002)
  scripts/
    seed-demo.ts  ← demo tenant seed data
```

---

## Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Monorepo | Turborepo | Task caching, parallel builds |
| Framework | Next.js 16.x App Router | Do not use Pages Router. Upgraded to 16.2.4 in April 2026 (CVE-2025-66478). |
| UI Layer | React 19 | Component layer, used via Next.js |
| Language | TypeScript | Strict mode. No `any`. |
| Styling | Tailwind CSS v3 + CSS tokens | Brand-swappable via config. Do not upgrade to v4 without ADR. |
| Database | Supabase (Postgres) | Abstracted via `@plato/schema` — Tessera routes through it too as of ADR-033 (previously a direct-SDK exception, see ADR-TESS-002) |
| Auth | Supabase Auth / OIDC | See auth section below. Both apps, including Tessera, require a session as of ADR-033. |
| Hosting | Vercel / Docker | See deployment section below |
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

**Resolved (2026-07-22, ADR-033):** `apps/tessera` previously called Supabase
directly because its `kt_` tables aren't wrapped by `@plato/schema` (ADR-TESS-002).
It now routes through `@plato/schema`'s cookie-aware server/browser clients like
every other app — the `kt_` tables still aren't in the shared type registry, but
data access itself is no longer a direct-SDK exception.

---

## Vendor Abstraction Pattern

Never call vendor SDKs directly from application code. Always use your own interface.

```ts
// ❌ Wrong — vendor lock-in
import { createClient } from '@supabase/supabase-js'

// ✅ Correct — abstracted interface
import { db } from '@plato/schema'
```

The vendor SDK lives behind the package interface. Swapping providers means rewriting one file in `packages/` — nothing in `apps/` changes.

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

Compatible with: ForgeRock, Ping Identity, EntraID / Azure AD, Okta, Auth0, Clerk, and any OIDC-compliant provider. The application never stores enterprise credentials. It consumes tokens only.

---

## Shared Core Schema

All product modules reference these tables. No module may duplicate them.

```sql
organisations   -- single-row config anchor (single-tenant model, see ADR-007)
teams           -- teams within the organisation
resources       -- named individuals, roles, day rates
users           -- auth-linked user accounts
```

Modules extend via foreign keys and additive tables only. Schema changes to core tables require an ADR.

**Tessera schema:** Tessera uses `kt_` prefixed tables in the same Supabase project as Nucleus (project `nwltpivvqynkfghazjpi`). These are not in the shared schema and do not follow the multi-module extension pattern. See ADR-TESS-002.

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

Display names, enabled modules, and theme are all config — not code. One config change re-skins and re-names the entire suite for a white-label client. Tessera is not included here as it is not a white-label product module.

---

## Design System

Lives in `packages/ui/`. All components are built here. No app builds its own components.

- **Inline styles only** in `packages/ui/` — no Tailwind in the package layer (ADR-023)
- CSS custom properties (`--rmg-*` token namespace for the RMG skin) for all design tokens
- Theme switching via swapping a CSS token file — no component changes required
- Components must be accessible (WCAG AA minimum)
- Every component has a documented variant set before shipping

Apps (including `apps/tessera`) may use Tailwind for page-level layout. The restriction is on `packages/ui/` only.

See `packages/ui/README.md` for full design system documentation.

---

## Deployment Architecture

### Plato SaaS
Vercel — native Next.js, preview deployments per branch, zero-config.

### Enterprise (e.g. Azure, AWS, GCP)
Docker container. All apps must be container-portable.

Rules:
- No Vercel-proprietary APIs in application code
- All config via environment variables — no hardcoded infrastructure assumptions
- Docker-ready from day one
- ADO pipeline config ships alongside GitHub Actions config for enterprise clients

### Live deployments (April 2026)
- `plato-nucleus.vercel.app` — Nucleus, connected to Supabase `nwltpivvqynkfghazjpi`
- `plato-tessera.vercel.app` — Tessera, same Supabase project

---

## Demo / Sandbox

- Demo is a seeded `tenant.type: 'demo'` organisation — not a separate build
- `scripts/seed-demo.ts` populates realistic fictional data
- Supabase branch for demo environment
- Public demo URL points at the demo tenant
- No special application code — demo is purely data

Tessera has no demo mode. It is an internal tool with real programme data.

---

## File & Naming Conventions

- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- DB schema files: `snake_case.sql`
- Constants: `SCREAMING_SNAKE_CASE`
- CSS token names: `--plato-[category]-[variant]` (e.g. `--plato-color-primary`), `--rmg-[category]-[variant]` for RMG skin
- ADR files: `docs/decisions/NNN-short-description.md` or `docs/decisions/ADR-TESS-NNN.md` for Tessera-specific

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

Lives in `packages/ui/`. Full documentation in `packages/ui/README.md`.

Four rules that apply in every session touching UI:

1. **Consistency over creativity** — every page must look like it belongs to the same product
2. **Tokens over values** — never hardcode a colour or spacing value. Always use named design tokens
3. **Components over repetition** — if you style something twice, it belongs in `packages/ui/`
4. **Data speaks, design supports** — colour communicates state, not decoration

### Token Naming Convention
```
--plato-color-primary       ← generic product skin
--rmg-color-red             ← RMG skin (used in Nucleus and Tessera)
--rmg-spacing-04
--rmg-font-display
```

### Skin Architecture
The Plato suite ships two skins from day one:
- `plato-default` — generic product skin, the design baseline
- `rmg` — Royal Mail Group brand tokens, demonstrates white-label capability

Switching skins is a single token file swap. No component code changes. This is intentional and must be preserved.

---

## Coding Conventions

- TypeScript strict mode — no `any`, no exceptions
- Never call vendor SDKs directly — always use `@plato/[package]` abstraction (Tessera's former exception was resolved by ADR-033 — no app is exempt now)
- Never use arbitrary Tailwind hex values — extend `tailwind.config.ts` with named tokens
- Any new pure function gets a unit test at the same time — not retroactively
- Check every new component at 390px width before considering it done
- Commit and push at the end of every task
- Use **vitest** for all unit and integration tests
- Test file naming: `functionName.test.ts` in `__tests__/` alongside the code it tests
- **Files under 300 lines** — if a file is growing beyond this, split it. Components do one thing.
- **CRUD is always complete** — if a user can create something, they can edit and delete it. Build the edit form and delete confirmation at the same time as the add form.
- **Confirm before destructive actions** — every delete shows a confirmation prompt. No silent deletes.
- **Soft deletes only** — never hard delete records. Set `deleted_at` timestamp instead. UI filters these out.

---

## Database Standards

These apply to every table across every module.

### Deployment Model
Single-tenant per deployment (ADR-007). One Supabase project per client. The `organisations` table is a single-row config anchor, not a multi-tenant partition key.

### Field Naming
Never use generic field names that are ambiguous across tables. Field names must be explicit about what they contain.

```sql
-- ❌ Wrong — ambiguous across tables
name, description, status

-- ✅ Correct — explicit and unambiguous
team_name, team_description, team_status
resource_name, supplier_name, pi_plan_name
```

### Timestamps
Every table must include:
```sql
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
deleted_at    TIMESTAMPTZ           -- soft delete, NULL means active
```

### Soft Deletes
All queries must filter `WHERE deleted_at IS NULL` by default. The `@plato/schema` client abstraction handles this — never query a soft-deletable table directly without this filter.

### Environment Variables
Supabase credentials in `.env.local` — never hardcoded:
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
```

### Duration Storage
Session and time durations are stored as **integer minutes** in the database. Always display as human-readable strings in the UI: `2h 30m`, `1d 4h`, `45m`.

### Date Display
All user-facing dates in `en-GB` format: `24 Mar 2026`. Never ISO strings in the UI.

---

## .NET Interoperability

Plato is TypeScript end-to-end. However many enterprise clients run .NET backends and internal services. Plato accommodates this without any internal .NET code:

- Plato exposes standard REST APIs — consumable by any .NET service
- OIDC handles identity federation with enterprise providers
- Postgres-standard schema is directly accessible from any .NET data layer
- .NET is a **consumer of Plato's interfaces**, not a technology Plato adopts

No special architecture work required. The vendor abstraction pattern already handles this.

---

## Reference Implementations (pre-rebrand)

These repos contain patterns worth referencing. Do not port directly — migrate thoughtfully.

- `matthew-bruce/pi-planning-tool` → Dispatch
- `matthew-bruce/vibe-engineering-chronicle` → Chronicle
- `matthew-bruce/platform-org-structure` → Nucleus (was Org Chart)
- `matthew-bruce/platform-roadmap-poc` → Roadmap

---

## Nucleus — Current State (Platform Schedule & Blended Rates)

Snapshot of what exists in `apps/nucleus/` as of the effective-dated
blended-rates work — not a changelog, update in place as things change.

**Blended Rates page (`/rates`)** — standalone top-level LHS nav item under
the Finance section (same mechanism as Platform Schedule/Dashboard, not
nested). One global platform selector (pill row) at the top drives every
section on the page: the trend chart, the Rate History table, and the inline
add-rate form — there is only one selector, not one per section. Rate
history is effective-dated per platform (`cost_configurations`, versioned by
`effective_from`, see SCHEMA_DESIGN.md 1.13/021–022). A period's cost figures
are frozen the instant it locks via `period_cost_snapshots` — see "Rate-at-
lock snapshot" below.

**Applied Blended Rate KPI card** — on the Platform Schedule page, replaces
the old "Current Blended Rate" card. Shows the rate that applies to the
*specific period being viewed* — a locked period reads its permanent
snapshot, a draft period reads the live effective-dated lookup — so a
historic and a draft period can legitimately show different rates even
"today." Inline-editable; save is an upsert, not a blind insert: if no
`cost_configurations` row exists yet for this platform + this period's
`effective_from`, it inserts (via the `SECURITY DEFINER` `set_blended_rate`
RPC); if one already exists, it updates that row in place instead of
colliding on the unique index.

**Rate-at-lock snapshot mechanism** — `period_cost_snapshots` freezes the
resolved rate/VAT/on-costs per `(period_id, platform_id)` at the moment a
period transitions `locked: false → true` (via `set_period_locked`). Once
locked, every cost-figure consumer in the app reads *only* the snapshot,
never live `cost_configurations` — editing or deleting a rate afterward
cannot move a locked period's numbers. See SCHEMA_DESIGN.md 1.13/022 for the
schema and 4a for the "Chart.js `afterDraw` canvas state bleed" gotcha hit
while building this page's trend chart.

**Add Role/Resource wizard** — the old `ForkPanel`/`checkResourceInPeriod`
same-period duplicate-detection mechanism has been retired entirely. The
conflict dialog now fires at Step 1 (Search), the moment an existing
resource is picked — not after the whole form is filled in. "Connect and
keep existing details" / "Connect and use vacant seat details" are each a
single atomic `SECURITY DEFINER` RPC (`connect_resource_keep_existing`,
`connect_resource_use_vacant` — SCHEMA_DESIGN.md 1.13/019), not client-side
multi-step writes. Layout adapts to how many existing rows are found: exactly
one existing row (plus the vacant seat) renders as side-by-side comparison
cards; two or more existing rows renders as a list.

**Export current view (`ExportCurrentViewModal`)** — toolbar button "Export
current view" on the Schedule page. Renders a table of Resource / Role /
Team(s) / Location / Days / Run rate cost (the platform's blended rate only —
never supplier-level day rates, which stay out of any export a wider
audience might see). Columns are click-sortable; the Team(s) column
de-emphasises non-matching assignments when a team filter is active
(secondary assignments render smaller/muted with a "+" prefix). Copy-to-
clipboard writes rich HTML (a real table, not tab-separated text) so pasting
into email/Teams keeps formatting, with a plain-text fallback.

**Other Schedule page changes this session:** the toolbar is sticky with a
scroll shadow once it detaches from its resting position; the "Filtered
Totals" footer row now includes a Days total alongside Base/+VAT.

**Root route** — `/` temporarily redirects to `/schedule` (there is a `//
TEMP` comment marking this at the redirect site); Dashboard has its own
`/dashboard` route. Revert when Dashboard is ready to be the real landing
page again.

**`platform_abbreviation` is canonical.** `platforms.platform_abbreviation`
(migration 020 — WEB/APP/BIG/EPS/ETP/PDA seeded) is the short label used
everywhere in Nucleus's UI now (nav, chart legends, badges, pills). Never
hardcode a platform abbreviation string — read this column. See
SCHEMA_DESIGN.md 2.7 for the pending Despatch-side audit once that app joins
the monorepo.
