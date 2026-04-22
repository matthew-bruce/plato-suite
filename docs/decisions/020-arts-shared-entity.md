# ADR-020 — ARTs Are a Shared Entity, Not Despatch-Exclusive

Date: 2026-04-19
Status: Accepted

## Decision
Agile Release Trains (ARTs) are defined in the core schema (`arts` table)
and are available to all modules. They are not owned by Despatch.
Any module can reference ARTs. Any user can create ARTs as an
organisational grouping mechanism.

## Context
ARTs are commercially-defined groupings that cut across technology
platforms. In PI Planning (Despatch), ARTs are the primary planning
unit. In Roadmapping (Cursus), roadmap items and workstreams may be
aligned to ARTs. In Nucleus, workstreams have an optional `art_id` FK.

Making ARTs Despatch-exclusive would prevent Cursus and Nucleus from
using them meaningfully, and would require Despatch to be deployed
before any other module could reference ART groupings.

## Key rules
- ARTs have no fixed Platform affiliation — they are cross-Platform
- A Workstream not linked to any ART is valid (`art_id` is nullable)
- Tech-defined workstreams typically have `art_id = NULL`
- Commercially-defined workstreams are linked to an ART
- Team-to-ART membership is per Program Increment, not fixed
  (via `team_art_assignments` — a Despatch-owned table)
- The `arts` table in core schema holds only the ART definition.
  Operational PI Planning data lives in Despatch-owned tables.

## Consequences
- ARTs can be managed from Nucleus, Cursus, or Despatch — whichever
  module is deployed
- The `sort_order` column on `arts` allows custom display ordering
  per deployment (used in Despatch's planning header)
- `art_code` (short name, e.g. WAA, OOH) is stored on the `arts`
  table for use in constrained UI spaces
