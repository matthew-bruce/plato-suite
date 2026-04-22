# PROJECT_INSTRUCTIONS.md — Plato Suite

> Quick-start reference for contributors and AI coding assistants.
> For full architectural context see ARCHITECTURE.md and AI.md.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16.x App Router |
| UI | React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v3 + CSS custom properties |
| Database | Supabase (Postgres) via `@plato/schema` |
| Auth | Supabase Auth / OIDC via `@plato/auth` |
| Monorepo | Turborepo + npm workspaces |
| Node | 24.x |

---

## Getting Started

```bash
# Install all workspace dependencies
npm install

# Run Nucleus (port 3000)
cd apps/nucleus && npm run dev

# Run Tessera (port 3004)
cd apps/tessera && npm run dev
```

Each app requires its own `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Key Rules

1. **No vendor SDKs in app code** — import from `@plato/schema`, `@plato/auth`, etc.
   - Tessera exception: direct Supabase calls are permitted. See ADR-TESS-002.
2. **No Tailwind in `packages/ui/`** — inline styles only (ADR-023)
3. **All CSS values via tokens** — `--rmg-*` or `--plato-*` custom properties
4. **No `any` in TypeScript** — strict mode, no exceptions
5. **Never hard delete** — set `deleted_at`, use soft deletes everywhere
6. **Commit and push at end of every task**

---

## Monorepo Layout

```
apps/nucleus/        ← Module 1: org chart, resources, finance
apps/dispatch/       ← Module 2: PI planning
apps/chronicle/      ← Module 3: knowledge OS
apps/roadmap/        ← Module 4: executive canvas
apps/tessera/        ← Internal tool: KT OS (see ADR-TESS-002)
packages/ui/         ← shared React components
packages/schema/     ← DB types + Supabase client abstraction
packages/auth/       ← OIDC auth implementation
packages/config/     ← Tailwind, ESLint, TSConfig, tenant config
docs/decisions/      ← ADRs 001–031, ADR-TESS-001, ADR-TESS-002
```

---

## Adding a New Page (App Router pattern)

```tsx
// apps/[module]/src/app/[route]/page.tsx
import { TesseraShell } from '@plato/ui/components/tessera'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function MyPage() {
  const { data } = await supabase.from('kt_domains').select('*')
  return (
    <TesseraShell activeRoute="/my-route">
      {/* page content */}
    </TesseraShell>
  )
}
```

- Server Components fetch data directly — no useEffect, no SWR
- Client Components (`'use client'`) only for interactivity
- `await params` before destructuring in dynamic routes (Next.js 16.x requirement)

---

## ADR Process

Any deviation from core architectural principles requires an ADR in
`docs/decisions/` before implementation.

- Product ADRs: `docs/decisions/NNN-short-title.md`
- Tessera-specific: `docs/decisions/ADR-TESS-NNN.md`

See ARCHITECTURE.md for the full decision log.
