# ADR-025 — NucleusShell Sidebar Navigation

Date: 2026-04-19
Status: Accepted

## Decision
Nucleus uses a fixed left sidebar for primary navigation, following
the pattern established by Despatch. The shell component lives in
`packages/ui/components/nucleus/NucleusShell.tsx` and is consumed by
the Nucleus app's `[platformSlug]/layout.tsx`.

Sidebar widths: expanded 240px, collapsed 52px.
Collapse state persists in localStorage (`nucleus_nav_collapsed`).
On mobile (< 768px): always collapsed, no toggle shown.

## Context
A management tool with multiple sections (Teams, Workstreams, Resources,
Periods) benefits from persistent nav visibility rather than a top nav
that disappears when scrolling. The Despatch sidebar established this
pattern and it works well.

The sidebar contains:
1. Brand area (app name + subtitle)
2. Red accent stripe
3. Platform switcher (the working context selector)
4. Management nav items with lucide-react icons
5. Settings pinned to bottom

## Why packages/ui and not apps/nucleus
The suite will eventually share a shell pattern across modules. Putting
NucleusShell in `packages/ui` establishes that shell components are
shared infrastructure, not app-local code.

## Consequences
- ADR-023 applies: inline styles + CSS vars only in packages/ui —
  no Tailwind, no hardcoded hex values
- Root `apps/nucleus/app/layout.tsx` is minimal — just html/body
  wrappers. Navigation is the shell's responsibility.
- Pages outside the platform context (e.g. `/platforms` list) render
  without the sidebar and use a simple header instead
