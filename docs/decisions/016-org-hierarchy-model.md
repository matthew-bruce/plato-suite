# ADR-016 — Org Hierarchy Model

Date: 2026-04-19
Status: Accepted

## Decision
The organisational hierarchy is: Platform (L3) → Workstream (L2) →
Team (L1), with ARTs as a cross-cutting commercial grouping that does
not map to the technology hierarchy.

```
Platform          — Technology-owned, long-running, stable
  └── Workstream  — Grouping of related work, Platform-scoped
        └── Team  — Delivery team (optional — Platforms can exist without Teams)
ART               — Agile Release Train, Commercially-defined, cross-Platform
```

## Context
Platform Engineering organisations commonly distinguish between
technology-owned platforms and commercially-defined programme groupings
(ARTs/Value Streams). These are orthogonal concerns. A Team always
belongs to a Platform. A Team's ART membership is determined per
Program Increment via `team_art_assignments` — it is not a fixed
property of the Team.

## Key rules locked by this decision
- `platform_id` FK on `teams` is NOT NULL — a team always belongs to a platform
- `workstream_id` FK on `teams` is nullable — teams are optional members of workstreams
- Platforms have no `art_id` — platforms are ART-agnostic
- A team can work across multiple ARTs in the same PI via multiple
  `team_art_assignments` rows
- Workstreams have a nullable `art_id` — Tech-funded workstreams have
  NULL, Commercially-funded workstreams are linked to an ART

## Consequences
- Finance calculations (rate cards, cost configurations, period
  allocations) are scoped to Platforms, not ARTs
- PI Planning (Despatch) uses ART as its primary grouping, not Platform
- The URL structure in Nucleus is `/platforms/[platformSlug]/...`
