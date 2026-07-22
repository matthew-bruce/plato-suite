# Working Agreement — Claude Chat / Claude Code / GitHub Issues

Single source of truth for *how we work*, not *what's currently true* about
Plato. If a rule here starts describing project status rather than process,
it belongs somewhere else — move it out.

## Who owns what

| System | Owns | Never owns |
|---|---|---|
| GitHub Issues | Backlog status — what's outstanding, done, blocked | Architecture rationale, historical decisions |
| ADRs (`docs/decisions/`) | Why a decision was made, at the time | Current status — never edited to reflect new reality, only superseded |
| Living docs (`ARCHITECTURE.md`, `SCHEMA_DESIGN.md`, etc.) | Current-state reference — what's true *right now* | Task lists, "known issues" sections, anything pending |
| Claude's memory | Conversational continuity between chat sessions | Ground truth on anything checkable — schema, code, issue status |

**Living docs do not have "known issues"/"pending" sections.** If it's not
done, it's a GitHub Issue, referenced by number if useful (`see #7`) — never
restated as prose that can go stale independently.

**Closed means closed.** Once something is explicitly resolved/rejected/
parked (in memory, an Issue, or a doc), it stays that way unless Matt
reopens it. Claude should not resurface settled questions "just in case" —
if genuinely unsure whether something is still open, ask rather than
restate it as if it were.

## Conflict resolution

When a living doc, an ADR, or Claude's memory makes a claim that can't be
verified against the live schema/code/repo, don't quietly reconcile it one
way. State the discrepancy plainly, verify against the live source where
possible, and let Matt see the conflict rather than papering over it. This
is how the migration-006 and migration 007–010 gaps were actually found —
keep finding them this way, not by trusting whichever source was checked
first.

## Attribution discipline

A past Claude Chat suggestion is not a decision until Matt has actually
confirmed it. When referencing a prior decision, Claude should be able to
point to Matt's actual agreement, not just to Claude having proposed
something and it going unchallenged. This matters most in long threads and
when memory pulls in context from old sessions.

## Handoff rules

1. A backlog item surfacing anywhere (chat, or something Claude Code finds
   mid-build) gets a GitHub Issue before that session ends. Claude's memory
   can hold it *temporarily* mid-conversation — it is never the permanent
   home for it.
2. A Claude Code prompt that resolves a backlog item references the Issue
   number and closes it in the same pass — not as a manual follow-up step.
3. Any schema change applied directly via Supabase MCP (`apply_migration`)
   gets its SQL committed as a real migration file in the same session,
   full stop. (This is the exact rule born from the ADR-032/migration-006
   gap found 2026-07-22 — a migration was applied live via MCP but never
   committed to the repo, creating a two-month undocumented drift. The
   same pattern was found again in migrations 007–010 on 2026-07-22.)
4. A genuine architectural decision gets an ADR before or immediately after
   the related Issue closes — never "ADR needed" left as a dangling note
   in a living doc.

## MCP connector usage

Read operations against any connected MCP (Supabase, Vercel, GitHub, or
anything added later) can happen freely, without asking first — this is
how facts get verified against live reality rather than assumed.

Any write, edit, delete, or state-changing action through an MCP connector
requires asking first, in plain language, exactly what's about to happen
and why — every time, no exceptions for "small" changes. This applies
even when Matt has approved something conceptually in conversation; the
actual execution step still gets a clear, explicit confirmation before it
runs.

## Debugging and verification

- Any second (or later) attempt at fixing the same bug reads the actual
  current code/markup fresh before touching anything — never assumes the
  prior attempt's understanding was correct and just needs adjusting.
- Fixes get verified empirically wherever possible (a real build, a live
  query, a measured result) rather than just asserted as done. "It should
  work now" is not a substitute for actually checking.
- For any visual/UI bug, a screenshot is the expected default — Claude
  should ask for one before guessing at a fix if one hasn't been provided.

## Testing

Every new pure function, utility, or non-trivial piece of business logic
gets a unit test written at the same time it's written — never
retroactively, never as a follow-up. This applies to every coding prompt
without exception, regardless of how small or "obviously correct" the
change seems. Use vitest, test files alongside the code they test in
`__tests__/`, named `functionName.test.ts`. A prompt that adds logic
without adding its test is incomplete, not just imperfect.

## Model selection

Every Claude Code prompt gets an explicit model recommendation, stated
plainly, not left to default:
- **Sonnet** — contained bug fixes, mechanical edits, well-specified
  changes against an already-settled design, read-only investigation/audit
  work
- **Opus** — multi-file architectural work, anything security-relevant
  (auth, RLS), cross-cutting changes spanning schema + multiple apps
- Escalate mid-task if a Sonnet prompt surfaces genuine architectural
  ambiguity rather than pushing through with a guess

## Design system consistency

Before writing any new UI: check `packages/ui` and `PLATO-DESIGN-SYSTEM.md`
for an existing component or pattern first. Use what exists. Where nothing
fits, build it as a new reusable `packages/ui` component — RMG-styled per
ADR-023 — rather than a one-off, app-specific implementation. This applies
across every app in the monorepo, not per-module. Any build prompt
touching UI should say so explicitly (check existing components first;
build new ones as shared, not local).

## Session length management

Long threads burn tokens on re-establishing context and make it easier to
lose track of what's actually been decided versus discussed. Claude should
proactively flag a natural handoff point when:
- The conversation has covered multiple unrelated pieces of work (e.g. a
  full feature build, then unrelated bugfixes, then a documentation pass)
- ~15 exchanges have passed since the last natural break, per the
  project's own session rules
- A significant piece of work has just been merged/completed — a clean
  stopping point, not just a token-count trigger

When flagging, Claude should: summarise what's been decided/completed,
confirm what (if anything) is still open, and offer a ready-to-paste
handoff prompt for a new thread — not just say "this is getting long."
Matt should not have to be the one to notice and ask for this.

## Branch workflow

`main` is protected — direct pushes are blocked at GitHub level. Claude
Code always creates a `claude/` branch; Matt reviews and merges via GitHub
UI, then deletes the branch. Never let more than 2 unmerged `claude/`
branches accumulate at once.

## Supabase MCP conventions

- `apply_migration` for all DDL; `execute_sql` for DML — never mixed
- `list_tables` row counts are estimates — verify with `COUNT(*)`
- Every migration applied via MCP is committed as a file in the same
  session (see Handoff rule 3)

## Keeping this document itself honest

This file lives in the repo (canonical) and as a Project File in Claude's
chat project (mirror, kept in sync manually — paste in the repo version
whenever this changes). It should change rarely; if it's changing often,
something is being treated as process that's actually a status update, and
belongs in an Issue or a living doc instead.
