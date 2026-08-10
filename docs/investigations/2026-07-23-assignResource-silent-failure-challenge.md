# Challenge/Validation: is `assignResourceToAllocation`'s silent failure the cause of the Kritika/Basavaraj mismatches?

**Date:** 2026-07-23
**Type:** **Challenge / validation pass against a specific prior claim — NOT a fresh independent audit.**
**Project:** Supabase `nwltpivvqynkfghazjpi` (live), Nucleus (`apps/nucleus`)
**Method:** Read-only. Instructed to *challenge*, not confirm. Started from the
hypothesis that the prior claim may be wrong and looked for evidence to break it.
Nothing was modified.

## The claim under challenge

A prior chat session (Supabase-MCP-only, no code access — and separately, an
earlier Claude Code session including my own) concluded that
`assignResourceToAllocation` (`apps/nucleus/app/actions/schedule.ts`) performs
non-atomic writes whose middle step (re-keying a vacant `resource_team_assignments`
row onto the named resource) **fails silently** (`console.error` only, still
returns `{success:true}`), and that this is the cause of the observed
"cost row filled, team-assignment row still vacant" mismatches for Kritika
Sharma (Pluto) and Basavaraj Havaler (Sagan).

The user distrusts this and gives a concrete reason: they used the "assign
resource" wizard only **once or twice ever**, which cannot explain multiple
historical anomalies if that wizard is the sole cause.

---

## TASK 1 — Re-derive the code claim (fresh read)

**(a) Two separate writes, not one transaction? — CONFIRMED.**
`schedule.ts:45-49` updates `resource_period_allocations` (sets `resource_id`);
`schedule.ts:57-61` separately updates `resource_team_assignments` (the re-key).
Two independent PostgREST calls, no surrounding transaction/RPC.
(The prior "**3** non-atomic writes" figure counts these 2 **plus** the wizard's
follow-on `updateTeamAssignments` at `AddResourceWizard.tsx:527`. Within the
function itself it is 2.)

**(b) Re-key error swallowed? — CONFIRMED, verbatim.**
`schedule.ts:63-65`: `if (migrateErr) { console.error(...) }` — logged only.
`schedule.ts:67`: `return { success: true }` regardless. The comment at
`:54-56` explicitly calls this "Non-fatal."

**(c) Current behavior, or already fixed? — CURRENT, unchanged.**
`git blame`: the re-key + swallow block is from commit `96a6fc8` (2026-06-18,
"Allow TBC allocation rows to carry team assignments via allocation_id"); the
`return {success:true}` from `d23555e` (2026-06-09). No later commit touches it.
The prior session read the code accurately.

**Task 1 verdict: the code-level claim is accurate.** The function is genuinely
non-atomic and genuinely swallows the re-key error. This is a real latent bug.
The challenge does **not** dispute this. The challenge is about *causation* —
whether this function actually produced the specific mismatches — addressed below.

---

## TASK 2 — Evidence it actually fired

- **No persistent error tracking exists.** No Sentry, PostHog, or any logging
  library in `apps/` or `packages/` (grep clean). ARCHITECTURE.md's claim of
  "Sentry — error monitoring, all environments" is **documentation drift** — it
  is not wired.
- **Only sink is `console.error` → Vercel function stdout.** Three such sites
  exist (`schedule.ts:64`, `:112`, `schedule-wizard.ts:408`), none persisted.
- **Vercel runtime-log retention cannot reach the events.** Queried
  `plato-nucleus` production logs for "migrate TBC team assignments" over a 30-day
  window: **no logs** — the API reports the window exceeds plan retention
  (Hobby 1h / Pro 1 day / Enterprise 3 days). The Kritika event (~2026-07-09)
  and Basavaraj event (~2026-06-25) are weeks old and unrecoverable.

**Task 2 verdict: no evidence available either way.** Stated plainly per the
brief: absence of logs here **neither confirms nor refutes** that the code path
fired. It simply cannot be checked.

---

## TASK 3 — Alternative explanations

### 3(a) — Every writer of `resource_period_allocations.resource_id`

Full enumeration (app code + SQL), with whether each can produce a
"named rpa + surviving vacant rta" mismatch:

| Writer | File / line | Can it create this mismatch? |
|---|---|---|
| `assignResourceToAllocation` | `schedule.ts:45` (rpa) + `:57` (rta re-key) | **Yes** — *only if* a vacant rta already exists for that allocation **and** the re-key collides (e.g. on `rta_named_unique`) so it's swallowed. Never *inserts* an rta. |
| `connect_resource_keep_existing` | migration `019:39-51` | **No** — atomic; re-keys vacant rta **and** soft-deletes the vacant rpa; any failure rolls back the whole RPC and surfaces the error. |
| `connect_resource_use_vacant` | migration `019:72-99` | **No** — atomic; **pre-deletes** the colliding resource-keyed rta *before* re-keying, then sets rpa.resource_id. Cannot silently strand a vacant rta. |
| `createResourceAndAllocation` | `schedule-wizard.ts:376` (rpa insert) | **No** — inserts a **brand-new** named rpa + its own rta; never points an existing vacant rta at it. |
| `create_period_with_optional_copy` | migration `023:66-100` | **Propagator, not origin** — clones rpa + rta verbatim, so a Q2 mismatch reappears in Q3 (exactly what we see). Does not originate one. |
| `handleUpdateAllocation` (inline edit) | `SchedulePageClient.tsx:482` | **No — ruled out.** `AllocationUpdates` (`:1458`) is `Pick<…,'role_title'\|'day_rate'\|'capacity_days'\|'utilisation_percent'\|'planview_code'\|'vat_applies'\|'is_chargeable'\|'resource_location'>` — **`resource_id` is not a member.** |
| `unassignResourceFromAllocation` | `schedule.ts:74` | **No** — sets `resource_id = NULL` (opposite direction). |
| **Direct DB write** (Supabase Studio / raw SQL / MCP AI session) | — none — | **Yes** — sets `rpa.resource_id` (or inserts an rta) with **no** application logic touching the other table. Produces the mismatch with zero code involvement. |

So within application code, `assignResourceToAllocation` is the *only* path that
could silently strand a vacant rta — **and even it can only do so by UPDATE of a
pre-existing vacant rta, never by creating one.** Hold that constraint; it is
decisive below.

### 3(b) — Direct-database-edit evidence (strong, and abundant)

The live DB shows heavy, unambiguous direct-SQL / MCP editing:

- **Bulk `updated_at` clusters on `resources`** (UI edits one row at a time; these are bulk writes):
  - **93** rows share `2026-07-20 18:43:37.328639` to the microsecond — including **both** Kritika **and** Basavaraj.
  - 56 share `2026-04-23 01:09:02`; 12, 11 (the EPAM cleanup), 8, 6, 6, 4 … more clusters.
- **An impossible-via-app row.** `rta 37ca5d09` is resource-keyed to Kritika
  (`b881f6b0`), `created_at` **2026-06-18**, `updated_at == created_at` (never
  re-keyed). But the Kritika `resources` row is dated **2026-07-08** — three
  weeks *later*. No application path can insert an rta referencing a resource
  that will not exist for three weeks; this is a direct edit / UUID-preserving
  re-creation of the resource.
- **The mismatch rows themselves look inserted, not stranded.**
  - Kritika's mismatch `rta 56805341` (vacant, `allocation_id = 14b96181`) was
    **created 2026-07-09 09:33:08 — one minute *after* its rpa `14b96181` was
    named** (rpa `updated_at` 09:32:09). `assignResourceToAllocation` **never
    inserts** rta rows (§3a), so it *cannot* have produced a freshly-created
    vacant rta pointing at an already-named allocation. This row was inserted
    directly.
  - Ongoing hand-editing: `rta 56805341` was **soft-deleted today, 2026-07-23
    17:20:05** — after my earlier same-day audit report described it as active.

### 3(b) verdict

Direct DB manipulation of exactly these records is not hypothetical — it is
**demonstrated** (bulk timestamp clusters, an FK-impossible timestamp, a
mismatch row inserted a minute after naming, and a same-day deletion). The TCS
resources (Kritika, Basavaraj) were manifestly hand-reconciled.

---

## TASK 4 — Conclusion (with confidence levels)

**The prior *code* claim is correct; the prior *causal attribution* is not
supported for these specific cases.**

- **Kritika (Pluto) mismatch — direct DB edit, HIGH confidence; NOT the wizard.**
  The mismatch rta was *created* against an *already-named* rpa (one minute
  after). `assignResourceToAllocation` only ever *updates* an existing vacant
  rta — it cannot create one. Combined with the FK-impossible `37ca5d09`
  timestamp and the 93-row bulk update touching Kritika, the silent-failure
  theory is **positively excluded** as the origin here. This is manual
  reconciliation.

- **Basavaraj (Sagan) mismatch — genuinely ambiguous, MEDIUM confidence toward
  direct edit.** Here the timing *is* compatible with the wizard: the vacant
  rta `073b3835` existed (2026-06-24) before the rpa `2dd4a612` was named
  (2026-06-25), and Basavaraj already had a colliding resource-keyed rta, so a
  re-key *would* have hit `rta_named_unique` and been swallowed. So the wizard
  path is *possible* for Basavaraj. But it is equally explained by direct edit,
  and the surrounding evidence (same bulk-update cluster, `2dd4a612` being a
  second, same-title Drupal allocation that is itself part of the manual
  reconciliation pattern) tilts it toward manual. **Cannot be resolved from the
  data alone.**

- **The user's low-usage recollection is corroborated, HIGH confidence.** The
  anomalies do **not** require the wizard to have fired repeatedly. The data
  carries clear fingerprints of bulk direct-SQL reconciliation (93-row updates,
  preserved-UUID re-creations, inserted mismatch rows, same-day cleanups) that
  explain multiple anomalies with **zero** wizard invocations. Attributing the
  historical mismatches primarily to the wizard over-fits a rarely-used code
  path.

**Net:** the silent-failure bug in `assignResourceToAllocation` is **real and
worth fixing as latent risk** (make it atomic / surface the error / pre-clean
the collision like the `connect_*` RPCs already do) — but it is **not the most
likely cause of the observed Kritika/Basavaraj mismatches.** Direct database
manipulation is the better-supported explanation: proven for Kritika, more
likely than not for Basavaraj.

### What would change this conclusion
- Persistent error logs (Sentry) showing the `console.error` firing for these
  allocations — do not exist, cannot be retrieved.
- A record of the MCP/SQL sessions that edited this data would confirm the
  direct-edit path definitively; the DB-side fingerprints already point there.

*Read-only investigation. Nothing was fixed, deleted, or migrated.*
