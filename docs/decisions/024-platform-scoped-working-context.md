# ADR-024 — Platform-Scoped Working Context in Nucleus and Cursus

Date: 2026-04-19
Status: Accepted

## Decision
In Nucleus and Cursus, the active Platform is encoded in the URL path
as the primary working context. All management pages are namespaced
under `/platforms/[platformSlug]/`. A platform switcher in the sidebar
allows users to change context without navigating back to the platforms
list.

## Context
In practice, most users (Heads of Platform, Delivery Managers) operate
within the context of a single Platform. Resources, Teams, Workstreams,
cost configurations, and rate calculations are all Platform-scoped.
Making the Platform explicit in the URL means every page is bookmarkable
and shareable with the correct context.

## Scope
This working context pattern applies to Nucleus and Cursus only.
- Despatch: Platform is a secondary filter. PI and ART are the primary
  groupings.
- Chronicle: Personal tool — no Platform context in URL.

## Alternatives Considered
**Query param (`?platform=web-platform`)** — rejected. URLs are not
bookmarkable in a meaningful way. Harder to enforce at the layout level.

**Global context store (Zustand/cookie)** — rejected. Violates 12-factor.
Breaks deep links.

**Top-level nav filter** — rejected. Doesn't provide the clean URL
hierarchy needed for nested pages.

## Consequences
- Route structure: `/platforms/[platformSlug]/overview`,
  `/platforms/[platformSlug]/teams`, etc.
- The `[platformSlug]/layout.tsx` fetches all platforms server-side
  and passes them to NucleusShell for the switcher
- Old `/platforms/[slug]` redirects to `/platforms/[slug]/overview`
- `/platforms` (no slug) remains as the global platform list
- Periods are global and live outside platform-scoped routes (TBD)
