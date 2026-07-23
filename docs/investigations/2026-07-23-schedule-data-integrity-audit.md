# Schedule / Cost Data Integrity Audit — Nucleus

**Date:** 2026-07-23
**Project:** Supabase `nwltpivvqynkfghazjpi` (live)
**Method:** Independent, read-only. Started from raw DB rows and raw source code;
prior-session conclusions were only cross-checked at the end (Task C), not used
as a starting point. No data was modified; migration 027 was **not** applied.

> **Caveat on provenance.** This DB has been hand-edited via Supabase MCP during
> at least two prior chat sessions (the EPAM cleanup and the prior anomaly
> investigation). Several rows carry `created_at`/`deleted_at` timestamps from
> **today** (2026-07-23), and at least one active row (`ae4ec4d8…`, Kritika
> Sharma) was created at 16:06 today. Exact causal reconstruction from
> timestamps is therefore unreliable — this report describes **current state**
> and the **code paths that make each state reachable**, not a definitive
> event history.

Periods in scope (all four):

| period_id | name | status | locked |
|---|---|---|---|
| `bb…0001` | Q4 FY 25/26 | historic | true |
| `bb…0002` | Q1 FY 26/27 | active | true |
| `bb…0003` | Q2 FY 26/27 | draft | true |
| `10cfda7c…` | Q3 FY 26/27 | draft | false |

---

## TASK A — Raw data findings

### A.1 — Vacant-seat team assignments (`resource_team_assignments.resource_id IS NULL`)

13 vacant-seat rows exist, all in Q2 and Q3 (none in Q4/Q1). Every one has a
matching `resource_period_allocations` (rpa) row via `allocation_id` (no fully
orphaned rta). Three categories emerge:

**Category 1 — Consistent genuine vacancies** (rta vacant → rpa vacant, both active):

| period | team | allocation_id | role_title | rta_id |
|---|---|---|---|---|
| Q2 | Helion | `a826fad4…` | Engineering Lead - Mobile | `7b8f2a8c…` |
| Q2 | Pluto | `71dea5eb…` | QA Engineer | `3341e879…` |
| Q2 | Shared Resources | `198f6be6…` | Performance Test Engineer (PVT) | `9072e316…` |
| Q3 | Helion | `212884d0…` | Engineering Lead - Mobile | `1fca34c3…` |
| Q3 | Pluto | `eca26c49…` | QA Engineer | `a3fba12a…` |
| Q3 | Shared Resources | `ea4382be…` | Performance Test Engineer (PVT) | `64c0810b…` |

Plus one soft-deleted vacant row (Q2 Sagan `4ffd6ae4…`, rta deleted 2026-06-25) — inert.

**Category 2 — Orphaned vacancies** (rta vacant + active, but its rpa cost row is soft-deleted):

| period | team | allocation_id | role_title | rta_id | rpa_deleted_at |
|---|---|---|---|---|---|
| Q2 | Nebula | `25be4f50…` | QA Engineer | `688b29e5…` | 2026-06-19 11:49 |
| Q2 | Orion | `0877192e…` | QA Engineer | `69e00900…` | 2026-06-19 11:56 |

These are dead shells: a team-assignment row for a cost line that no longer
exists. They render a vacancy on the schedule that has no backing allocation.

**Category 3 — Mismatched vacancies** (rta vacant + active, but its rpa is assigned to a **named** resource):

| period | team | allocation_id | rpa_resource | role_title | vacant rta_id |
|---|---|---|---|---|---|
| Q2 | Pluto | `14b96181…` | Kritika Sharma | QA Engineer | `56805341…` |
| Q2 | Sagan | `2dd4a612…` | Basavaraj Havaler | Engineer (Drupal Agentic) | `073b3835…` |
| Q3 | Pluto | `6cb63bb8…` | Kritika Sharma | QA Engineer | `9fa9016b…` |
| Q3 | Sagan | `190d31dc…` | Basavaraj Havaler | Engineer (Drupal Agentic) | `eb7dc7df…` |

This is the core anomaly. A vacant-seat rta points (by `allocation_id`) to an
rpa cost line that is now filled by a named person, **while that same person
also has their own `resource_id`-keyed rta row** on the same team/period. Net
effect on the schedule display: the person's single filled allocation can
surface **both** as the named person and as a phantom "vacant" seat of the same
role/team. (Note: this does **not** double the cost — cost derives from the
single rpa row; it is a team-assignment display duplication only. See §C.)

Full rta history for the two affected people (incl. soft-deleted) shows the
alternating re-key churn behind these states, e.g. Kritika/Pluto Q2:

| rta_id | keyed by | created | deleted |
|---|---|---|---|
| `37ca5d09…` | resource_id | 2026-06-18 22:53 | 2026-07-08 21:09:55 |
| `3341e879…` | allocation_id `71dea5eb` (real vacancy) | 2026-07-08 21:09:55 | — |
| `9853766c…` | resource_id | 2026-07-09 09:32:09 | 2026-07-09 09:32:17 |
| `56805341…` | allocation_id `14b96181` (Kritika's own rpa) | 2026-07-09 09:33 | — |
| `ae4ec4d8…` | resource_id | **2026-07-23 16:06** (today) | — |

The final two rows (`56805341` vacant-on-her-own-allocation + `ae4ec4d8`
resource-keyed) are both active — that is the mismatch. Basavaraj/Sagan shows
the same shape (`073b3835` vacant → `2dd4a612` + `9ce6da4f` resource-keyed, both active).

### A.2 — Capacity-split anomalies (named resources)

Multi-team splits summing to exactly 1.00 are normal and abundant across all
periods (people split across 2–3 teams) — not anomalies. The genuine `SUM ≠ 1.00`
cases are **all in Q4 FY 25/26 (historic, locked)**, none have soft-deleted
history, and none are cost duplications:

| resource | period | teams | total_split | reading |
|---|---|---|---|---|
| Vipul Suriya | Q4 | Cosmos+Janus+Pluto (0.50×3) | **1.50** | over-allocated (historic) |
| Mateusz Kowalewski | Q4 | Janus+Orion (0.33×2) | 0.66 | part-time / under |
| Daniel Chambers | Q4 | Cygnus | 0.50 | part-time / under |
| Olga Bartczak | Q4 | Cygnus | 0.50 | part-time / under |
| Jakub Benzef / Jan Urbaniak / Maciej Cieslak | Q4 | 3 teams (0.33×3) | 0.99 | rounding of 1/3 splits |

Q1/Q2/Q3 have **zero** split anomalies — every named resource sums to exactly 1.00.

### A.3 — Duplicate active resource records

**Zero.** Grouping active (`deleted_at IS NULL`) resources by
`lower(trim(resource_name)) + supplier_id` returns no rows with count > 1, across
**all** suppliers (not just EPAM).

The 11 EPAM name-pairs each now have exactly **1 active + 1 soft-deleted** row:
the soft-deleted row is the **April** original (`created_at` 2026-04-22, random
UUID, retired 2026-07-23 15:35), the retained active row is the **June** one
(`created_at` 2026-06-05, sequential `e1000001-0000-0000-0000-0000000000XX`
UUID). The retained June IDs are the ones wired into Q2/Q3 allocations. The
retired April IDs have **0 cost allocations ever** and only soft-deleted team
assignments (44, all deleted) — so their retirement orphaned nothing live.

### A.4 — Period rollover / creation process

Q3 FY 26/27 was created by a **single atomic batch clone**: all **103 rpa +
125 rta** rows share the identical `created_at` of `2026-07-10 15:19:42.059751`.
This is the signature of the `create_period_with_optional_copy` RPC (migration
023) — the "Create New Period" wizard flow, copying a source period (Q2) forward.
It is a **repeatable, intended** part of the flow, not a one-off. It clones the
source period's rows **verbatim, including inconsistencies** — the Category-3
mismatches in §A.1 exist in *both* Q2 and Q3 precisely because Q3 is a faithful
clone of Q2's (already-inconsistent) state. The clone does **not** reconcile or
validate; it is a straight copy.

---

## TASK B — Code-level behaviour audit

All server actions live in `apps/nucleus/app/actions/`; RPCs in
`packages/schema/migrations/`.

### B.1 — Creating a new resource (new starter)

**Code:** `schedule-wizard.ts:469` `insertResource()` and
`schedule-wizard.ts:308` `createResourceAndAllocation()` (new mode, insert at
`:322`).

**What it does:** bare `INSERT` into `resources` — no existence check.
The only duplicate guard anywhere is a **non-blocking UI advisory**
(`AddResourceWizard.tsx:440-461`: calls `searchResources`, shows "Similar name
already found", does **not** prevent submit).

**Should:** reject or reuse an existing active resource with the same
name+supplier. **Gap:** yes — nothing at the data layer prevents a duplicate;
any script bypassing the UI (as the June EPAM bulk insert did) has no guard at
all. Migration 027 (`resources_name_supplier_active_unique`, partial unique
index) is written to close this but is **not yet applied**.

### B.2 — Assigning an existing resource to a team for a period

**Code:** normal "Add resource" path → `AddResourceWizard.tsx:622` →
`createResourceAndAllocation()` (`schedule-wizard.ts:308`).

**What it does:** always `INSERT`s a **brand-new** rpa (`:375`) + rta (`:404`).
It computes a fresh `display_order` and never queries for an existing vacant
seat of the same role/team.

**Should (for consistency):** if an unfilled vacant seat exists for that
role/team/period, offer to consume it rather than create a parallel line.
**Gap:** yes — the normal Add flow is **blind to vacant seats**. A vacant "QA
Engineer / Pluto" seat and a freshly-added named "QA Engineer / Pluto" happily
coexist as two independent allocations. (This is a design choice, not a crash —
but it is exactly how a real vacancy and a filled line for the same role end up
side by side.)

### B.3 — Creating a vacant seat (rpa + rta sides)

**Code:** `createResourceAndAllocation()` with `mode: 'tbc'`
(`schedule-wizard.ts:308`). rpa inserted with no `resource_id` (`:371` guard
skips it); if team assignments are supplied, rta inserted with
`allocation_id = <new alloc>` and no `resource_id` (`:396-400`).

**Linkage:** vacant rta ↔ vacant rpa is by **`allocation_id`**. It is
**optional** — a vacant rpa can exist with no rta at all (if no team chosen),
and the two sides are only associated by that nullable FK. There is no DB
constraint requiring an rta per vacant rpa, nor requiring the rta's
`resource_id` to stay NULL while the rpa's is NULL.

### B.4 — Assigning a resource INTO an existing vacant seat

**Code exists:** yes — `schedule.ts:35` `assignResourceToAllocation()`, invoked
from the wizard's assign-mode existing path (`AddResourceWizard.tsx:514-531`).

**What it does:**
1. `UPDATE resource_period_allocations SET resource_id = … WHERE allocation_id = …` (`schedule.ts:45`).
2. Re-keys the vacant rta: `UPDATE resource_team_assignments SET resource_id = …, allocation_id = NULL WHERE allocation_id = … AND resource_id IS NULL` (`schedule.ts:57`). **This step is explicitly non-fatal** — on error it only `console.error`s (`schedule.ts:63-65`) and still returns `{success:true}`.
3. The wizard then *also* calls `updateTeamAssignments(resourceId, …)` (`AddResourceWizard.tsx:527`), which soft-deletes the resource's rta rows and re-inserts the chosen teams via the `update_team_assignments` RPC (migration 017).

**Should:** retire the vacancy on both sides atomically — set rpa.resource_id
**and** convert the vacant rta to a resource-keyed one (or delete it), leaving
no vacant rta pointing at a now-named rpa. **Gap:** the happy path does this,
**but**:
- Step 2's re-key is best-effort (non-fatal); if it fails, the rpa is named
  while the vacant rta survives → exactly the Category-3 mismatch.
- Steps 1–3 are **three separate writes, not one transaction** (unlike the
  `connect_resource_*` RPCs). An interruption or an out-of-band edit between
  them leaves a mismatched state.
- The cleaner, atomic paths (`connect_resource_keep_existing` /
  `connect_resource_use_vacant`, migration 019, wrapped at
  `schedule-wizard.ts:208`/`:229`) exist and *do* re-key + soft-delete in one
  RPC — but they are only reached via the same-period **conflict dialog**
  (`findResourcePeriodConflicts`, `:142`), not the ordinary fill-seat path.

### B.5 — Period creation / rollover

**Code:** `create_period_with_optional_copy` (migration 023), wrapped by a
server action behind the Create New Period wizard.

**What it clones from the source period (all `deleted_at IS NULL` rows):**
- rpa rows → new `allocation_id`s, all other fields copied (`023:55-77`).
- rta rows keyed by `allocation_id` (vacant/TBC) → remapped to the new
  allocation ids, **copying `resource_id` as-is** (`023:80-88`).
- rta rows keyed by `resource_id` → copied straight across (`023:92-100`).

**Should / actual:** it is a faithful, atomic (SECURITY DEFINER, single txn)
clone — correct as a clone. But it performs **no reconciliation**: any
Category-2 (orphaned) or Category-3 (mismatched) inconsistency in the source
period is duplicated into the new period verbatim. This is why the Kritika /
Basavaraj mismatches appear identically in Q2 and Q3. **Gap:** not a bug in the
clone itself, but the clone will faithfully propagate upstream data-entry
inconsistencies forward every quarter until they are cleaned at source.

---

## TASK C — Cross-check against the prior session's claims

**(a) "11 EPAM resources duplicated via a bulk script ~5 June, safely retired."**
**AGREE.** Exactly 11 EPAM name-pairs; the retained active rows are the
2026-06-05 sequential-UUID (`e1000001-…`) rows consistent with a bulk script;
the retired rows are the April originals, soft-deleted 2026-07-23 15:35, with
**0** cost allocations and only already-deleted team assignments — so retirement
was safe. One clarification: it was the **April originals** that were retired
and the **June script rows** that were kept (because the June IDs are the ones
wired into live Q2/Q3 allocations) — the opposite of "delete the newer
duplicate," but correct given the FK wiring.

**(b) "Nebula and Orion have genuinely dead vacant seats safe to retire."**
**AGREE.** These are the Category-2 orphans (§A.1): active vacant rta rows
(`688b29e5…` Nebula, `69e00900…` Orion) whose backing rpa cost lines
(`25be4f50…`, `0877192e…`) were soft-deleted 2026-06-19. They are dead shells
with no live allocation — safe to retire. (Decision is Matt's; no action taken.)

**(c) "Pluto's vacant seat `14b96181…` is redundant because Kritika Sharma now
has an independent active assignment instead."**
**AGREE, with a precision.** As of now Kritika does have an independent active
`resource_id`-keyed rta (`ae4ec4d8…`, created **today** 16:06), and the vacant
rta `56805341…` → allocation `14b96181…` (Kritika's own, named rpa) is the
redundant/mismatched shell. So the conclusion holds. Caveat: the independent
assignment was created **today**, after prior investigation began — the state
this claim describes is recent and hand-made, not a stable historical fact. The
redundant vacant rta is a Category-3 mismatch and a cleanup candidate.

**(d) "Basavaraj Havaler and Kritika Sharma's apparent 'duplicate' cost rows
were actually just normal Q2/Q3 rollover pairs, not real duplicates."**
**PARTIALLY DISAGREE — needs Matt's judgement.**
- *Kritika:* **AGREE** — one rpa per period (Q2 `14b96181` 64d@£180; Q3
  `6cb63bb8` 64d@£180), a clean Q2→Q3 rollover pair. Not a duplicate.
- *Basavaraj:* **DISAGREE as stated.** He has **two active rpa rows within the
  same period** — Q2: `674c90fc` (42d @ £475) **and** `2dd4a612` (23d @ £200),
  both role "Engineer (Drupal Agentic)"; and the same pair again in Q3
  (rolled). The duplication axis is **within a period**, not Q2-vs-Q3, so
  "just a rollover pair" misdiagnoses it. Whether the two same-titled,
  different-rate lines are a legitimate dual-rate split or a genuine duplicate
  is **inconclusive from data alone** and needs Matt. (Contrast Amol Tate, who
  also has 2 rpa/period but with **distinct** role_titles and rates — Offshore
  Test Lead + Onshore Test Lead (UK Secondment) — a clearly intentional split.)

**On the retracted "system-wide cost duplication" scare:** **CONFIRMED a false
alarm.** Period-scoped, only **three** resources have >1 active rpa in a single
period: Amol Tate (distinct roles — legitimate), Basavaraj Havaler (ambiguous,
above), and no others. There is no systemic cost doubling.

---

## Summary — current-state issues (no action taken)

Read-only findings only. Nothing below was modified; listed for Matt's decision.

| # | Issue | Where | Nature |
|---|---|---|---|
| 1 | 2 orphaned vacant seats (rpa deleted, rta live) | Q2 Nebula `688b29e5`, Orion `69e00900` | Dead shells — cleanup candidate |
| 2 | 4 mismatched vacant seats (vacant rta → named rpa, person also has own rta) | Q2/Q3 Pluto (Kritika), Sagan (Basavaraj) | Phantom vacancy display; no cost impact |
| 3 | Basavaraj: 2 same-title, different-rate rpa lines per period | Q2 + Q3 | Real or intentional? Needs Matt |
| 4 | Vipul Suriya over-allocated 1.50 | Q4 (historic/locked) | Historic data-quality note |
| 5 | New-resource + add-existing paths don't check for dupes / don't consume vacant seats | `schedule-wizard.ts:308,469` | Code gap (see 027 for #dup half) |
| 6 | Fill-vacant-seat is 3 non-atomic writes with a best-effort re-key | `schedule.ts:35-68` + `AddResourceWizard.tsx:514-531` | Makes mismatch #2 reachable |
| 7 | Rollover clones inconsistencies forward without reconciliation | migration 023 | Propagates #1/#2 each quarter |

Nothing here was fixed or deleted; migration 027 remains unapplied.
