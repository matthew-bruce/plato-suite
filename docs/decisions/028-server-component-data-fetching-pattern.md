# ADR-028 — Server Component Data Fetching Pattern

Date: 2026-04-19
Status: Accepted

## Decision
All Supabase data fetching in Nucleus (and by convention, all Plato
modules) follows this pattern:

1. `page.tsx` is an async server component. It fetches data and passes
   it as typed props to a client component.
2. The client component (`*View.tsx` or `*Board.tsx`) renders the UI
   and handles interactivity.
3. Mutations use Next.js Server Actions (`'use server'` functions).
4. After a mutation, `revalidatePath()` flushes the Next.js cache and
   triggers a fresh server-side fetch.
5. All pages that fetch live data include `export const dynamic = 'force-dynamic'`
   to prevent stale prerendered responses.

```
page.tsx (server component, async)
  → lib/supabase/[entity].ts (data query using @plato/schema)
    → Supabase
      → typed data returned
        → passed as props to [Entity]View.tsx (client component)
          → mutations via lib/actions/[entity].ts (server actions)
            → revalidatePath() flushes cache
```

## Context
This is the same pattern established in Despatch, generalised for Nucleus.
It gives the best of both worlds: server-side data fetching for performance
and SEO, with client-side interactivity for modals, forms, and state.

## Canonical reference
`apps/nucleus/app/platforms/page.tsx` +
`apps/nucleus/components/platforms/PlatformsView.tsx` +
`apps/nucleus/lib/supabase/platforms.ts` +
`apps/nucleus/lib/actions/platforms.ts`

## Rules
- Never fetch data in a client component on mount — fetch server-side
  and pass as props
- Never call `@plato/schema` directly from a client component — use
  server actions or API routes
- `force-dynamic` is required on any page that must show live data —
  without it, Next.js may serve a stale prerendered response
- API routes (`app/api/`) are used only for client-triggered re-fetches
  (e.g. ART switching in Despatch) — not as the primary data path

## Consequences
- Pages are bookmarkable and server-rendered for the initial load
- No loading spinners for initial page data — data arrives with the HTML
- Modal state (open/closed, form values) lives in client component state
- The `revalidatePath` approach means the page re-fetches after a
  mutation, which is slightly slower than an optimistic UI update —
  this is acceptable for a management tool where correctness matters
  more than perceived speed
