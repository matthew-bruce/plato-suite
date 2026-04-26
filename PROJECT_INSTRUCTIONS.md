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

### The one rule: always work on main

Every Claude Code prompt **must** begin with:

```
Work directly on the main branch.
```

This is non-negotiable. Do not omit it.

### Why this matters

Claude Code Web creates a `claude/` prefixed branch by default if not
instructed otherwise. If two sessions run without this prefix, they can
work on diverging branches without knowing about each other. When those
branches are eventually merged, conflicts appear — wasting significant
time on housekeeping that should never have been needed.

The deployment pipeline is: **commit to main → Vercel auto-deploys**.
Branch preview deployments are not used. There is no need for any branch
other than main.

### What "origin/main" means

- `main` = the branch in the local Claude Code environment
- `origin/main` = the same branch on GitHub (`github.com/matthew-bruce/plato-suite`)
- `git push` sends local `main` → `origin/main`
- `git pull` / `git fetch` brings `origin/main` → local `main`

If these ever diverge (two sessions working in parallel without pulling),
a merge conflict will occur. The "Work directly on the main branch"
instruction prevents this by ensuring every session starts from and
pushes directly to the same linear history.

### Never do these things

- Never create `claude/` prefixed branches
- Never open PRs — commit directly to main
- Never use `--force` or `--force-with-lease` on main without explicit instruction
- Never leave uncommitted work at the end of a session

### End of session: always push

Every session must end with:
```
git add . && git commit -m "..." && git push origin main
```

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
- `resource_rolloff_date DATE` — actual or planned exit date
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

3. **Flag at ~15 messages** or a logical break point — summarise decisions,
   end session, start fresh

4. **Proactively reduce token usage** — flag when context is being wasted on
   re-explanation that should be in a file

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

- TypeScript strict mode throughout — no `any`, no exceptions
- Never use arbitrary Tailwind hex values — extend `tailwind.config.ts` with
  named tokens
- Never call vendor SDKs directly — always use the `@plato/[package]`
  abstraction layer
- Any new pure function gets a unit test written at the same time — not
  retroactively
- Check every new component at 390px width before considering it done
- Always protect against TypeScript errors that will break the Vercel build
- Commit and push at the end of every task
- Use **vitest** for unit and integration tests
- Test file naming: `functionName.test.ts`, lives in `__tests__/` alongside
  the code it tests

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
