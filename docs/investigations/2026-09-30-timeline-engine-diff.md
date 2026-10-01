# Resource Timeline — native engagement engine vs legacy translator (dual-running diff)

**Date:** 2026-09-30 · **Branch:** `claude/timeline-native-engagements` · **ADR:** 035

The legacy engine (engagements → `engagementsToTransitionRecords` → `deriveSegments`)
and the native engine (`engagementEngine.ts`) were both run over:

- **(a)** the `dudleyCohort.test.ts` fixture. Its `CASES` are read out of the approved
  test file unchanged, and engagements are synthesised the way migration 037's
  backfill built them;
- **(b)** a read-only snapshot of the live rows the page query reads, for
  Q2 FY26/27 (`bb000001-0000-0000-0000-000000000003`) + Q3 FY26/27
  (`10cfda7c-8c57-4da3-9dab-b8210032b030`), taken 30 Sep 2026.

Regenerate with `npx vite-node scripts/timeline-engine-diff.ts <snapshot.json> <report.md>`.
The snapshot query is at the end of this document.

## Update — bars from engagement dates only (30 Sep, second round)

Approved after live review. In the new engine a bar now runs roll-on to
roll-off, full stop. Monthly days are days bought, not a calendar, so they no
longer taper, anchor or break a bar; they appear only in the tooltip ("Oct 5d ·
Nov 5d · Dec 4d", or "Q3 64d" where a period has no monthly rows). Pieces of one
engagement join into one continuous bar, and the end of a bar before a later,
separate bar is shortened by 3px.

The report below is regenerated from a fresh live snapshot. Its engagements,
allocations and monthly days are checksum-identical to the morning's; it adds
`capacity_days`, disciplines and team assignments.

**UNEXPLAINED: none in either run.**

Live (113 people, 48 differ):

| Rule | People |
|---|---|
| SPEC-engagement-span | 21. Legacy tapered their Q3 bar short in December (EPAM/HT people booked under the full month); it now runs to the engagement's end. Aliaksei Yakimovich, Bence Daroczi, Chris Horton, Daria Grek, Dzianis Roi, Ekaterina Webster, Emil Nowak, Francesca Bateman, Freddie Leigh-Akompi, Gleb Kazak, Ievgeniia Usovik, Jan Urbaniak, Maksim Klimenko, Mikalai Kavaliou, Pavel Yukhnovich, Pushpalatha Surineni, Rachel Hatcher, Rita Makai, Roland Meszaros, Roman Syromiatnikov, Svetlana Solodkaia |
| SPEC-category | 13 (unchanged, see conflict 2) |
| R2-roll-on | 9 (unchanged) |
| R5-unscheduled | 5 (unchanged: Amol Tate, Nawaz Mohammed, Pradeep Bolke, Suraj Pawar, Sushil Suresh) |
| R2/R6-roll-off | 1 (Zouhir Saad-Saoud, unchanged) |

Fixture (21 people, 9 differ): SPEC-engagement-span 4 (Bharat Patil, Manasi
Ketkar, Nikhil Vibhav, Pradeep Bolke: hypercare now runs to roll-off rather
than the last booked month), R5-unscheduled 5, R2-roll-on 1, R12 1.

**Conflict 1 below is resolved by this change.** The Phase-1 Q2 taper holes are
gone: Nilesh Kumar, Poornachandran Ramakrishnan and the rest are continuous
again, and now match legacy in Q2.

**Team moves (report only, no change).** In Team grouping a person appears
under one team only: their Q3 team where they have one (resolveTeamsByResource
lets the granular period replace the coarse one), with their whole bar,
including the Q2 portion spent in the old team. Live examples: Prapti Verma and
Shubham Kumar (one TCS engagement each, Cygnus in Q2 → Orion in Q3) appear only
under Orion.

---

# Phase 1 report (superseded bar geometry; kept for history)

## UNEXPLAINED

**None in either run.** Every difference is credited to a rule below by the
harness, which only credits a rule when the input rows show that rule applies
to those exact days.

## Conflicts and judgement calls flagged (not resolved)

1. **Holes inside one engagement from monthly-day tapering (14 people live).**
   The spec says part-time pattern comes from monthly days in every period. The
   old engine drew Q2 flat and never read Q2's 208 monthly rows. The new engine
   tapers a short last month in Q2 exactly as the old one did for Q3. The result
   is a 2–26 day stretch of empty track inside a single continuous engagement
   (e.g. Nilesh Kumar: CG to 28 Sep, CG again from 1 Oct; Chris Horton: EPAM to
   8 Sep, EPAM again from 1 Oct). No gap marker is drawn, because rule 4 says a
   gap is only between engagements. But "a bar = one engagement's span" and
   "part-time pattern from monthly days" disagree here, so this needs a decision.
   The same thing already happens at the end of Q3 for people whose December
   booking is short (EPAM bars ending 2–18 Dec), in both engines.
2. **Joiner on the window's first day (12 people live).** TCS people with a
   confirmed roll-on of 1 Jul (the window's first day) move from "Established at
   TCS" to "Not part of Dudley transition". The engine counts a join only when
   roll-on is after the window start. It cannot tell a confirmed 1 Jul from an
   estimated 1 Jul without reading `roll_on_estimated`, which rule 9 excludes;
   three EPAM engagements carry an estimated 1 Jul. The 13th SPEC-category
   change, James Taylor, is window scoping: his NH roll-off (31 Mar 2027) is
   after the window.
3. **Labels hardcode supplier names (rule 8), outside the engine.**
   `CATEGORY_LABELS` ("Transitioned to TCS", "Established at TCS (no CG
   history)", "Not part of Dudley transition"), `STATUS_LABELS` ("CG → TCS",
   "New TCS hire") and `CG_TCS_FOCUS` are in `deriveSegments.ts` and
   `presentation.ts`. The engine emits category keys only, and the builder maps
   them to these labels. So Deepak Balasaheb Pawar and Pradeep Bolke (CG), and
   Nawaz Mohammed and Sushil Suresh (RMG), show "Established at TCS". The old
   engine did the same.
4. **Legend.** The page has no legend, and the export test "has no legend row
   markup, CSS, or builder (Fix 2, round 2)" asserts there is none. Adding the
   "On the platform, not on the schedule" entry means adding a row, which is a
   layout change, so it was **not added**.
5. **Pieces of one engagement still read as separate blocks.** They touch with no
   inset (rule 10), but each piece keeps its own 4px left accent and rounded
   corners (existing `.seg` styling). The legacy CG Q2→Q3 pieces already looked
   like this. Styling was left unchanged.
6. **Dropped outputs.** The new engine never sets `commercialStartMismatch` (no
   flag dots): schedule and engagement are expected to differ (rules 1 and 2).
   `joiningDate` and `notes` are null. Printed bar dates appear only at real
   engagement boundaries, not at period seams, so a continuous stint no longer
   shows "to 30 Sep" then "from 1 Oct". Labels are not part of the diff.
7. **Zouhir Saad-Saoud has no row.** His CG roll-off (23 Jun) is before the
   window, so nothing intersects it (rules 2 and 6). He is also
   `hidden_from_timeline`.
8. **Coverage.** No live allocation has planview `NPC`, so hypercare
   end-anchoring is exercised only by the fixture and unit tests. The fixture's
   Hitendrasinh Rajput (no last working day) gives an open CG engagement
   overlapping TCS. That can't happen live because 038's exclusion constraint
   prevents it, and live Hitendrasinh (CG roll-off 30 Sep) is identical in both
   engines.

## Expected differences

| Expectation | Result |
|---|---|
| Suraj Pawar (TCS) unscheduled 7–30 Sep | Confirmed |
| Pradeep Bolke (CG) unscheduled 6 Aug–30 Sep | Confirmed |
| Amol Tate (TCS) unscheduled 8–30 Sep | Confirmed |
| Sushil Suresh (RMG) unscheduled 21 Jul–30 Sep | Confirmed |
| Nawaz Mohammed (RMG) unscheduled 14–30 Sep | Confirmed |
| Zouhir Saad-Saoud ends at roll-off; Q2 scheduled-after-leaving shows no treatment | Confirmed, but his roll-off (23 Jun) predates the window, so he has no bar or row at all |
| Anupama Yadav CG ends 21 Aug | Confirmed (unchanged from legacy) |
| Rajat Pandey CG only, ends 25 Aug, no TCS bar | Confirmed (unchanged from legacy) |
| Nilesh Kumar / Nikhil Vibhav plain TCS from 1 Dec, no hatch | Confirmed. Their Q2 CG bar now ends 28 Sep (see conflict 1) |
| No overlap-risk labels | Confirmed: 0 overlap-risk, 0 tentative segments in either run |

Live summary: 113 people compared, 42 differ.

| Rule | People | Who |
|---|---|---|
| R5-unscheduled | 5 | the five expected above |
| R2-roll-on | 9 | Deepak Balasaheb Pawar, Deva Palanisamy, Fauji Sirajuddin, Kiran MH, Mathivanan Pandurangan, Naresh Kottala, Pushpalatha Surineni, Sarvesh Singla, Vishal V |
| R2/R6-roll-off | 1 | Zouhir Saad-Saoud |
| SPEC-monthly-days | 14 | see conflict 1 |
| SPEC-category | 13 | see conflict 2 |

## Snapshot query (read-only)

The second-round snapshot extends the query below with `a.capacity_days` on
allocations, `d.discipline_name, d.sort_order` on resources (via
`disciplines`), and a `teams` array of
`[resource, period, capacity_split, team_name]` from non-deleted
`resource_team_assignments`. The surrogate ids are unchanged.

```sql
with p as (select period_id, period_name, period_start_date, period_end_date,
                  case when period_start_date='2026-07-01' then 'P2' else 'P3' end k
           from periods where period_id in ('bb000001-0000-0000-0000-000000000003','10cfda7c-8c57-4da3-9dab-b8210032b030')),
a as (select * from resource_period_allocations where deleted_at is null and resource_id is not null and period_id in (select period_id from p)),
e as (select * from resource_engagements where deleted_at is null),
rids as (select resource_id from a union select resource_id from e),
r  as (select resource_id, 'r'||row_number() over (order by resource_id) k from rids),
ek as (select engagement_id, 'e'||row_number() over (order by engagement_id) k from e),
ak as (select allocation_id, 'a'||row_number() over (order by allocation_id) k from a),
s  as (select supplier_id, supplier_abbreviation, supplier_name, supplier_colour, sort_order from suppliers)
select json_build_object(
 'periods',     (select json_agg(json_build_array(k, period_name, period_start_date, period_end_date)) from p),
 'suppliers',   (select json_agg(json_build_array(supplier_abbreviation, supplier_name, supplier_colour, sort_order) order by sort_order) from s),
 'resources',   (select json_agg(json_build_array(r.k, x.resource_name, x.hidden_from_timeline) order by r.k) from r join resources x using (resource_id) where x.deleted_at is null),
 'engagements', (select json_agg(json_build_array(ek.k, r.k, s.supplier_abbreviation, e.roll_on_date, e.roll_off_date, e.roll_on_estimated, e.roll_on_tentative) order by r.k, e.roll_on_date) from e join ek using (engagement_id) join r using (resource_id) join s using (supplier_id)),
 'allocations', (select json_agg(json_build_array(ak.k, p.k, r.k, s.supplier_abbreviation, a.planview_code, ek.k) order by r.k, p.k) from a join ak using (allocation_id) join p using (period_id) join r using (resource_id) left join s using (supplier_id) left join ek using (engagement_id)),
 'monthly',     (select json_agg(json_build_array(ak.k, to_char(m.month_start_date,'YYYY-MM'), m.days) order by ak.k, m.month_start_date) from resource_period_allocation_monthly_days m join ak using (allocation_id)),
 'holidays',    (select json_agg(holiday_date order by holiday_date) from uk_bank_holidays where holiday_date between '2026-01-01' and '2026-12-31')
) snapshot;
```

Team and discipline rows are left out of the snapshot. Neither engine derives
geometry, gaps, category or avatar from them, and the diff doesn't compare them.

---

# Generated report (second round)

## Rule key

- **R2-roll-on** — Rule 2 — engagement roll-on is the actual and overrides the schedule
- **R2/R6-roll-off** — Rules 2 & 6 — the bar ends at roll-off; scheduled-after-leaving gets no treatment
- **R5-unscheduled** — Rule 5 — engaged but not scheduled: drawn from the engagement with the unscheduled marker
- **SPEC-engagement-span** — Spec — a bar runs roll-on to roll-off; monthly days are days bought, not a calendar, so the taper, noise threshold and NPC end/start-anchoring no longer shape or break bars
- **SPEC-category** — Spec — transition category derived on the fly from the order of engagements intersecting the window (the translator read every engagement, and roll_on_estimated)
- **R7-overlap-risk** — Rule 7 — no stored labels; overlap risk is not produced
- **R12-no-tentative** — Rule 12 — no tentative roll-on/roll-off; nothing tentative or hatched
- **SPEC-avatar** — Spec — avatar split from the suppliers of engagements intersecting the window
- **R4-gaps** — Rule 4 — a gap is the space between consecutive engagements of one person
- **R10-pieces** — Rule 10 — same cover, different piece boundaries (period seams / planview / scheduled-unscheduled pieces within one engagement)

## (a) dudleyCohort fixture

21 people compared; 9 differ; 0 with unexplained differences.

### UNEXPLAINED

None.

### All differences, by person

#### Amol Tate

- **Old:** CG 2026-07-01 → 2026-08-13; TCS 2026-10-01 → 2026-12-31 — Transitioned to TCS, avatar split CG→TCS
- **New:** CG 2026-07-01 → 2026-08-13; TCS 2026-08-24 → 2026-09-30 *(unscheduled)*; TCS 2026-10-01 → 2026-12-31 — Transitioned to TCS, avatar split CG→TCS
- TCS 2026-08-24–2026-09-30 unscheduled (on the platform, no schedule row) — **R5-unscheduled**

#### Bharat Patil

- **Old:** CG 2026-07-01 → 2026-09-30; CG NPC 2026-10-01 → 2026-10-30 — Rolling off, hypercare only — no TCS move, avatar solid CG
- **New:** CG 2026-07-01 → 2026-09-30; CG NPC 2026-10-01 → 2026-10-31 — Rolling off, hypercare only — no TCS move, avatar solid CG
- CG 2026-10-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Deva Palanisamy

- **Old:** TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-09-01 → 2026-09-30 *(unscheduled)*; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- TCS 2026-09-01–2026-09-30 unscheduled (on the platform, no schedule row) — **R5-unscheduled**

#### Hitendrasinh Rajput

- **Old:** CG 2026-07-01 → 2026-09-30; TCS 2026-10-14 → 2026-12-31 — Transitioned to TCS, avatar split CG→TCS
- **New:** CG 2026-07-01 → 2026-09-30; CG 2026-10-01 → 2026-12-31 *(unscheduled)*; TCS 2026-10-14 → 2026-12-31 — Transitioned to TCS, avatar split CG→TCS
- CG 2026-10-01–2026-12-31 unscheduled (on the platform, no schedule row) — **R5-unscheduled**

#### Manasi Ketkar

- **Old:** CG 2026-07-01 → 2026-09-30; CG NPC 2026-10-01 → 2026-10-07 — Not part of Dudley transition, avatar solid CG
- **New:** CG 2026-07-01 → 2026-09-30; CG NPC 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid CG
- CG 2026-10-08–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Mathivanan Pandurangan

- **Old:** TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-09-01 → 2026-09-30 *(unscheduled)*; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- TCS 2026-09-01–2026-09-30 unscheduled (on the platform, no schedule row) — **R5-unscheduled**

#### Nikhil Vibhav

- **Old:** CG 2026-07-01 → 2026-09-30; CG NPC 2026-10-01 → 2026-10-30; TCS 2026-12-01 → 2026-12-31 — Signed with TCS — start date TBC, avatar split CG→TCS
- **New:** CG 2026-07-01 → 2026-09-30; CG NPC 2026-10-01 → 2026-10-31; TCS 2026-12-01 → 2026-12-31 — Transitioned to TCS, avatar split CG→TCS
- CG 2026-10-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**
- category Signed with TCS — start date TBC (mover_doj_tbc) → Transitioned to TCS (mover) — **R12-no-tentative**

#### Pradeep Bolke

- **Old:** CG NPC 2026-10-01 → 2026-10-30 — Rolling off, hypercare only — no TCS move, avatar solid CG
- **New:** CG 2026-07-01 → 2026-09-30 *(unscheduled)*; CG NPC 2026-10-01 → 2026-10-31 — Rolling off, hypercare only — no TCS move, avatar solid CG
- CG 2026-10-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**
- CG 2026-07-01–2026-09-30 unscheduled (on the platform, no schedule row) — **R5-unscheduled**

#### Prajwal Kumar

- **Old:** TCS 2026-11-02 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-10-26 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- TCS 2026-10-26–2026-11-01 added: bar starts at the 2026-10-26 roll-on — **R2-roll-on**

### Data issues (new engine)

None — no engagement with a null roll-on, no unlinked allocation, no scheduled period without booked days inside its engagement.

New engine: 0 overlap-risk labels, 0 tentative segments.

## (b) Live data — Q2 + Q3 FY26/27

113 people compared; 48 differ; 0 with unexplained differences.

### UNEXPLAINED

None.

### All differences, by person

#### Aliaksei Yakimovich

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-18 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-19–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Amol Tate

- **Old:** CG 2026-07-01 → 2026-08-13; TCS 2026-10-01 → 2026-12-31 — Transitioned to TCS, avatar split CG→TCS
- **New:** CG 2026-07-01 → 2026-08-13; TCS 2026-09-08 → 2026-09-30 *(unscheduled)*; TCS 2026-10-01 → 2026-12-31 — Transitioned to TCS, avatar split CG→TCS
- TCS 2026-09-08–2026-09-30 unscheduled (on the platform, no schedule row) — **R5-unscheduled**

#### Basavaraj Havaler

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid TCS
- category Established at TCS (no CG history) (joiner) → Not part of Dudley transition (incumbent) — **SPEC-category**

#### Bence Daroczi

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-18 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-19–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Chris Horton

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-07 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-08–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Daria Grek

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-18 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-19–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Deepak Balasaheb Pawar

- **Old:** CG 2026-07-01 → 2026-09-30; CG 2026-10-01 → 2026-10-30 — Established at TCS (no CG history), avatar solid CG
- **New:** CG 2026-09-01 → 2026-09-30; CG 2026-10-01 → 2026-10-30 — Established at TCS (no CG history), avatar solid CG
- CG 2026-07-01–2026-08-31 dropped: outside the CG engagement — **R2-roll-on**

#### Deva Palanisamy

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-09-02 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- TCS 2026-07-01–2026-09-01 dropped: outside the TCS engagement — **R2-roll-on**

#### Dzianis Roi

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-18 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-19–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Ekaterina Webster

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-18 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-19–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Emil Nowak

- **Old:** HT 2026-07-01 → 2026-09-30; HT 2026-10-01 → 2026-12-14 — Not part of Dudley transition, avatar solid HT
- **New:** HT 2026-07-01 → 2026-09-30; HT 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid HT
- HT 2026-12-15–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Fauji Sirajuddin

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-09-17 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- TCS 2026-07-01–2026-09-16 dropped: outside the TCS engagement — **R2-roll-on**

#### Francesca Bateman

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-10 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-11–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Freddie Leigh-Akompi

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-16 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-17–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Gleb Kazak

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-18 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-19–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Ievgeniia Usovik

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-02 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-03–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### James Taylor

- **Old:** NH 2026-07-01 → 2026-09-30; NH 2026-10-01 → 2026-12-31 — Not moving — attrition, avatar solid NH
- **New:** NH 2026-07-01 → 2026-09-30; NH 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid NH
- category Not moving — attrition (rolledoff) → Not part of Dudley transition (incumbent) — **SPEC-category**

#### Jan Urbaniak

- **Old:** HT 2026-07-01 → 2026-09-30; HT 2026-10-01 → 2026-10-13 — Not part of Dudley transition, avatar solid HT
- **New:** HT 2026-07-01 → 2026-09-30; HT 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid HT
- HT 2026-10-14–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Kiran MH

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-08-24 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- TCS 2026-07-01–2026-08-23 dropped: outside the TCS engagement — **R2-roll-on**

#### Konika Shrivastava

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid TCS
- category Established at TCS (no CG history) (joiner) → Not part of Dudley transition (incumbent) — **SPEC-category**

#### Kritika Sharma

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid TCS
- category Established at TCS (no CG history) (joiner) → Not part of Dudley transition (incumbent) — **SPEC-category**

#### Lakshmi Kanth Muthyala

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid TCS
- category Established at TCS (no CG history) (joiner) → Not part of Dudley transition (incumbent) — **SPEC-category**

#### Maksim Klimenko

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-18 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-19–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Marvania Vivek Sureshbhai

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid TCS
- category Established at TCS (no CG history) (joiner) → Not part of Dudley transition (incumbent) — **SPEC-category**

#### Mathivanan Pandurangan

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-09-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- TCS 2026-07-01–2026-08-31 dropped: outside the TCS engagement — **R2-roll-on**

#### Mikalai Kavaliou

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-18 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-19–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Minu Agrawal

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid TCS
- category Established at TCS (no CG history) (joiner) → Not part of Dudley transition (incumbent) — **SPEC-category**

#### Naresh Kottala

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-09-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- TCS 2026-07-01–2026-08-31 dropped: outside the TCS engagement — **R2-roll-on**

#### Nawaz Mohammed

- **Old:** RMG 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid RMG
- **New:** RMG 2026-09-14 → 2026-09-30 *(unscheduled)*; RMG 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid RMG
- RMG 2026-09-14–2026-09-30 unscheduled (on the platform, no schedule row) — **R5-unscheduled**

#### Pavel Yukhnovich

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-18 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-19–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Pradeep Bolke

- **Old:** CG 2026-10-01 → 2026-10-30 — Established at TCS (no CG history), avatar solid CG
- **New:** CG 2026-08-06 → 2026-09-30 *(unscheduled)*; CG 2026-10-01 → 2026-10-30 — Established at TCS (no CG history), avatar solid CG
- CG 2026-08-06–2026-09-30 unscheduled (on the platform, no schedule row) — **R5-unscheduled**

#### Prapti Verma

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid TCS
- category Established at TCS (no CG history) (joiner) → Not part of Dudley transition (incumbent) — **SPEC-category**

#### Pushpalatha Surineni

- **Old:** TCS 2026-10-26 → 2026-12-07 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- TCS 2026-10-01–2026-10-25 added: bar starts at the 2026-10-01 roll-on — **R2-roll-on**
- TCS 2026-12-08–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Rachel Hatcher

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-18 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-19–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Raghaveni Adula

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid TCS
- category Established at TCS (no CG history) (joiner) → Not part of Dudley transition (incumbent) — **SPEC-category**

#### Rita Makai

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-18 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-19–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Roland Meszaros

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-18 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-19–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Roman Syromiatnikov

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-18 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-19–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Saranya T S

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid TCS
- category Established at TCS (no CG history) (joiner) → Not part of Dudley transition (incumbent) — **SPEC-category**

#### Sarvesh Singla

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-08-26 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- TCS 2026-07-01–2026-08-25 dropped: outside the TCS engagement — **R2-roll-on**

#### Shriramnathan K

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid TCS
- category Established at TCS (no CG history) (joiner) → Not part of Dudley transition (incumbent) — **SPEC-category**

#### Shubham Kumar

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid TCS
- category Established at TCS (no CG history) (joiner) → Not part of Dudley transition (incumbent) — **SPEC-category**

#### Suraj Pawar

- **Old:** TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-09-07 → 2026-09-30 *(unscheduled)*; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- TCS 2026-09-07–2026-09-30 unscheduled (on the platform, no schedule row) — **R5-unscheduled**

#### Sushil Suresh

- **Old:** RMG 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid RMG
- **New:** RMG 2026-07-21 → 2026-09-30 *(unscheduled)*; RMG 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid RMG
- RMG 2026-07-21–2026-09-30 unscheduled (on the platform, no schedule row) — **R5-unscheduled**

#### Svetlana Solodkaia

- **Old:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-18 — Not part of Dudley transition, avatar solid EPAM
- **New:** EPAM 2026-07-01 → 2026-09-30; EPAM 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid EPAM
- EPAM 2026-12-19–2026-12-31 added: inside the engagement, no longer tapered or broken by booked days — **SPEC-engagement-span**

#### Vidhya Vijayakumar

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Not part of Dudley transition, avatar solid TCS
- category Established at TCS (no CG history) (joiner) → Not part of Dudley transition (incumbent) — **SPEC-category**

#### Vishal V

- **Old:** TCS 2026-07-01 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- **New:** TCS 2026-09-02 → 2026-09-30; TCS 2026-10-01 → 2026-12-31 — Established at TCS (no CG history), avatar solid TCS
- TCS 2026-07-01–2026-09-01 dropped: outside the TCS engagement — **R2-roll-on**

#### Zouhir Saad-Saoud

- **Old:** CG 2026-07-01 → 2026-09-30 — Not moving — attrition, avatar solid CG
- **New:** (no row)
- CG 2026-07-01–2026-09-30 dropped: outside the CG engagement — **R2/R6-roll-off**
- row dropped: no engagement intersects the window — **R2/R6-roll-off**

### Data issues (new engine)

None — no engagement with a null roll-on, no unlinked allocation, no scheduled period without booked days inside its engagement.

New engine: 0 overlap-risk labels, 0 tentative segments.
