# ARCHITECTURE.md — Plato Suite

> Last updated: April 2026.
> ADRs 001–031 and ADR-TESS-001 are committed to `docs/decisions/`.
> ADRs 001–006 were written retroactively in April 2026 (they previously existed as titles only in this file).
> ADRs 007–031 were written in Claude design sessions and committed manually by Matt Bruce.

---

## Overview

Plato is built as a Turborepo monorepo. Five independently deployable Next.js applications share a common design system, schema layer, auth implementation, and configuration. The architecture is designed for portability, replaceability, and long-term maintainability.

The five apps are: **Nucleus** (org chart and resource management), **Dispatch** (PI planning), **Chronicle** (knowledge OS), **Roadmap** (executive canvas), and **Tessera** (KT Operating System — internal tool, see note in module registry).

---

## Core Principles

### 1. Loose Coupling, High Cohesion
Every layer is independently replaceable without touching the others. Frontend, API, database, auth, and storage are all swappable via interface boundaries.

### 2. Vendor Abstraction
No vendor SDK is called directly from application code. Application code calls internal package interfaces. The vendor implementation lives behind that interface. Swapping providers requires changing one file — nothing in any app changes.

### 3. Container Portability
All applications must run in any container runtime. No Vercel-proprietary APIs. No cloud-vendor-specific services in application code. Vercel is a deployment convenience, not a dependency.

### 4. OIDC-Standard Auth
Authentication is handled via the OpenID Connect standard. Any compliant provider (ForgeRock, Ping, EntraID, Okta, Auth0, Clerk, Supabase) is compatible via four environment variables. The application never stores enterprise credentials.

### 5. Config-Driven White-Labelling
Display names, enabled modules, brand tokens, and themes all live in configuration — not code. One config change re-skins and re-names the entire suite for any client.

### 6. 12-Factor App
All configuration is supplied via environment variables. No hardcoded infrastructure assumptions. No hardcoded client data.

---

## Monorepo Structure

```
plato/
  apps/                     ← independently deployable modules
    nucleus/                ← Module 1: Org Chart / resource management
    dispatch/               ← Module 2: PI planning
    chronicle/              ← Module 3: Knowledge OS
    roadmap/                ← Module 4: Executive roadmap
    tessera/                ← Internal tool: KT Operating System (see note)
  packages/                 ← shared code, consumed by all apps
    ui/                     ← design system and component library
    schema/                 ← database types and client abstraction
    auth/                   ← OIDC-standard auth implementation
    config/                 ← shared Tailwind, ESLint, TSConfig, tenant config
  docs/
    decisions/              ← Architecture Decision Records (ADRs)
  scripts/
    seed-demo.ts            ← demo tenant seed
```

---

## Application Layer

Each module is a Next.js 16+ App Router application. They share packages but deploy independently.

### Module Registry

| Module | Path | Role | Standalone | Status |
|---|---|---|---|---|
| Nucleus | `apps/nucleus` | Foundational data layer — teams, resources, org chart, finance | ✅ | Live — Vercel |
| Dispatch | `apps/dispatch` | PI planning orchestration | ✅ | Reference impl only |
| Chronicle | `apps/chronicle` | Knowledge and evidence OS | ✅ | Live — Vercel (paused Supabase) |
| Roadmap | `apps/roadmap` | Executive roadmap canvas | ✅ | Early scaffold |
| Tessera | `apps/tessera` | KT Operating System — supplier transition management | ⚠️ | Live — internal tool |

> **Tessera note:** Tessera is a client-specific internal tool built for the RMG eBusiness transition (CG → TCS). It intentionally deviates from several architectural principles for speed of delivery:
> - No authentication (open RLS) — documented in ADR-TESS-001
> - Direct Supabase SDK calls (bypasses `@plato/schema` abstraction) — documented in ADR-031
> - RMG-specific data and branding hardcoded — exception to PRINCIPLES.md §16 (no client fingerprints)
>
> These are time-bounded exceptions for a deadline-critical internal tool. Tessera may be genericised into a product in a future phase, at which point these exceptions would be addressed.

**Dependency note:** Nucleus owns the core `teams` and `resources` data. Other modules reference these. Nucleus is the recommended first module to implement in any new installation.

---

## Package Layer

### `@plato/ui` — Design System
- All shared React components
- CSS custom properties for every design token (`--rmg-*` token namespace for RMG deployments)
- Inline styles only in `packages/ui/` — no Tailwind in the package layer (ADR-023)
- Theme switching via token file swap — zero component changes
- WCAG AA accessibility as standard

### `@plato/schema` — Database Abstraction
- All Supabase/Postgres types
- Database client abstraction (application code imports from here, not from `@supabase/supabase-js` directly)
- Migration files
- Core shared tables: `organisations`, `teams`, `resources`, `users`

### `@plato/auth` — Authentication
- OIDC-standard implementation
- Supabase Auth for own SaaS
- Enterprise SSO via environment variable configuration
- Token validation and session management

### `@plato/config` — Shared Configuration
- Tailwind preset (v3 — upgrade to v4 requires ADR before proceeding)
- ESLint config
- TypeScript config
- `tenant.config.ts` — white-label and brand configuration

---

## Database Architecture

### Deployment Model
Plato uses a **single-tenant deployment model** (ADR-007). Each client deployment gets its own Supabase project. The `organisations` table exists as a single-row configuration anchor — it does not partition data across multiple tenants within one database. Going multi-tenant in future is an explicit migration path, not the current design.

### Core Schema (shared, owned by `@plato/schema`)
```sql
organisations   -- single-row config anchor (single-tenant model)
teams           -- teams within the organisation
resources       -- named individuals, roles, day rates
users           -- auth-linked user accounts
```

### Tessera Schema (kt_ prefix, owned by `apps/tessera`)
```sql
kt_domains              -- 12 knowledge capability areas
kt_domain_track_content -- content per domain per track (A/B)
kt_sessions             -- 125 KT sessions from TCS tracker
kt_app_groups           -- 13 TCS application groups (G0-G12 + Migration)
kt_session_domain_links -- many-to-many: sessions ↔ domains
kt_domain_app_group_links -- many-to-many: domains ↔ app groups
kt_rag_scores           -- RAG readiness scores per domain per dimension
kt_nuggets              -- private strategic insights
kt_people               -- KT participants (CG, TCS, RMG, HT, NH)
-- (+ 5 further tables: itinerary, parker questions, gaps, actions)
```

Tessera tables use the `kt_` prefix and live in the same Supabase project as Nucleus (`nwltpivvqynkfghazjpi`) for MVP. They will be migrated to their own project if Tessera becomes a standalone product.

### Module Extension Pattern
Modules add their own tables with foreign key references to core tables. No module duplicates a core table or column.

### Migration Strategy
All schema changes are managed via migration files. No ad-hoc SQL against production. Migrations are version-controlled alongside application code in `apps/[module]/supabase/migrations/` or `packages/schema/migrations/`.

---

## Auth Architecture

```
User hits Plato app
→ App redirects to configured IdP
→ IdP validates identity (royalmail.com, okta.com, etc.)
→ IdP issues OIDC token
→ App validates token via @plato/auth
→ Session established — app never saw a password
```

### Environment Configuration
```
OIDC_ISSUER_URL=
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_REDIRECT_URI=
```

Swapping identity providers = changing these four values. No code changes.

> **Tessera exception:** Tessera has no auth for MVP. All RLS policies are open (`FOR ALL USING (true)`). This is documented in ADR-TESS-001 and is intentional for an internal deadline-driven tool.

---

## Deployment Architecture

### Layer Separation

```
[Browser]
    ↓
[Next.js 16 Frontend — Vercel / Container]
    ↓
[Next.js API Routes / Separate API service]
    ↓
[Supabase / Postgres — managed or self-hosted]
    ↓
[Storage — Supabase Storage / S3-compatible]
```

### Deployment Targets

| Context | Platform | CI/CD | Node |
|---|---|---|---|
| Plato SaaS | Vercel | GitHub Actions | 24.x |
| Enterprise (e.g. RMG) | Azure Container Apps | ADO Pipelines | 24.x |
| Enterprise (AWS) | ECS / Fargate | GitHub Actions / CodePipeline | 24.x |
| Enterprise (GCP) | Cloud Run | GitHub Actions / Cloud Build | 24.x |

The application is identical in all cases. Only infrastructure configuration differs.

---

## White-Label Architecture

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

A white-label client receives a config file. Display names, enabled modules, and visual theme are all controlled here. The codebase is unchanged.

---

## Observability

- **Sentry** — error monitoring, all environments
- **PostHog** — product analytics, own SaaS only (not enterprise tenants unless opted in)
- Both wired in from first deployment — not retrofitted

---

## Demo / Sandbox

The demo is a database tenant, not a separate build.

- `tenant.type: 'demo'` flag disables destructive operations
- `scripts/seed-demo.ts` populates realistic fictional data
- Supabase branch environment for demo isolation
- Public demo URL configured to demo tenant via environment variables

---

## Architecture Decision Records

All significant architectural decisions are recorded in `docs/decisions/`. Each ADR is a short markdown file covering: the decision, the context, the alternatives considered, and the rationale.

Any deviation from the principles in this document requires an ADR before implementation.

### Current decision log

**Foundational architecture (001–006)**
| ADR | Title |
|---|---|
| 001 | Turborepo monorepo structure |
| 002 | Next.js App Router |
| 003 | Vendor abstraction pattern |
| 004 | OIDC-standard auth |
| 005 | Container portability |
| 006 | Vercel primary / Azure for enterprise |

**Schema conventions (007–022)**
| ADR | Title |
|---|---|
| 007 | Single-tenant deployment model |
| 008 | Soft deletes + partial indexes |
| 009 | Timestamp nullability — NOT NULL DEFAULT NOW() |
| 010 | Explicit field naming convention |
| 011 | Role / resource separation |
| 012 | Role code format |
| 013 | Temporal modelling via period snapshots |
| 014 | Cost configurations scoped to platforms |
| 015 | Shared entity ownership |
| 016 | Org hierarchy model |
| 017 | Planning increments independent of periods |
| 018 | Rate card model |
| 019 | Teams are optional |
| 020 | ARTs as shared entity |
| 021 | Three-tier user role model |
| 022 | Org containers as presentation layer |

**Product and UI decisions (023–031)**
| ADR | Title |
|---|---|
| 023 | RMG design system — inline styles, --rmg-* tokens, no Tailwind in packages/ui |
| 024 | Platform-scoped working context |
| 025 | Nucleus shell sidebar |
| 026 | Suite module subfolder routing |
| 027 | Database vendor abstraction |
| 028 | Server component data fetching pattern |
| 029 | Money stored as integer pence |
| 030 | Dispatch migration strategy |
| 031 | Temporary anonymous RLS policies (development phase) |

**Tessera-specific**
| ADR | Title |
|---|---|
| ADR-TESS-001 | Tessera open RLS — no auth for MVP. Time-bounded exception to ADR-004. |

---

## What This Architecture Is Not

- Monolithic — every concern is independently replaceable
- Vendor-locked — no proprietary service APIs in application code
- Client-specific — zero hardcoded client data or assumptions (Tessera is a documented exception)
- Premature — every decision above has been made to unblock scale, not to over-engineer early features
