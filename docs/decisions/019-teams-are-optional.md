# ADR-019 — Teams Are Optional: Platforms Can Operate Without Defined Teams

Date: 2026-04-19
Status: Accepted

## Decision
Teams are optional within a Platform. A Platform is fully functional
for finance, roadmapping, and reporting without any Teams defined.
The `teams.platform_id` FK is NOT NULL (a team always belongs to a
platform), but a platform may have zero teams.

## Context
Not all Platform Engineering organisations use the same level of
team granularity. Some operate at workstream level only. Some use
teams extensively. Requiring teams to exist before any other data
can be entered would make Plato unusable for organisations that
don't model at team level.

Additionally, during initial setup, a user may want to define
Platforms and Workstreams before drilling down to Teams. Blocking
this is bad UX.

## Consequences
- The finance calculator can operate at Platform + Resource level
  without team assignments
- Roles can be `leadership` or `group_horizontal` grouping without
  a `team_id` (enforced by `roles_grouping_scope_chk` constraint)
- The Nucleus UI shows Teams as an empty section with an "Add Team"
  prompt rather than blocking access to other sections
- Despatch imports teams from external tooling — teams may exist in
  Despatch before they are formally defined in Nucleus
- Resources are not team-scoped at the `resources` table level —
  team assignment flows through `roles`, which are optional
