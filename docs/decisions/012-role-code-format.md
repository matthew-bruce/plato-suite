# ADR-012 — Role Code Format: {ROLE}-{NNN}

Date: 2026-04-19
Status: Accepted

## Decision
Role codes follow the format `{ROLE}-{NNN}` where ROLE is the
role_definition code (e.g. ENG, DO, QA) and NNN is a zero-padded
monotonically increasing integer scoped per role type.

Examples: `ENG-001`, `ENG-002`, `DO-001`, `QA-001`, `PO-003`

Role codes are immutable once assigned. They are not team-scoped.

## Context
Role slots need a stable, human-readable identifier for use in
planning documents, rate cards, and communications. A UUID alone
is not usable in a spreadsheet or a conversation. The format must
be predictable, unique, and meaningful to practitioners.

Not scoping codes to teams was a deliberate choice — a person moving
from one team to another keeps the same role code. The code identifies
the slot, not its location.

## Rules
- Code generation is the application's responsibility — not a DB sequence
- The application must query the highest existing NNN for a given role
  type and increment by 1 before inserting
- Once a code is assigned it never changes, even if the role is soft-deleted
- Uniqueness is enforced via a partial unique index on `role_code`
  WHERE `deleted_at IS NULL`

## Consequences
- Application code must handle concurrent role creation carefully
  (two simultaneous inserts for ENG could collide on NNN)
- Soft-deleted roles retain their code — a deleted ENG-004 means
  the next ENG role is ENG-005, not ENG-004
- Codes are suitable for use in external documents and
  communications as stable references
