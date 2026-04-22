# ADR-002 — Next.js App Router

Date: 2026-04-19
Status: Accepted

## Decision
All Plato Suite modules use Next.js with the App Router (not the Pages
Router). The minimum version is Next.js 15. React Server Components
are used for data fetching. Client components are used for interactivity.

## Context
The App Router introduced in Next.js 13 and stabilised in Next.js 14+
provides React Server Components, nested layouts, server actions, and
a data fetching model that aligns well with Supabase's server-side
client pattern. The Pages Router is the legacy approach and will
eventually be removed.

## Key conventions enforced by this decision
- `page.tsx` is always a server component by default — `'use client'`
  must be explicit
- Data fetching happens in server components, never in client components
  on mount (see ADR-028)
- Layouts (`layout.tsx`) are server components that wrap pages — used
  for persistent navigation shells (ADR-025)
- Server Actions (`'use server'`) are used for mutations — no separate
  API routes for CRUD operations unless a client-triggered re-fetch
  is needed
- `export const dynamic = 'force-dynamic'` is required on pages that
  must not be statically prerendered

## Consequences
- `params` in dynamic route pages must be typed as
  `Promise<{ slug: string }>` and awaited in Next.js 15+
- The Pages Router (`pages/` directory) must never be used — any
  legacy code using it must be migrated before inclusion in the suite
- Vercel is the natural deployment target (native Next.js support)
  but the app must remain container-portable (ADR-005)
