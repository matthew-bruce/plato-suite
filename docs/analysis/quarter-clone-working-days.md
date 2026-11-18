# Quarter clone carries working days forward verbatim — analysis and fix proposal

Status: **analysis only — nothing implemented.** Date: 18 Nov 2026.
Scope: working days in the "Create new period → copy forward" flow. Everything else found is in §E.

## Summary

1. **Root cause.** `create_period_with_optional_copy` (migration 023, live definition identical) copies `capacity_days` verbatim and does **not** copy the monthly breakdown at all. No step recalculates days for the new date range, and nothing looks at engagement roll-on/roll-off dates.
2. **Blast radius.** Only the new draft is wrong, but in more ways than "64 instead of 61". In the Q4 FY26/27 draft: 42 UK-calendar full-quarter roles carry 64 instead of 61. 15 offshore roles carry Q3's 63 against an unknown Q4 offshore figure. 13 joiners carry their part-quarter Q3 days (537 days in total) when they are now full-time. **13 roles for people who left in Q3 carry 348 days into a quarter they are not in.** All 105 Q4 roles have lost their monthly breakdown. Every cost figure, export and KPI reads `capacity_days`. Locked periods are not touched by any path.
3. **Calendar strategy (recommended).** Use `uk_bank_holidays` for onshore and nearshore. For offshore, ask in the wizard for monthly working days for the new quarter: they are required and never prefilled with UK figures. Show last quarter's offshore figure, worked out from the data, as a reference. Defer a calendar table (ADR + migration) until a second stored calendar is needed. The offshore calendar is really a *supplier delivery-centre* calendar, not a country one, so it should not be modelled yet.
4. **Classifier (recommended).** Classify on the **monthly shape**, not the total. On Q3 the result is FULL 57, RAMP-ON 13, ENDED 13, LEAVE-ADJUSTED 15, PART-TIME 6, UNCERTAIN 1. Only FULL and RAMP-ON change automatically. Everything else is kept and listed with a reason. Your hypothesis's "shortfall not explained by engagement → part-time" rule would misfile 15 leave- and shutdown-adjusted full-timers (for example December = 14) as part-time. It would also miss 2 roles that look full but whose engagement ends 31 Dec.
5. **Open questions for Matt.** (a) Leave-adjusted rows: should the default be keep (per your principle) or full working days? (b) Ended rows: keep and flag, or offer "leave out of the new quarter"? (c) Who supplies the offshore Q4 calendar, and is it one calendar or one per supplier? (d) Should steady ~50% rows be kept, or flagged for a check? (e) Should the existing Q4 draft be re-created once this ships, or recalculated in place?

---

## How this was checked

- Code: `CreatePeriodWizard.tsx`, `app/actions/schedule-period.ts`, migrations 015, 022, 023, 028–032, 035, 037 and 040–041, `lib/schedule/*`, `packages/schema/src/lib/resource-timeline/*`, the schedule and timeline queries, and the exports.
- Live DB (`nwltpivvqynkfghazjpi`): **SELECT-only** queries. I confirmed that the live function body matches migration 023, then checked the columns, the triggers, the Q3 and Q4 contents, the engagements and the holiday coverage. Nothing was written.

---

## PHASE 1 — Analysis

### 1. The clone path end to end

`CreatePeriodWizard` (Period → Copy forward → Confirm) → `createPeriod()` server action → RPC `create_period_with_optional_copy(name, start, end, copy_from)`. It is `SECURITY DEFINER` and runs as one transaction. The source is always `selectDefaultPeriod(allPeriods)`, which is the latest period by end date, **not** the period being viewed.

**`periods`:** the RPC inserts a new row with `period_status = 'draft'` and `locked = false`.

**`resource_period_allocations`** (all non-deleted source rows; fresh `allocation_id`):

| Column | Behaviour |
|---|---|
| resource_id, role_id, supplier_id, role_title, planview_code | copied verbatim |
| day_rate | copied verbatim (Q3 rate carried forward) |
| utilisation_percent | copied verbatim (100 on every Q3 row) |
| **capacity_days** | **copied verbatim — the bug** |
| is_chargeable, vat_applies, display_order, resource_location (row snapshot) | copied verbatim |
| **is_confirmed** | not copied → column default `false`. **Verified: 0 of 105 Q4 rows confirmed (Q3: 103 of 105).** Correct, but only implicitly (§E). |
| **engagement_id** | not copied. It is set by the `resource_period_allocations_set_engagement` BEFORE INSERT trigger through `plato_resolve_engagement(resource, supplier, new_period)`. That prefers an engagement overlapping the new period and otherwise takes the latest one. If none exists, it **creates** an engagement with `roll_on_date = new period start` and `roll_on_estimated = true`. |
| created_at, updated_at | reset (defaults) |

**`resource_period_allocation_monthly_days`:** **not copied at all.** Q3 has monthly rows on all 105 roles. Q4 has none, so every Q4 role is in "manual total" mode.

**`resource_team_assignments`:**
- Role-keyed rows (vacant roles, `allocation_id` set) are remapped to the new `allocation_id`. They are copied only if the source role is not deleted.
- Person-keyed rows (`allocation_id` null, `resource_id` set, `period_id = source`) are copied straight across to the new `period_id`.
- Live-state rows with `period_id IS NULL` (66 exist) are neither read nor written. That is correct.
- Verified: Q3 has 108 live team rows and Q4 has 104. The 4 not copied all belong to soft-deleted Q3 roles, which is correct. 15 named roles have no team row in either quarter, so that state pre-dates the clone.

**Not touched:** `platform_cost_items` (Q3 has 1 item, Q4 has 0), `period_cost_snapshots` (deliberate), `resource_engagements` (except the trigger's auto-create; 0 created this time).

### 2. Monthly days

The clone does **not** copy monthly rows, so there are no orphaned Oct/Nov/Dec rows on the Jan–Mar period. Consequences today:
- Every Q4 role lost its breakdown. The total is directly editable, and "Populate working days" is available per role.
- If the clone *had* copied them with source month dates, the schedule would key months off the new period (Jan/Feb/Mar), so the Oct–Dec rows would be invisible. `hasAnyMonthlyValue` would still lock the total to the sum of those invisible months, and `set_allocation_monthly_days` would keep summing them. **Any fix must never copy source month keys; it must generate new-period months.**
- Resource Timeline: it is hard-coded to Q2/Q3 (`COARSE_PERIOD_NAME` / `GRANULAR_PERIOD_NAME`), so Q4 is not drawn today. When the view rolls forward:
  - The native engine (the default) draws bars from engagement dates, and days are tooltip only. It falls back to `capacity_days` when no monthly rows exist.
  - The legacy engine falls back to a flat whole-quarter bar when there are no monthly rows. That would draw full-quarter bars for the 13 people who have left.

### 3. Working-day calculation today

Three independent UK implementations exist, and there is no non-UK calendar anywhere:

| Where | Holiday source | Used by |
|---|---|---|
| `lib/schedule/format.ts` `workingDaysBetween` | **hard-coded set, 2025–2027 only** | Create-period wizard "Working days" (shows 61 for Q4, correctly), schedule period header, Rate Calculator export, conflict day maths |
| `lib/schedule/monthlyDays.ts` `calculateWorkingDaysInMonth` | `uk_bank_holidays` passed in | "Populate working days" button, Add Role wizard |
| `packages/schema/.../resource-timeline/workingDays.ts` | `uk_bank_holidays` passed in | Resource Timeline |

- `uk_bank_holidays` has columns `holiday_date` (PK), `title` and `division` (all rows are `england-and-wales`). It is seeded for 2024–2028 with 8 rows per year, and the 2027 rows include 26 Mar and 29 Mar.
  - UK Q3 FY26/27 = 22 + 21 + 21 = **64**.
  - UK Q4 FY26/27 = 20 + 20 + 21 = **61**.
- **The offshore 63 is data, not derived.** Every full offshore Q3 role has the hand-entered pattern Oct 22, Nov 20, Dec 21. No code produces it.
- **Location, not country, decides the calendar:**
  - Offshore roles where `resource_country = 'United Kingdom'` are at 63.
  - Onshore roles where `resource_country = 'India'` are at 64.
  - All 15 fully booked nearshore roles are at 64, the UK pattern.
  - So the row-level `resource_period_allocations.resource_location` snapshot is the right key. `resource_country` (free text, often null) is unusable.
- **What's missing:** any offshore holiday data. It is probably a per-supplier delivery-centre calendar rather than a national one, since TCS and CG may differ. `unspecified` or null locations have no defined calendar; there are none in Q3.

### 4. Row classification

**Key finding: classify on the monthly shape, not the total.** All Q3 roles have monthly rows, and the shape separates the cases cleanly. Totals alone cannot tell apart "57 = December shutdown" and "57 = part-time", and utilisation is 100 everywhere.

A month is *full* when its days equal that month's working days on the role's calendar. The calendar is UK for onshore and nearshore. For offshore it is last quarter's figure, worked out from the data (§B). Rules are evaluated in order:

| # | Class | Rule | Action in new quarter |
|---|---|---|---|
| 0 | NO_DAYS | capacity null or 0 | keep |
| 1 | **ENDED** | named role whose engagement `roll_off_date` < new period start | **keep and flag** — never inflate |
| 2 | **FULL** | every month full (or, with no monthly rows, total = source full total) | **recalculate** to the new calendar, clipped at a roll-off inside the new quarter |
| 3 | **RAMP-ON** | non-estimated `roll_on_date` inside the source period; months before the joining month are 0 and months after are full; joining month = working days from roll-on ±1 | **recalculate** to full, clipped as above |
| 4 | PART-TIME | every month > 0, none full, spread ≤ 1 day (for example 5/5/5, 2/2/2, 11/11/10) | **keep exactly**; monthly pattern remapped month by month |
| 5 | LEAVE-ADJUSTED | engagement open across the whole source period and into the new one; every month ≥ 50% of full; at least one month ≥ 90% | **keep and suggest** full working days; the user decides |
| 6 | TOTAL-ONLY | no monthly rows and shortfall not explained | keep (your hypothesis's "deliberate part-time") |
| 7 | UNCERTAIN | anything else | keep and flag |

Post-checks, which add flags without changing any figure:
- A kept value is greater than the new quarter's working days. For example, a leave-adjusted 62 in a 61-day quarter.
- A person's total across all their roles exceeds the new quarter's working days.
- The engagement's roll-on is still marked estimated.

**Why not the original hypothesis as written:**
- "Shortfall not explained by engagement → part-time" files the 15 EPAM/TCS leave- and shutdown-adjusted full-timers as part-time and keeps 57 for Jan–Mar. The December 14 days is EPAM's Christmas shutdown from 21 Dec, which is Q3-specific.
- "FULL → recalculate" without the ENDED check inflates two full Q3 roles whose engagement ends 31 Dec 2026.

Utilisation is not used as a discriminator, as you specified.

### 5. Real-data result (Q3 → Q4, run SELECT-only)

| Class | Roles | Q3 days | Locations | What happens |
|---|---|---|---|---|
| FULL | 57 (3 vacant) | 3,633 | 27 onshore, 15 nearshore, 15 offshore | 42 UK-calendar roles: 64 → 61. 15 offshore: 63 → new offshore figure (to be entered) |
| RAMP-ON | 13 | 537 | 1 nearshore, 12 offshore | → full new quarter (for example 21 → 61 or the offshore figure) |
| ENDED | 13 | 348 | 5 onshore, 8 offshore | kept and flagged: 9 CG (roll-off 30 Oct), 1 CG (16 Oct), 1 RMG (6 Nov), 2 NH (31 Dec) |
| LEAVE-ADJUSTED | 15 | 828 | 9 nearshore, 6 onshore | kept; full working days offered as a suggestion |
| PART-TIME | 6 | 128 | 2 nearshore, 4 onshore | kept exactly |
| UNCERTAIN | 1 | 9 | nearshore | kept and flagged |

How the known cases come out:
- **32 days at 100%** (11/11/10): PART-TIME, kept at 32. The classifier cannot know that this person goes full-time next quarter, because nothing in the data says so. It sits in the kept list, where the user changes it (open question d).
- **Handover 9 + 55:** the joiner (13/21/21, roll-on 14 Oct; 13 = working days from 14 Oct) is RAMP-ON → 61. The leaver (9/0/0) has **no roll-off date recorded**, so they are UNCERTAIN, kept at 9 and flagged "days stop in October but no roll-off date is recorded".
- **CG 5/12/22:** ENDED (roll-off 30 Oct, or 16 Oct for the 12-day role). Not inflated. Several of these people also hold a TCS RAMP-ON role in the same quarter, as CG → TCS movers.
- **TCS 15/21/31/41/51 (and 56):** all RAMP-ON. Each joining month matches the roll-on date to within 1 day: 19 Oct → 10, 12 Oct → 15, 2 Nov → 20, 16 Nov → 10, 1 Dec → 21.
- **RMG 27** (22/5/0): ENDED, roll-off 6 Nov (2–6 Nov = 5 days). Your guess of a mid-quarter exit was right.
- **Vacant roles:** all 3 are full-quarter, so they are FULL and get recalculated. A non-full vacant role would be UNCERTAIN.
- **Expense rows with no days:** there are no zero-day roles. "Expenses" live in `platform_cost_items`, which the clone does not copy at all (§E).
- **TCS onshore 62** (20/21/21, roll-on 2 Sep): LEAVE-ADJUSTED. If kept, it is flagged as over the 61-day quarter.

### 6. Blast radius

Everything below reads `capacity_days`, and some read the monthly days. All of it is per period, so a recalculation affects only the **new draft**:

- **Schedule page:** row BASE/+VAT (`computeRowMoneyPence`), footer and Filtered Totals (Days), team-filtered days (`sumChargeableDays`), Total Platform Cost and Advised rate (`computeScheduleTotals` → `xChargeableDays`), recovery variance, the monthly columns and "Populate working days".
- **Exports:** Rate Calculator (`xChargeableDays`, recovery formula), Platform Schedule, Team Schedule (`proratedDays`, `teamShare`), Supplier Schedule (commercial cost), and Export current view (Days, run-rate cost).
- **Elsewhere:** homepage cost (`homepageCost.ts`), the People detail panel, the Add Role wizard conflict maths, and Resource Timeline (tooltip days; legacy engine geometry).
- **Locked periods:**
  - The clone only reads the source and only writes rows carrying the new `period_id`. No path recalculates an existing period.
  - The proposed RPC keeps that property: it may only write rows of the period it creates in the same transaction.
  - Note that nothing at the DB level stops writes to a locked period's roles; the lock is enforced in the UI only (§E).

---

## PHASE 2 — Proposal

### A. Wizard

The steps become: Period → Copy forward → **Working days** (only if copying) → **Preview** → Confirm.

**Working days step:**
- Two choices:
  - **"Recalculate working days for the new quarter (recommended)":** the classifier above.
  - **"Copy last quarter's days exactly":** today's behaviour, but with the monthly breakdown remapped month by month so it isn't lost.
- When recalculating, show one calendar panel per location group present in the source:
  - **Onshore and nearshore — UK calendar.** "Jan 20 · Feb 20 · Mar 21 = 61 — calculated from bank holidays". Editable; the label changes to "edited" when changed.
  - **Offshore — "No calendar held for offshore roles. Enter working days for each month."** Three required inputs with no prefill. Helper text: "Last quarter these roles used Oct 22 · Nov 20 · Dec 21 = 63 (worked out from 15 roles)" and "Weekdays: Jan 21 · Feb 20 · Mar 23". Next stays disabled until all are entered.
  - **Unspecified** (if any): "No location set for N roles. Choose which calendar to use." It is never defaulted silently.
- **Missing holiday data** for a year the new quarter touches: "Bank holidays for 2029 aren't loaded, so UK working days can't be calculated. Enter them, or choose Copy exactly." The UK inputs then become required.

**Preview step** (read-only; nothing written yet):
- **Summary strip:** counts per group, and total days before → after.
- **"Will change" (FULL and RAMP-ON):** role, person (or "Vacant role"), last quarter → new quarter, and a reason. For example: "Full quarter", or "Joined 19 Oct 2026 — now full quarter", or "Rolls off 12 Feb 2027 — days up to then".
- **"Kept as last quarter" (PART-TIME and TOTAL-ONLY):** days and a reason. For example: "Same days every month (5 / 5 / 5)".
- **"Your call" (LEAVE-ADJUSTED):** a per-row toggle, defaulting to **Keep** (your principle). Each row shows "Keep 57" against "Use full working days 61", with the reason "Last quarter included time off (Dec 14 of 21)". One bulk action: "Use full working days for all 15".
- **"Needs a look" (ENDED, UNCERTAIN, and anything failing a post-check):** kept, with a plain reason. For example: "Rolled off 30 Oct 2026 — not in the new quarter", or "Days stop in October but no roll-off date is recorded", or "More than the 61 working days in the new quarter".
- **States:**
  - *Loading* ("Checking last quarter's roles…").
  - *Error* (with Retry).
  - *Empty source* ("Last quarter has no roles to copy").
  - *Source changed since preview*: the commit is refused with "Last quarter changed while you were reviewing — refresh the preview".
- Wording throughout: "role", never "seat" or "allocation"; en-GB dates. Mockup to follow in Claude Chat.

**Confirm step:** today's summary, plus "N roles recalculated, N kept, N need a look". Rows that need a look stay unconfirmed, which they will be anyway (`is_confirmed = false`). The Confirmed column remains the existing review mechanism.

### B. Calendar strategy

| Option | For | Against |
|---|---|---|
| 1. Country/division-keyed calendar table (**needs an ADR + migration**) | Persisted; fixes "Populate working days" for offshore too; reusable | We don't know the right key. The data suggests supplier delivery-centre calendars (TCS ≠ CG), not countries. We have no source data for them, and the design would be guessed now. |
| 2. `uk_bank_holidays` for onshore/nearshore; user enters offshore monthly figures in the wizard | No schema change; explicit; never silently assumes | Re-entered each quarter; not persisted, so it doesn't help "Populate" |
| 3. As 2, plus last quarter's offshore calendar worked out from the data (the most common fully booked monthly pattern per location) for **classifying the source** and as a reference figure | Lets the classifier work on offshore source rows today, with no holiday data | Inference is only a reference for the *source* quarter. It is never used as the new quarter's figure. |

**Recommend 2 + 3 now, and 1 later** (a separate ADR when a second stored calendar is genuinely needed, for example to fix "Populate" for offshore roles). The calendar key is the row's `resource_location` snapshot, falling back to the person's `resource_location`. `resource_country` is ignored.

### C. Pure functions and tests

New module: `apps/nucleus/lib/schedule/periodClone/`. Each file stays under 300 lines, with a `__tests__/` file beside it. All fixtures use synthetic names and invented figures.

| Function | Purpose |
|---|---|
| `workingDaysInRange(startIso, endIso, holidays: ReadonlySet<string>): number` | Weekdays minus holidays, UTC-safe |
| `monthWorkingDays(periodStart, periodEnd, calendar): MonthDays[]` | `calendar` is `{ kind: 'holidays'; dates }` or `{ kind: 'monthTotals'; totals }` |
| `calendarKeyFor(rowLocation, resourceLocation): CalendarKey` | onshore/nearshore → `uk`, offshore → `offshore`, otherwise `unspecified` |
| `inferSourceCalendar(rows, months): Record<CalendarKey, InferredCalendar \| null>` | Most common fully booked pattern, plus the number of supporting rows |
| `classifyRoleDays(row, sourceCalendar, sourcePeriod, newPeriod): Classification` | The class plus evidence |
| `proposeNewDays(row, classification, newCalendar, newPeriod): DayProposal` | Total plus new-period monthly days; clips at roll-off and roll-on |
| `remapMonthlyPositional(sourceMonthly, newMonths): Record<string, number>` | Keeps the sum; used for kept and copied-exactly rows |
| `personCapacityChecks(proposals, newWorkingDays): Flag[]` | Over-capacity post-checks |
| `buildClonePlan(input, choices): ClonePlan` | Groups, counts, totals before → after |
| `describeDecision(decision): string` | Plain-English reason |

Test cases:
- **`workingDaysInRange` / `monthWorkingDays`:**
  - UK Q3 FY26/27 = 64, made up of 22/21/21.
  - UK Q4 FY26/27 = 61 (20/20/21), with Good Friday 26 Mar and Easter Monday 29 Mar removed and 1 Jan removed.
  - A holiday that falls on a weekend changes nothing.
  - A different calendar (invented month totals) is honoured.
  - A mid-month clip.
  - An empty range gives 0.
- **`calendarKeyFor`:** offshore with country "United Kingdom" → offshore; onshore with null country → uk; unspecified → unspecified.
- **`inferSourceCalendar`:** picks the most common pattern; returns null when no role is fully booked.
- **`classifyRoleDays`:**
  - Full row.
  - A 50%-via-days row (10/11/11) → part-time.
  - A PMO on 5 days a month (5/5/5) kept.
  - A role on 3 days a quarter (1/1/1, or total-only 3) kept.
  - A ramp row joining mid-quarter (19 Oct; 10/20/21) → ramp.
  - A ramp whose joining month is off by more than 1 → uncertain.
  - An estimated roll-on is never treated as a ramp.
  - A leave-adjusted row (22/21/14).
  - Ended mid-source (22/0/0, roll-off 30 Oct).
  - A row that looks full but whose engagement ends on the last day of the source → ended.
  - A leaver with no roll-off (9/0/0) → uncertain.
  - A vacant full row → full.
  - A vacant non-full row → uncertain.
  - A zero/null-days row → no-days.
  - A row with no monthly rows (total-only).
- **`proposeNewDays`:**
  - A ramp row rolling off mid-new-quarter, clipped to the roll-off date.
  - A roll-off on the last day of the new quarter → unclipped.
  - Monthly output sums to the total.
- **`remapMonthlyPositional`:** 5/5/5 maps to Jan/Feb/Mar; never emits source month keys.
- **`personCapacityChecks`:** one person on two roles over 61 → flagged.
- **`buildClonePlan`:**
  - Counts and totals.
  - "Copy exactly" returns no day changes.
  - **A locked source period produces writes only for the new period.**
  - User choices (keep or suggested) are applied.

### D. Migration and ADR

- **Migration `042_create_period_from_plan.sql`** (DDL only, via `apply_migration`; no DML mixed in). It adds `create_period_from_plan(p_period_name, p_start, p_end, p_copy_from, p_source_fingerprint text, p_day_plan jsonb) RETURNS uuid`, `SECURITY DEFINER`, and runs as **one transaction**. In order:
  1. Validate the inputs.
  2. Compare the source fingerprint (role count + max `updated_at` + monthly-row max `updated_at`) and raise with a dedicated SQLSTATE if it has changed.
  3. Insert the period.
  4. Copy the roles as 023 does, setting `is_confirmed = false` **explicitly**.
  5. Apply `p_day_plan` overrides through the old → new mapping.
  6. Insert new-period monthly rows.
  7. Copy team rows exactly as 023 does.
- **Guards:**
  - Every plan entry must reference a live source role.
  - Every `month_start_date` must fall within the new period.
  - Days must be ≥ 0.
  - Where monthly rows are supplied, `capacity_days = SUM(monthly)`.
  - Rows are written only for `v_new_period_id`.
- Keep 023's function in place until the UI has switched, then retire it in a later migration.
- **The plan is computed server-side:** the server action re-fetches the source, rebuilds the plan from the user's calendar inputs and per-row choices, then calls the RPC. It never trusts figures sent from the client.
- **No ADR is needed** for 2 + 3. This follows ADR-013 and the atomic-RPC pattern of 019/023/028. **Option 1 needs an ADR and a migration** (a new reference table and a calendar key on roles or suppliers).

### E. Risks — FLAGGED, NOT TO BE FIXED in this task

1. **Roles for people who have left are carried forward.** 13 Q4 roles (348 days) belong to people whose engagement ended in Q3, and their `engagement_id` points at the ended engagement. In forecast terms this is a bigger error than the 64 → 61 difference.
2. **The clone drops every monthly breakdown.** All 105 Q4 roles are in manual mode.
3. **"Populate working days" and the Add Role wizard apply the UK calendar to every role,** so an offshore role gets UK figures. The same platform-wide assumption is behind the conflict maths and the period "Working days" header.
4. **There are three UK holiday sources.** `format.ts` is hard-coded to 2025–2027, so from Jan 2028 the wizard, header and Rate Calculator will over-count (for example, 3 Jan 2028 is missing).
5. **`platform_cost_items` are not copied** (Q3 has 1, Q4 has 0). This may be intended; please confirm.
6. **`is_confirmed`:** correctly false in Q4, but only via the column default. The new RPC should set it explicitly.
7. **The engagement trigger can auto-create engagements on clone,** with `roll_on` = new period start and `estimated` = true, for a person/supplier pair with no engagement. 0 occurred this time.
8. **Team rows:** copied faithfully; 15 named roles have no team row in either quarter (pre-existing). Person-keyed team rows are per person per period, not per role, so CG → TCS movers share one set.
9. **No guard against duplicate or overlapping periods** in `create_period_with_optional_copy`.
10. **The source is always the latest period, not the one being viewed,** so creating Q1 FY27/28 now would copy the unreviewed Q4 draft.
11. **Locks are UI-only.** There is no DB guard against writing to a locked period's roles. Q2 FY26/27 (ended 30 Sep) and Q3 are still unlocked drafts.
12. **ADR-013 says `capacity_days = working days × utilisation`,** but money maths multiplies `capacity_days × utilisation%`. Following the ADR literally would apply utilisation twice. The ADR text has drifted.
13. **Resource Timeline is hard-coded to Q2/Q3.** When it rolls forward, the legacy engine draws flat full-quarter bars for roles with no monthly rows.
14. **`CreatePeriodWizard.tsx` breaks house rules:** it is 480 lines (over 300) and uses hard-coded hex colours instead of `--rmg-*` tokens. Split it as part of the UI step.
15. **Real personal names in migrations 034 and 037** (the client-fingerprints rule).

### F. Build order (each step shippable on its own)

1. **`workingDaysInRange` and `monthWorkingDays`, with tests.** No callers yet. *Sonnet.*
2. **Classifier, proposal, remap, checks, `buildClonePlan` and `describeDecision`, with the full test list.** *Opus* — this is where the judgement sits.
3. **Read-only server action `previewPeriodClone`.** It fetches the source roles, monthly days, engagements and holidays, and returns the plan. *Sonnet.*
4. **Migration 042 RPC `create_period_from_plan`.** Validate on a Supabase branch first. *Opus* (atomicity and `SECURITY DEFINER` review).
5. **Server action `createPeriodFromPlan`.** It rebuilds the plan server-side and calls the RPC. *Sonnet.*
6. **Wizard UI.** Split it into step components, then add the Working days and Preview steps, from the Claude Chat mockup. *Sonnet.*
7. **Existing Q4 draft.** Either soft-delete and re-create it (it has had 0 edits since creation), or run the plan against it as a one-off. This needs your decision (open question e). *Sonnet.*
8. **Later:** calendar table ADR and migration, then switch "Populate" to per-location calendars. *Opus.*

---

## Appendix — read-only classifier SQL (step 5)

SELECT only. Live project `nwltpivvqynkfghazjpi`. It returns `COUNT` rows per class and location, then a `ROW` line for every role that is not recalculated automatically, plus any clipped role. This has already been run and produced the §5 figures. Re-run it to see names.

```sql
-- READ-ONLY. Classifies every live role in the SOURCE quarter under the
-- proposed rules and shows what each would become in the NEW quarter.
-- Project nwltpivvqynkfghazjpi. No writes; safe to re-run.
with params as (
  select '10cfda7c-8c57-4da3-9dab-b8210032b030'::uuid as src_id,
         '8557aabf-3309-45bc-b840-9d496381618f'::uuid as dst_id,
         1::numeric as ramp_tolerance_days,      -- +/- days allowed in the joining month
         0.5::numeric as leave_min_month_ratio   -- every month >= 50% of full, and one month >= 90%, to count as "leave-adjusted"
),
src as (select p.period_start_date s, p.period_end_date e from periods p, params where p.period_id = params.src_id and p.deleted_at is null),
dst as (select p.period_start_date s, p.period_end_date e from periods p, params where p.period_id = params.dst_id and p.deleted_at is null),

-- Working days per calendar month of a period, UK (England & Wales) calendar.
src_months as (
  select row_number() over (order by m) as ord, m::date as m
  from src, generate_series(date_trunc('month', src.s), date_trunc('month', src.e), interval '1 month') m
),
dst_months as (
  select row_number() over (order by m) as ord, m::date as m
  from dst, generate_series(date_trunc('month', dst.s), date_trunc('month', dst.e), interval '1 month') m
),
uk_src as (
  select sm.ord, sm.m, count(*) filter (
           where extract(isodow from d) < 6
             and not exists (select 1 from uk_bank_holidays h where h.holiday_date = d::date)) as wd
  from src_months sm, src,
       generate_series(greatest(sm.m, src.s), least((sm.m + interval '1 month - 1 day')::date, src.e), interval '1 day') d
  group by sm.ord, sm.m
),
uk_dst as (
  select dm.ord, dm.m, count(*) filter (
           where extract(isodow from d) < 6
             and not exists (select 1 from uk_bank_holidays h where h.holiday_date = d::date)) as wd
  from dst_months dm, dst,
       generate_series(greatest(dm.m, dst.s), least((dm.m + interval '1 month - 1 day')::date, dst.e), interval '1 day') d
  group by dm.ord, dm.m
),

-- Live source roles with calendar bucket and engagement dates.
rows as (
  select a.allocation_id, a.resource_id, r.resource_name, s.supplier_abbreviation as supplier,
         a.role_title, a.planview_code, a.capacity_days, a.utilisation_percent,
         coalesce(a.resource_location::text, r.resource_location::text, 'unspecified') as loc,
         e.roll_on_date, e.roll_on_estimated, e.roll_off_date, e.roll_off_reason
  from resource_period_allocations a
  join params on a.period_id = params.src_id
  left join resources r on r.resource_id = a.resource_id and r.deleted_at is null
  left join suppliers s on s.supplier_id = a.supplier_id
  left join resource_engagements e on e.engagement_id = a.engagement_id and e.deleted_at is null
  where a.deleted_at is null
),
-- Monthly breakdown (this table has no deleted_at column), zero-filled per source month.
row_months as (
  select ro.allocation_id, sm.ord, sm.m, coalesce(md.days, 0) as days, (md.allocation_id is not null) as has_row
  from rows ro cross join src_months sm
  left join resource_period_allocation_monthly_days md
    on md.allocation_id = ro.allocation_id and md.month_start_date = sm.m
),
row_patterns as (
  select ro.allocation_id, ro.loc, bool_or(rm.has_row) as has_monthly,
         array_agg(rm.days order by rm.ord) as pat, bool_and(rm.days > 0) as all_positive
  from rows ro join row_months rm using (allocation_id)
  group by ro.allocation_id, ro.loc
),
-- Non-UK calendar for the SOURCE quarter, inferred as the most common
-- all-months-positive pattern among that location's roles. Used for offshore only.
inferred as (
  select distinct on (loc) loc, pat, n
  from (select loc, pat, count(*) n from row_patterns where has_monthly and all_positive group by loc, pat) x
  order by loc, n desc
),
src_cal as (  -- full working days per month per location bucket
  select l.loc, u.ord,
         case when l.loc = 'offshore' then (select i.pat[u.ord] from inferred i where i.loc = 'offshore')
              else u.wd end as full_days
  from (select distinct loc from rows) l cross join uk_src u
),
per_row as (
  select ro.*, rp.has_monthly, rp.pat,
         (select sum(c.full_days) from src_cal c where c.loc = ro.loc) as src_full_total,
         (select array_agg(c.full_days order by c.ord) from src_cal c where c.loc = ro.loc) as src_full_pat,
         bool_and(rm.days = c.full_days)                                   as all_full,
         bool_or(rm.days = c.full_days)                                    as any_full,
         min(rm.days / nullif(c.full_days, 0))                             as min_ratio,
         max(rm.days / nullif(c.full_days, 0))                             as max_ratio,
         max(rm.days) - min(rm.days)                                       as spread,
         -- ramp-on shape: months before the joining month are 0, months after are full
         bool_and(case when rm.m <  date_trunc('month', ro.roll_on_date) then rm.days = 0
                       when rm.m >  date_trunc('month', ro.roll_on_date) then rm.days = c.full_days
                       else true end)                                      as ramp_shape_ok,
         max(case when rm.m = date_trunc('month', ro.roll_on_date) then rm.days end) as join_month_days,
         max(case when rm.m = date_trunc('month', ro.roll_on_date) then c.full_days end) as join_month_full
  from rows ro
  join row_patterns rp using (allocation_id)
  join row_months rm using (allocation_id)
  join src_cal c on c.loc = ro.loc and c.ord = rm.ord
  group by ro.allocation_id, ro.resource_id, ro.resource_name, ro.supplier, ro.role_title, ro.planview_code,
           ro.capacity_days, ro.utilisation_percent, ro.loc, ro.roll_on_date, ro.roll_on_estimated,
           ro.roll_off_date, ro.roll_off_reason, rp.has_monthly, rp.pat
),
-- Expected working days in the joining month from roll-on to month end (weekdays less UK holidays).
join_expect as (
  select pr.allocation_id,
         (select count(*) from generate_series(pr.roll_on_date,
                    (date_trunc('month', pr.roll_on_date) + interval '1 month - 1 day')::date, interval '1 day') d
          where extract(isodow from d) < 6
            and not exists (select 1 from uk_bank_holidays h where h.holiday_date = d::date)) as expected
  from per_row pr where pr.roll_on_date is not null
),
classified as (
  select pr.*, je.expected as join_expected,
    case
      when coalesce(pr.capacity_days, 0) = 0                                   then 'NO_DAYS'
      when pr.resource_id is not null and pr.roll_off_date < (select s from dst) then 'ENDED_BEFORE_NEW'
      when (pr.has_monthly and pr.all_full)
        or (not pr.has_monthly and pr.capacity_days = pr.src_full_total)       then 'FULL'
      when pr.resource_id is not null and pr.has_monthly
        and pr.roll_on_estimated = false
        and pr.roll_on_date >  (select s from src) and pr.roll_on_date <= (select e from src)
        and pr.ramp_shape_ok
        and abs(pr.join_month_days - least(je.expected, pr.join_month_full)) <= (select ramp_tolerance_days from params)
                                                                               then 'RAMP_ON'
      when pr.has_monthly and pr.all_positive_ok and pr.spread <= 1 and not pr.any_full
                                                                               then 'PART_TIME_STEADY'
      when pr.resource_id is not null and pr.has_monthly
        and (pr.roll_on_date <= (select s from src) or pr.roll_on_estimated)
        and (pr.roll_off_date is null or pr.roll_off_date >= (select s from dst))
        and pr.max_ratio >= 0.9 and pr.min_ratio >= (select leave_min_month_ratio from params)
                                                                               then 'LEAVE_ADJUSTED'
      when not pr.has_monthly                                                  then 'PART_TIME_TOTAL_ONLY'
      else 'UNCERTAIN'
    end as class
  from (select per_row.*, (select bool_and(x > 0) from unnest(per_row.pat) x) as all_positive_ok from per_row) pr
  left join join_expect je using (allocation_id)
),
proposed as (
  select c.*,
    case when c.loc = 'offshore' then null  -- no offshore calendar for the new quarter: must be entered
         else (select sum(u.wd) from uk_dst u) end as dst_full_total,
    case
      when c.class in ('FULL', 'RAMP_ON') and c.roll_off_date >= (select s from dst) and c.roll_off_date < (select e from dst)
        then 'clip to roll-off ' || to_char(c.roll_off_date, 'DD Mon YYYY')
      else null end as clip_note
  from classified c
)
-- 1) Counts per class
select 'COUNT' as section, class, loc, count(*)::text as n, null::text as detail
from proposed group by class, loc
union all
-- 2) Everything that would NOT be recalculated automatically, with reason inputs
select 'ROW', class, loc,
       coalesce(resource_name, '(vacant)') || ' | ' || coalesce(supplier, '?') || ' | ' || coalesce(role_title, '?'),
       'days ' || capacity_days || ' | months ' || array_to_string(pat, '/') ||
       ' | full ' || array_to_string(src_full_pat, '/') ||
       ' | on ' || coalesce(to_char(roll_on_date, 'DD Mon YY'), '-') || case when roll_on_estimated then ' (est)' else '' end ||
       ' | off ' || coalesce(to_char(roll_off_date, 'DD Mon YY'), '-') ||
       coalesce(' | ' || clip_note, '')
from proposed where class not in ('FULL', 'RAMP_ON') or clip_note is not null
order by 1, 2, 3, 4;
```
