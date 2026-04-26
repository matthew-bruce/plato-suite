# ADR-022 — org_containers as Presentation Layer Alongside Typed Hierarchy

Date: 2026-04-19
Status: Accepted

## Decision
`org_containers` is a self-referential tree table used exclusively for
flexible visual presentation (org chart views, roadmap groupings). It
does not replace the typed hierarchy (Platforms / Workstreams / Teams)
and does not participate in finance or planning calculations.

```sql
org_containers (
  org_container_id  UUID PK
  parent_id         UUID nullable FK → org_containers (self-referential)
  container_name    TEXT
  container_colour  TEXT
  sort_order        INTEGER
)
```

## Context
The typed hierarchy (Platform → Workstream → Team) is optimised for
finance and planning — it has strong FK relationships, cost scoping,
and role assignments. It is not optimised for arbitrary visual
presentation. An executive org chart may want to group teams
differently from how they appear in the finance model.

`org_containers` provides a flexible presentation layer that sits
alongside the typed hierarchy without interfering with it. Application
code connects containers to core entities — the schema does not enforce
this relationship, keeping the presentation layer maximally flexible.

## What org_containers is NOT
- Not a replacement for Platforms, Workstreams, or Teams
- Not a source of truth for finance or capacity planning
- Not a hierarchical mirror of the typed org structure
- Not required — modules that don't need flexible org chart views
  can ignore this table entirely

## Owner
Cursus (the roadmap module) provides the primary management UI for
`org_containers`. The table lives in core schema so other modules
can reference it, but Cursus owns the CRUD experience.

## Consequences
- Finance and planning queries never touch `org_containers`
- Deleting a container does not cascade to any Platform, Workstream,
  or Team — the relationship is maintained in application code only
- A container can reference any core entity — the flexibility is
  intentional and does not require schema changes to support new
  entity types
