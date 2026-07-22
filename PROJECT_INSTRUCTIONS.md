# Plato Suite — Claude Project Instructions

## What This Project Is

Plato is a modular, production-grade SaaS platform for Platform Engineering
teams. It provides productivity tooling for managing teams, resources, org
structures, finances, roadmaps, PI planning, and knowledge management.

The platform is built as a Turborepo monorepo. Each module is independently
shippable and saleable as a standalone product, or used as part of the
integrated Plato suite.

**The product ambition — think in these terms:**

| Reference | What to learn from it |
|---|---|
| **Atlassian** (Jira, Confluence, Bitbucket) | Modular suite with shared identity and navigation — each product genuinely standalone, exponentially better together |
| **HubSpot** (Marketing, Sales, Service Hubs) | Independently purchasable hubs built on a shared data backbone — the architecture Plato's shared schema mirrors |
| **Salesforce** | Gold standard for enterprise multi-tenancy, white-labelling, and SSO — the enterprise deployment model Plato targets |
| **Microsoft Office / Adobe CS** | The desktop precedent — coherent suite feel across independent tools, interchangeable by a single user or an entire organisation |

Plato is not competing with any of these on breadth. It is applying the same
suite architecture to a narrowly defined, underserved audience: Platform
Engineering teams.

**Working name:** Plato (brand name TBD — do not let this block any technical
work)

---

## The Current Modules

| Internal Name | Display Name | Status | Priority |
|---|---|---|---|
| `nucleus` | Nucleus | Active — org & resource management | **Module 1 — backbone** |
| `tessera` | Tessera | Active — KT Operating System (RMG transition) | Module 1b — live priority |
| `despatch` | Despatch | Most mature, needs genericising | Module 2 |
| `chronicle` | Chronicle | Live on Vercel | Module 3 |
| `roadmap` | Roadmap | Least mature, localStorage only | Module 4 |

Nucleus is the **foundational data layer**. Teams and Resources defined there
feed Despatch, the Finance calculator, and every other module that references
people or teams. Always treat it as the schema backbone.

Tessera is a Plato app built for the RMG CG→TCS supplier transition. It is
the active build priority and the primary reference client implementation.

---

## Tech Stack (locked — do not deviate without an ADR)

| Concern | Choice |
|---|---|
| Monorepo | Turborepo |
| Framework | Next.js 15, App Router |
| UI Layer | React 19 — component layer, used via Next.js |
| Language | TypeScript throughout — no exceptions |
| Styling | Tailwind CSS v3 + CSS token system (not v4 yet — ADR needed before upgrade) |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (own SaaS) / OIDC-standard (enterprise clients) |
| Hosting | Vercel (own SaaS) / Azure Container Apps or equivalent (enterprise) |
| Containerisation | Docker — all apps must be container-portable |

---

## Active Supabase Projects

| Project | ID | Status |
|---|---|---|
| Nucleus (live, Vercel-connected for both Nucleus + Tessera) | `nwltpivvqynkfghazjpi` | **Active** |
| Ghost / legacy project | `fvuutiejqbsnqhtodghs` | Can be paused — NOT connected to Vercel |

Always verify project ID before any DDL or destructive SQL.
The correct live project is **always** `nwltpivvqynkfghazjpi`.

### Seeded data state (as of June 2026)

**Periods (all correct):**
- Q4 FY 25/26 · 1 Jan 2026 – 31 Mar 2026 · Closed
- Q1 FY 26/27 · 1 Apr 2026 – 30 Jun 2026 · Active
- Q2 FY 26/27 · 1 Jul 2026 – 30 Sep 2026 · Draft

**Teams (Web Platform):** Janus, Orion, Pulsar, Nebula, Helios, Cosmos,
Cygnus, DST, ETP, Pluto (decommissioned — no deleted_at, filtered by
absence of current-state assignments), Shared Resources

**Workstreams (Web Platform):**
- Web & App (WAA) — T4B — Janus, Nebula, Cosmos, Cygnus
- Out of Home (OOH) — T4B — Orion, Pulsar
- Platform Engineering — T4T — Helios
- External — T4T — DST

**Schedule data:** Q4 FY 25/26 fully reconciled. Q1 FY 26/27 cloned
from Q4 as starting point (75 allocation rows). Q2 FY 26/27 team
assignments cloned from current-state, no allocations yet.

**Q4 FY 25/26 reconciliation (June 2026 — COMPLETE):**
- All 6 suppliers reconciled to spreadsheet BASE totals exactly.
- Grand total BASE: £1,822,134.56 ✅ (exact match)
- Grand total +VAT: £1,921,477.15 (app) vs £1,921,505.26 (spreadsheet)
  — £28.11 residual difference = acceptable pence-level rounding.
- VAT rate stored as 7.082% (3dp) in cost_configurations — corrected
  from 7.08% which caused the rounding gap.
- RMG contractors (Semiu Salawu, TBC Programme Manager, TBC Test Manager,
  TBC Test Engineer) correctly attract VAT via vat_applies = true.
  RMG FTEs (11 named) have vat_applies = false.
- TBC DevOps Senior Consultant (CG) role_title corrected to
  "Non-Factory Service Engineer".
- Dipti Borole (formerly Deepti Borole / Dipti Chaudhari) — merged to
  single resource record "Dipti Borole", old "Dipti Chaudhari" record
  soft-deleted.

**Q4 FY 25/26 team assignment backfill — COMPLETE:**
All teams fully backfilled with period-scoped rows for Q4:
Janus ✅, Nebula ✅, Orion ✅, Cosmos ✅, Cygnus ✅, Pluto ✅,
DST ✅, Shared Resources ✅, ETP ✅ (Emil Nowak 50%)
Pulsar and Helios: not applicable for Q4 (came into use Q1 FY 26/27)

**Q1 FY 26/27 team assignments:** Cloned from current-state (NULL
period_id rows) — 78 rows covering all active teams.

**Migration history (Nucleus, applied to `nwltpivvqynkfghazjpi`) — corrected
2026-07-22 to match `packages/schema/migrations/` exactly. The previous
version of this table (006_rpa_nullable_resource_id through
010_cost_config_vat_precision) did not correspond to any files in the repo —
see the process rule below on why, and ADR-032 / migration `026` for the one
change from that history that turned out to be real but undocumented:**

| Migration | Description |
|---|---|
| 001_core_schema | Baseline schema — all core Nucleus tables |
| 002_seed_lookups | Lookup seed data + additive columns |
| 003_resource_location_and_job_title | resource_location, resource_country, resource_job_title on resources |
| 004_itinerary_session_type | Tessera `tessera_itinerary_sessions.session_type` (audit-trail no-op — column already existed) |
| 005_schedule_display_fields | role_title and planview_code snapshot columns on resource_period_allocations |
| 006_rpa_display_order | display_order on resource_period_allocations (Platform Schedule drag-and-drop ordering) |
| 015_rta_allocation_id | resource_id nullable on resource_team_assignments; allocation_id added as the alternative TBC join key |
| 019_resource_conflict_connect_rpcs | connect_resource_keep_existing / connect_resource_use_vacant RPCs — Add Role/Resource wizard conflict resolution |
| 020_platform_abbreviation | platforms.platform_abbreviation — canonical short label (WEB/APP/BIG/EPS/ETP/PDA) |
| 021_set_blended_rate_rpc | set_blended_rate SECURITY DEFINER RPC — controlled write path for cost_configurations |
| 022_period_cost_snapshots | period_cost_snapshots table + set_period_locked RPC — freezes cost figures for locked periods |
| 023_create_period_rpc | Atomic "Create New Period" RPC for the Platform Schedule wizard |
| 024_authenticated_rls | Authenticated-only access — closes ADR-031 (Nucleus) and ADR-TESS-001 (Tessera); see ADR-033 |
| 025_platform_cost_items_active_user_policy | platform_cost_items — any-active-user RLS policy (was left with no policy after 024) |
| 026_rpa_nullable_resource_id_retroactive | **Retroactive record.** resource_id nullable on resource_period_allocations — actually applied out-of-band on 2026-05-28; see ADR-032 |

There is a gap between 006 and 015 (no 007–014 migration files exist in this
repo) and no migrations for the vat_applies flag / cost_config VAT precision
described in earlier versions of this table — if those changes are real and
live, they are undocumented in the same way 026 was until this session; treat
them as an open documentation-gap risk, not a confirmed non-issue, until
verified the same way ADR-032 was.

**platform_cost_items — Q4 FY 25/26 (3 rows seeded):**
- Camel Resources: £68,200
- SLZ: £47,080
- Late Timesheets from 24/25: £19,220
Q1 and Q2 have no cost items — these were Q4-specific recovered costs.

**vat_applies flag — rules:**
- `false`: RMG internal FTEs (Matthew Bruce, Paul Williams, Selen Hamilton,
  Mike James, Ajmal Malik, Justin Fox, Anjusmita Choudhury, Dipti Devanga,
  James Baxter, Leopold Kwok, Rohith Nair) + TBC Senior SW Eng F_Gov
- `true`: ALL external suppliers + RMG contractors (Semiu Salawu,
  TBC Programme Manager, TBC Test Manager, TBC Test Engineer)
- Default for new rows: `true`

**Known issues to resolve (next session):**
- Ad-hoc items not period-scoped in UI — adding/deleting affects all
  periods including closed ones. Bug: platform_cost_items correctly has
  period_id but the UI mutation does not filter by current period.
- Period selector on schedule does not reload ad-hoc items without a
  hard refresh — client state not resetting on period change.
- Inline CRUD for resource/allocation rows not visibly working in UI
  despite being implemented — needs investigation.
- Q1 FY 26/27 allocations need review — cloned from Q4 but capacity_days
  need updating for Q1 working days (65) and any starters/leavers.
- TCS resources not yet seeded (0 named TCS people).
- Orion workstream change (OOH → WAA in Q2) requires date-bounded
  workstream membership — not yet implemented.
- resource_id NOT NULL on resource_team_assignments — blocks vacant role
  team assignment until migration to make it nullable.
- team_id snapshot column on resource_period_allocations not yet
  implemented (deferred — full design discussion completed this session,
  decision: nullable FK with soft-deleted teams, same pattern as
  supplier_id on migration 007).
- **Team Cosmos is empty in Q2 FY 26/27** — operationally replaced by new
  Team Sagan. Retain/retire/repurpose decision for Cosmos still pending
  from Matt — do not assume it should be deleted or hidden until that
  decision is made.

---

## Vercel Deployments

| App | URL | Root Directory |
|---|---|---|
| Tessera | `plato-tessera.vercel.app` | `apps/tessera` |
| Nucleus | `plato-nucleus.vercel.app` | `apps/nucleus` |

Both deploy automatically from the `main` branch on push.
Team ID: `team_JJ0EI2Nif9V39YFgUObazMjR`

---

## Git / Branch Rules (CRITICAL — read before every session)

### How branching actually works

The `main` branch is **protected at the GitHub repository level**. Direct
pushes to `main` are blocked. Claude Code Web cannot push to `main`
regardless of what the prompt says — it will always create a `claude/`
prefixed branch.

**The "Work directly on the main branch" instruction is ineffective and
should not be used.** It does not override GitHub branch protection rules.

### The correct workflow

1. Claude Code creates a `claude/` branch on the first prompt of a session
2. **For all subsequent prompts in the same session, reuse that branch** —
   do not create a new one. Add this line to the top of every follow-up
   prompt:

Checkout existing branch `claude/[branch-name]` before making any changes. Do not create a new branch.

3. Matt merges the branch into `main` via GitHub UI, or CLI:

```bash
git checkout main
git pull origin main
git merge claude/[branch-name]
git push origin main
git branch -d claude/[branch-name]
git push origin --delete claude/[branch-name]
```

4. Vercel auto-deploys from `main` after the merge

### Session branch pattern

| Prompt | Branch instruction |
|---|---|
| First prompt of session | Let Claude Code create a new `claude/` branch |
| All subsequent prompts | `Checkout existing branch \`claude/[branch-name]\`. Do not create a new branch.` |

Note the branch name after the first prompt runs — you will need it for
every follow-up prompt in the session.

### End of every Claude Code session

- All work must be committed and pushed to the `claude/` branch before
  the session ends — never leave uncommitted changes
- Matt merges to `main` immediately after reviewing the session output
- The `claude/` branch is deleted after merging — do not let them
  accumulate

### Branch accumulation warning

If more than 2 unmerged `claude/` branches exist on the remote, stop and
merge them before starting new work. Stale branches cause merge conflicts
and confusion.

---

## Developer Context

Matt works exclusively through:
- **Claude Chat** (this project) — architecture, product thinking, schema
  review, prompt generation, file production
- **Claude Code Web** (`claude.ai/code`) — all file-level changes, code
  commits, repo operations
- **Vercel** — all deployment verification; changes are reviewed live at
  the deployed URLs, not locally

**There is no local development environment in active use.** Do not write
instructions that assume `npm run dev`, `localhost:3000`, or any local
toolchain is available. All code changes are made via Claude Code Web and
verified via Vercel preview/production URLs.

**Supabase keys** are held as Vercel environment variables. The
`.env.local` pattern is documented for future local dev but not currently
in use.

**Any migration applied directly via Supabase MCP (`Supabase:apply_migration`)
must have its exact SQL committed as a numbered file in
`packages/schema/migrations/` in the same working session** — never leave a
live migration undocumented in the repo, even temporarily. This is what
caused the ADR-032/migration-006 drift discovered 2026-07-22: a migration
applied out-of-band on 2026-05-28 was never filed, a later unrelated change
took the "006" slot instead, and the corresponding ADR was never written —
leaving both the schema history and the decision record silently wrong for
almost two months.

### Supabase MCP Connector (IMPORTANT — read every session)

The **Supabase MCP connector is active and configured** in this Claude
Project. Claude must use it proactively rather than making assumptions
about the data or asking Matt to run queries manually.

**Rules:**
- **Read freely** — Claude may run any SELECT query at any time without
  asking permission. Use it to verify IDs, inspect schema, diff data
  against expectations, check RLS policies, and confirm state before
  proposing changes.
- **Always ask before writing** — any INSERT, UPDATE, DELETE, DDL
  (`ALTER`, `CREATE`, `DROP`), or migration must be proposed in full,
  explained in plain English, and explicitly approved by Matt before
  Claude executes it. No exceptions.
- **Use it to validate before assuming** — if something looks wrong on
  the app or a query returns unexpected results, query the DB first.
  Don't guess.
- **Target project ID: `nwltpivvqynkfghazjpi`** — always confirm this
  before any write operation. The ghost project `fvuutiejqbsnqhtodghs`
  must never receive writes.

---

## Enterprise Integration Notes

**.NET environments** — many enterprise clients (including RMG) run .NET
backends and internal APIs. Plato does not use .NET internally, but is
designed to integrate with .NET environments as a consumer of Plato's
interfaces:

- Plato exposes standard REST APIs — consumable by any .NET service
- OIDC auth handles identity federation with enterprise identity providers
- Postgres-standard schema means any .NET data layer can connect directly
- No special work required — the vendor abstraction architecture already
  accommodates this

1. **Vendor abstraction** — never call a vendor SDK directly from application
   code. Always call your own interface. One file to swap, nothing else
   changes.
2. **Container-portable** — no Vercel-proprietary APIs. Every app must run in
   any container runtime.
3. **OIDC-standard auth** — the app never stores enterprise credentials. It
   consumes tokens. Four env vars swap the identity provider.
4. **Config-driven white-labelling** — display names, brand tokens, and theme
   all live in `tenant.config.ts`. One config change re-skins the entire
   suite.
5. **Loose coupling, high cohesion** — every layer independently replaceable.
   Frontend, API, database, auth, storage are all swappable without touching
   each other.
6. **12-factor app** — all config via environment variables. No hardcoded
   infrastructure assumptions.
7. **No client fingerprints** — zero hardcoded client names, data, or
   assumptions anywhere in the codebase. Demo data lives in seed scripts only.

---

## Production-Ready Standards (quality gate — applies to every session)

A module is not shippable until it meets all of these:

- [ ] Auth implemented properly — not bolted on post-build
- [ ] Environment-aware config — dev / staging / prod
- [ ] Schema migrations via files — no ad-hoc SQL
- [ ] Token-based design system — brand-swappable by config
- [ ] Error boundaries and loading states as standard
- [ ] No hardcoded client data anywhere
- [ ] Critical path tests before shipping
- [ ] CI/CD pipeline configured
- [ ] Docker-ready
- [ ] Observability — Sentry (errors) + PostHog (analytics) wired in

---

## Monorepo Structure

```
plato/
  apps/
    nucleus/          ← Module 1 — org & resource management
    tessera/          ← KT Operating System (RMG reference client)
    despatch/         ← Module 2 — PI planning
    chronicle/        ← Module 3 — knowledge management
    roadmap/          ← Module 4 — roadmap (localStorage only currently)
  packages/
    ui/               ← design system, all shared components
    schema/           ← shared DB types, Supabase client abstraction
    auth/             ← single auth implementation
    config/           ← Tailwind config, ESLint, TSConfig, tenant config
  docs/
    decisions/        ← ADRs — one file per architectural decision
  scripts/
    seed-demo.ts      ← demo tenant seeding
  AI.md
  ARCHITECTURE.md
  PROPOSITION.md
  ROADMAP.md
  CHANGELOG.md
  CONTRIBUTING.md
  README.md
```

Each `apps/[module]/` contains its own:
- `README.md` — technical: how to run standalone
- `PROPOSITION.md` — standalone value prop, audience, use case
- `ROADMAP.md` — module-specific feature roadmap
- `AI.md` — module-specific AI coding context

---

## Shared Schema (core tables — all modules reference additively)

| Table | Purpose |
|---|---|
| `organisations` | Top-level tenant entity |
| `suppliers` | Supplier organisations (CG, TCS, RMG, HT, NH, etc.) |
| `resources` | Named individuals with roles, rates, onboarded/rolloff dates |
| `teams` | Teams within an organisation |
| `users` | Auth-linked user accounts |

No module may create a duplicate of these tables. All modules extend via
foreign keys and additive tables. Tessera uses `tessera_` prefixed tables
to extend the shared schema without polluting it.

### Key resources table columns (as of migration 003)

- `resource_function` — enum: FACTORY | SERVICE | PROGRAMME | COMMERCIAL | etc.
- `resource_onboarded_date DATE` — when they joined the account
- `resource_rolloff_date DATE` — actual or planned exit date (use this to
  represent rolled-off resources; do not use deleted_at for this purpose)
- `resource_location` — enum: onshore | nearshore | offshore
- `resource_country TEXT`
- `resource_job_title TEXT`

---

## RMG Component Library

The `packages/ui/components/rmg/` directory holds the Royal Mail Group design
system component library. This is the primary reference skin demonstrating
white-label capability.

**Full spec lives in `rmg-components.md`** — always refer to that file for
component inventory, token mapping, pending tokens, and the Figma export
workflow.

### Live components (10)

| Component | File |
|-----------|------|
| Button | Button.tsx |
| Breadcrumb | Breadcrumb.tsx |
| ChevronButton | ChevronButton.tsx |
| Checkbox | Checkbox.tsx |
| FormField | FormField.tsx |
| NavBar | NavBar.tsx |
| Notification | Notification.tsx |
| Radio | Radio.tsx |
| Stepper | Stepper.tsx |
| Tabs | Tabs.tsx |

Barrel export: `packages/ui/components/rmg/index.ts`
Showcase: `plato-nucleus.vercel.app/design-system`

### Styling rule — ADR-023 (non-negotiable)

Tailwind does **not** scan `packages/ui`. All components use:
- Inline styles (`React.CSSProperties`) for all visual styling
- CSS variables (`var(--rmg-*)`) for all token values — no hardcoded hex
- `useState` for interactive states (hover, focus, pressed)
- JS event handlers (`onMouseEnter`/`onMouseLeave`, `onFocus`/`onBlur`) for
  interaction
- No Tailwind classes anywhere under `packages/ui/`

Tailwind **is** available in `apps/tessera` and `apps/nucleus` for
page-level layout. All colours, spacing, and token values must still use
`--rmg-*` CSS variables, not hardcoded hex.

Token file: `packages/config/tokens/rmg.css`
Tailwind preset: `packages/config/tailwind/rmg.preset.ts`

### Supplier brand colours (from DB — use these, do not hardcode elsewhere)

| Supplier | Colour |
|---|---|
| RMG | `#E2001A` |
| CG (Capgemini) | `#003C82` |
| TCS | `#9B0A6E` |
| HT (Happy Team) | `#FF8C00` |
| NH (North Highland) | `#1A2B5B` |
| EPAM | `#3D3D3D` |
| TAAS | `#7C3AED` |
| LT (Lean Tree) | `#3ABFB8` |
| HCL | `#1976F2` |

---

## Session Rules (read at the start of every session)

1. **Identify session type at the start** and load the appropriate skill:
   - UI / frontend work → load `frontend-design` skill
   - Document creation → load `docx` or `pdf` skill
   - Spreadsheet output → load `xlsx` skill
   - Default for any coding session → load `frontend-design` skill

2. **One domain per session** — don't drift into adjacent concerns mid-session

3. **Monitor thread length actively** — Claude must track conversation
   length and flag proactively. Long threads degrade response quality and
   waste tokens as context fills up.

   - At **~15 messages**: flag that the thread is getting long and suggest
     wrapping up at the next logical break point
   - At **~25 messages**: strongly recommend ending the session now —
     summarise, produce handoff notes, and start a fresh thread
   - At **~35+ messages**: warn that context quality is degrading and
     refuse to start new work until a fresh thread is opened

   The flag should be a brief visible notice at the top of the response:
   > ⚠️ **Thread length notice** — This thread is X messages long.
   > Consider wrapping up and starting fresh to preserve response quality.

4. **Proactively reduce token usage** — flag when context is being wasted on
   re-explanation that should be in a file. Every decision that matters
   should be in a `.md` file, not repeated in chat.

5. **ADR first** — any deviation from the locked tech stack or architectural
   principles requires an ADR before implementation

6. **No settling** — if a shortcut creates technical debt, flag it. Don't
   silently comply.

7. **Challenge naming** — proactively screen any proposed names against
   existing products, brands, and AI company namespaces before suggesting

8. **If it matters, it goes in a file** — product decisions must never live
   only in conversation history. Update the relevant `.md` file immediately
   when decisions are made.

9. **End-of-session ritual (always)** — At the end of every session, or at
   the ~15 message flag point, Claude must:
   - Summarise decisions made and anything new that was confirmed or changed
   - Produce updated versions of any project context files that changed
   - Produce a Claude Code prompt for any repo documentation that needs
     updating
   - Tell Matt to re-upload the updated files to the Claude Project

---

## Key Learnings & Patterns (accumulated — do not repeat these mistakes)

- **RLS silent failures:** When any Supabase query returns 0 rows silently,
  check RLS policies before touching code. All Tessera tables need open
  SELECT policies (anon) for MVP. Check:
  `SELECT tablename, policyname FROM pg_policies WHERE tablename='[table]'`

- **Seed data idempotency:** Use explicit UUID literals throughout seed data.
  `ON CONFLICT (id) DO NOTHING` then works correctly on re-runs.

- **Vercel dual React instance:** Use npm `overrides` (not `resolutions`) in
  root `package.json`, `transpilePackages` in `next.config.ts`,
  `peerDependencies >=18` in `packages/ui/package.json`.

- **Static mockup before build:** Matt prefers a static HTML mockup before
  burning Claude Code tokens on implementation.

- **HTML export interactivity:** When generating standalone HTML files from
  TypeScript template literals, never use template literals (backticks) inside
  the embedded `<script>` block — they conflict with the outer template
  literal. Use `JSON.stringify` for data embedding and string concatenation
  for all JS logic. Wrap all JS in `DOMContentLoaded`.

- **GitHub URL rule:** GitHub URLs are blocked from `web_fetch`. When repo
  file analysis is needed, generate a Claude Code Web prompt for Matt to run.

- **PlatoShell in layout.tsx is mandatory:** Every new page session must
  verify the app's root `layout.tsx` uses `<PlatoShell>` before writing
  page code. Claude Code will skip this check unless explicitly instructed.
  The prompt must say: "Check that layout.tsx uses PlatoShell. If not,
  fix the layout first."

- **RMG financial year runs April–March:** Q1 = Apr–Jun, Q2 = Jul–Sep,
  Q3 = Oct–Dec, Q4 = Jan–Mar. Q4 FY 25/26 = Jan–Mar **2026**. Never
  use calendar year logic for RMG period dates.

- **RLS on Nucleus financial tables:** `periods`, `resource_period_allocations`,
  and `cost_configurations` all have restrictive RLS by default. If any
  of these tables return 0 rows silently, apply open SELECT policy per
  ADR-031. This has already been applied once — check before assuming a
  data or query issue.

- **VAT logic — RMG internal resources:** The 7.082% irrecoverable VAT
  uplift applies to **external suppliers only**. RMG internal resources
  do not attract irrecoverable VAT. Applying the uplift to RMG resources
  inflates the blended rate incorrectly. Supplier check: if
  `supplier_name = 'Royal Mail Group'`, use base cost only; otherwise
  multiply by `(1 + vat_uplift_percent / 100)`.

- **Planview code taxonomy:** Four values used in
  `resource_period_allocations.planview_code`:
  - `PR` — Platform Request: time-recoverable via PR tickets and
    internal recharge. These days form the denominator for the blended
    rate calculation.
  - `F_Gov` — Factory Governance: platform overhead. Cost embedded in
    base but days NOT included in the X-Chargeable Days denominator.
    Each F_Gov resource inflates the blended rate for everyone else.
    Use sparingly. F_Gov resources have no team assignment and render
    "No team" on the schedule — this is correct and intentional.
  - `BAU` — Business As Usual: not borne by the platform. Excluded from
    all cost totals and day counts.
  - `ETP` — Enterprise Tooling Platform: flat cost line items for shared
    tooling and services. Added on top of the base rate for the
    "rate inc. ETP & SS" figure.

- **Money is stored as integer pence (ADR-029):** All day rates and cost
  figures in the DB are in pence (£ × 100). Always divide by 100 for
  display. Never store or display fractional pounds. Cost formula:
  `day_rate × capacity_days × utilisation_percent / 100` (all in pence),
  then divide by 100 for £ display. Never omit utilisation_percent.

- **Period duplicate pattern:** Creating a new quarter's schedule starts
  by duplicating `resource_period_allocations` from the previous period
  to a new draft period row. This is the intended workflow — never build
  a new quarter from scratch unless it is genuinely a new platform
  configuration.

- **Team assignment period scoping:** `resource_team_assignments` has a
  nullable `period_id` column. NULL rows = current state. Period-scoped
  rows (period_id set) = historical snapshots for that quarter. The
  schedule page must filter `rta.period_id = <active period>` to show
  historically accurate team data. When backfilling a new quarter's team
  assignments, INSERT new rows with the target period_id — do NOT update
  the NULL (current-state) rows. The schedule query must use
  `rpa.supplier_id` (from migration 007) for supplier grouping, not
  `resources.supplier_id`, so that TBC/Vacant rows are correctly
  attributed.

- **supplier_id on resource_period_allocations (migration 007):** Every
  allocation row now carries supplier_id directly. Named rows are
  backfilled from resources.supplier_id. TBC/Vacant rows (resource_id
  IS NULL) require supplier_id to be set explicitly on insert. The
  schedule page groups by rpa.supplier_id — never by resource.supplier_id.

- **Orion workstream change in Q2 FY 26/27:** Team Orion moves from
  Out of Home (OOH) to Web & App (WAA) workstream from Q2 FY 26/27
  onwards. The `team_workstreams` table does not currently support
  date-bounded membership — this is a known gap requiring a future
  migration before Q2 is activated.

- **Multi-allocation per resource per period is valid:** A single
  resource can have more than one `resource_period_allocations` row in
  the same period. This is intentional and supports scenarios such as a
  person changing location mid-quarter (e.g. offshore → onshore) which
  changes their rate, location, and cost profile. Each row is a distinct
  cost snapshot. The schedule UI must handle and display multiple rows
  per person correctly.

- **Vacant / TBC schedule slots:** `resource_id` is nullable on
  `resource_period_allocations` (migration 006). TBC/Vacant rows must
  have `supplier_id` set (migration 007) so they group correctly by
  supplier. Render `resource_name` as "TBC" with italic styling when
  null. All cost and day calculations apply identically to TBC rows.

- **Active vs rolled-off resources:** Use `resource_rolloff_date` to
  represent resources who have left the programme. Do NOT use `deleted_at`
  for this — deleted_at means the record was an error. A rolled-off
  resource is historically important and must remain queryable. The
  resources list UI should offer a toggle: "Show active only" filters
  `WHERE resource_rolloff_date IS NULL OR resource_rolloff_date > NOW()`.

---

## Model Selection Guide

| Task | Recommended Model | Reason |
|---|---|---|
| Product thinking, architecture, documentation | Claude Sonnet | Fast, strong reasoning, handles long context |
| Complex multi-file refactors | Claude Opus | Stronger reasoning across large codebases |
| Foundational architecture or schema decisions | Claude Opus | More thorough analysis worth the extra time |
| Quick contained bug fixes | Claude Sonnet or Haiku | Faster and cheaper for simple tasks |
| Very long context — ingesting entire codebase | Gemini 1.5 Pro | Larger context window |
| Generating varied synthetic / seed data | GPT-4o | Produces more natural domain-specific data |

---

## Coding Standards (enforced every session)

- **Every new page must use `<PlatoShell>`** — before writing any page
  component in any app, verify that the app's root `layout.tsx` imports
  `<PlatoShell>` from `@plato/ui` and wraps `{children}` with it. If it
  does not, fix the layout first. Never ship a page that renders outside
  the shell.

- TypeScript strict mode throughout — no `any`, no exceptions
- Never use arbitrary Tailwind hex values — extend `tailwind.config.ts` with
  named tokens
- Never call vendor SDKs directly — always use the `@plato/[package]`
  abstraction layer
- **Tests are mandatory and non-negotiable.** Every new or modified pure
  function must have a co-located unit test written in the same commit —
  never retroactively. This applies to query functions, data transforms,
  utility helpers, cost calculations, and any function with a return value.
  If Claude Code skips a testable function it must name it explicitly in
  the report-back and justify the omission. Silence on testing = violation.
- Use **vitest** for all unit and integration tests
- Test file naming: `functionName.test.ts`, lives in `__tests__/` alongside
  the code it tests
- Mock Supabase at the boundary — never make real DB calls in unit tests
- Check every new component at 390px width before considering it done
- Always protect against TypeScript errors that will break the Vercel build
- Commit and push at the end of every task

---

## Standard Claude Code Prompt Structure

Every Claude Code prompt generated in this project must include the
following block verbatim. There is no task too small to omit it —
if a task produces a pure function, it needs a test.

```
## Pre-flight
1. Confirm you are on a new claude/ branch — do not commit to main
2. Check layout.tsx uses PlatoShell — fix if not before doing anything else

## Tests (mandatory — same commit, not a follow-up)
For every new or modified pure function in this task:
- Write a co-located unit test in __tests__/[functionName].test.ts
- Use vitest
- Mock Supabase at the boundary — no real DB calls in tests
- Cover: happy path, null/empty inputs, edge cases relevant to the logic

If a function genuinely cannot be unit tested (e.g. a React Server
Component with no extractable logic), name it in the report-back and
explain why. Skipping without explanation is not acceptable.

## Report back (always include)
- Files changed (paths)
- Functions added or modified
- Test files created and what each test covers
- Any TypeScript errors encountered and how they were resolved
- Confirm the Vercel build would pass (no type errors, no lint errors)
```

---

## Language and Formatting

- Use £ not $
- en-GB dates and British spelling throughout
- Format all code and prompts in code blocks — always copy/pasteable
- Be direct and opinionated — challenge before complying, not after

---

## Reference Repositories (pre-rebrand, read-only reference)

| Repo | Module |
|---|---|
| `matthew-bruce/pi-planning-tool` | Despatch |
| `matthew-bruce/vibe-engineering-chronicle` | Chronicle |
| `matthew-bruce/platform-org-structure` | Org Chart |
| `matthew-bruce/platform-roadmap-poc` | Roadmap |

---

## What We Are Not Building

- A project management tool competing with Monday.com or Jira on breadth
- A tool for any specific client
- Anything monolithic
- Anything that requires a specific cloud vendor to run
