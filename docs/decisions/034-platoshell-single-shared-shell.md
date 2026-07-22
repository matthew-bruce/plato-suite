# ADR-034 — PlatoShell: Single Shared Shell Component, Mandatory for All Apps

**Date:** decision predates this ADR file (referenced in `ARCHITECTURE.md` and
`docs/design/PLATO-DESIGN-SYSTEM.md` since at least April 2026); ADR written
retroactively 2026-07-22
**Status:** Accepted

---

## Decision

`PlatoShell` (`packages/ui/components/shell/PlatoShell.tsx`, exported from
`@plato/ui`) is the single shared shell for every Plato Suite application. It
owns:

- The global top navigation bar (fixed, 40px, full viewport width — spans
  across the top of the sidebar, not beside it)
- The per-app left-hand sidebar (fixed, 220px expanded / 56px collapsed,
  icon-only when collapsed) with configurable navigation sections
- Collapse/expand behaviour with `localStorage` persistence
- Active route detection via `usePathname()`

**No app may implement its own shell, global header, or sidebar. This rule
has no exceptions.**

---

## Context

Prior to this decision, each app risked reimplementing its own header and
sidebar chrome, which would fragment navigation, break the "coherent suite"
feel (PRINCIPLES.md §5), and multiply the surface area for hover-state,
active-state, and responsive-breakpoint bugs. A single shared shell,
configured entirely via props (`activeApp`, `appName`, `navSections`,
`configItems`), keeps every app visually and behaviourally consistent while
letting each app own its own navigation content.

This mirrors the same pattern already applied to design tokens (ADR-023):
the component is generic, the app supplies the specifics.

---

## What it looks like

```tsx
// app/layout.tsx — server component (preserves metadata export)
import { NucleusAppShell } from './_components/NucleusAppShell'
export const metadata = { ... }
export default function RootLayout({ children }) {
  return <html><body><NucleusAppShell>{children}</NucleusAppShell></body></html>
}

// app/_components/NucleusAppShell.tsx — 'use client'
import { PlatoShell } from '@plato/ui'
export function NucleusAppShell({ children }) {
  return (
    <PlatoShell activeApp="nucleus" appName="Nucleus" navSections={NAV_SECTIONS} configItems={CONFIG_ITEMS}>
      {children}
    </PlatoShell>
  )
}
```

Full visual specification (header/sidebar dimensions, colours, states) lives
in `docs/design/PLATO-DESIGN-SYSTEM.md` §0B — this ADR is the architectural
record; that file is the design reference.

---

## Adding a new app to the suite

1. Add the app key to the `activeApp` union type in `PlatoShellProps`
2. Add an entry to the `PLATO_APPS` array in `PlatoShell.tsx`
3. Add the app URL to the `appUrls` prop when using the shell

Adding a new app does not require changes in any other app.

---

## Consequences

- Every page in every app looks and behaves consistently for navigation,
  regardless of which team or session built it.
- A single component to fix, test, and extend for shell-level bugs or new
  shell features (e.g. a new configuration affordance) — not N per-app
  copies.
- Before writing any new page in any app, its root `layout.tsx` must be
  verified to wrap content with `<PlatoShell>`. This check is enforced as a
  standing coding convention (see `AI.md` / `PROJECT_INSTRUCTIONS.md`), not
  just documented here.

## Documentation note

This decision and its implementation predate this ADR file. `ARCHITECTURE.md`
had listed it as "ADR 032" in its decision-log table without a corresponding
file ever being written, which collided with the separate, later ADR-032
(nullable `resource_id` for vacant schedule slots — see
`032-nullable-resource-id-vacant-slots.md`). This ADR is filed as **034** to
resolve that collision without renumbering ADR-032 or ADR-033 (auth), both of
which are already referenced elsewhere by number.
