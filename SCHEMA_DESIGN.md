# SCHEMA_DESIGN.md — Plato Core Schema

> Living design document for the `@plato/schema` package and module-owned
> tables. Captures decisions made across design sessions before any SQL
> is written. Once the migration is produced, this document remains as the
> design rationale; ADRs in `docs/decisions/` capture the formal record.

---

## Section 0 — Governing Principle: Table Ownership

Two concerns are always kept separate:

| Concern | Answer |
|---|---|
| Where do TypeScript types live? | Always `@plato/schema` — single type registry for everything |
| Where does the CRUD UI live? | Every app that depends on an entity provides its own CRUD sufficient to operate standalone |

**The standalone CRUD rule:** A richer management experience may exist in another module, but never as a hard dependency. Shared entity CRUD is implemented once in `@plato/schema` (functions) and `@plato/ui` (components). Apps compose these into their own context. The primary management app provides a richer surrounding experience — not a different implementation.

**The three tiers:**

| Tier | Definition | Examples |
|---|---|---|
| Platform primitives | Always exist. No module can run without these. | `organisations`, `users` |
| Shared entities | Referenced by more than one module. Table in `@plato/schema`. CRUD in any module that needs it. | `platforms`, `teams`, `workstreams`, `arts` |
| Module entities | Owned and written by one module only. Others may read via FK. | `roles`, `planning_increments`, `periods`, `cost_configurations`, `org_containers` |

---

## Section 1 — Decisions LOCKED

### 1.1 Tenancy model

**Single-tenant per deployment.** Each Plato install (Plato SaaS, RMG, next
enterprise client) runs against its own database containing one
organisation's data only. Multi-tenancy is not in scope for v1 and would be
an explicit future migration.

Implication: no `organisation_id` denormalisation across tables. The
`organisations` table exists as a single-row config anchor for FKs and as
the auth boundary, not as a tenant scoping mechanism.

### 1.2 Core schema tables (owned by `@plato/schema`)

| Table | Purpose | Primary management UI |
|---|---|---|
| `organisations` | Single-row config anchor. Holds org name, slug, type. | Nucleus |
| `users` | FK to `auth.users(id)`. Optional FK to `resources`. Three-tier role enum. | Nucleus |
| `platforms` | L3. Long-running, Technology-owned infrastructure products. | Nucleus |
| `teams` | L1. Delivery teams. **Optional** — a Platform can operate without Teams. | Nucleus |
| `workstreams` | L2. Technology-defined grouping of related work. Scoped to a Platform. | Cursus, Despatch (equal) |
| `arts` | Agile Release Trains. Cross-platform, Commercially-defined. Optional. | Cursus, Despatch (equal) |
| `resources` | People. No role field — role is scoped to Nucleus. | Nucleus |
| `suppliers` | UUID PK. Name + abbreviation as separate fields, not encoded in ID. | Nucleus |

**User role model** (`user_role_enum`):

| Role | Access |
|---|---|
| `superuser` | Platform Heads, Directors. Full access including rate cards, day rates, cost configurations. Can impersonate other roles for testing. |
| `admin` | General configuration access. Restricted from commercially sensitive data (rate cards, day rates, allocations). |
| `viewer` | Read-only, non-sensitive data only. |

Commercial sensitivity is enforced at the RLS layer via the
`plato_is_superuser()` helper. Tables gated to superuser only:
`supplier_rate_cards`, `resource_period_allocations`, `cost_configurations`.
The `resources.day_rate_override` column is write-gated to superuser via a
trigger; read-gating of this column is the `@plato/schema` client's
responsibility until a non-sensitive view is added in a later migration.

### 1.3 Nucleus module tables (`apps/nucleus/`)

| Table | Purpose |
|---|---|
| `role_definitions` | Lookup. Canonical role types: ENG, DO, QA, PO, AC, SA. |
| `roles` | Actual slots. `{ROLE}-{NNN}` code, monotonic per role_code, immutable. Nullable `resource_id` (vacant = NULL). Many-to-one allowed for split allocations. See 1.7 for grouping and flags. |
| `disciplines` | Lookup. Single-select FK on resources. Seed values TBD. |
| `skills` | Lookup. Multi-select via join. `skill_category`: framework / language / platform / practice. |
| `resource_skills` | Join. Optional `skill_level`, `is_primary`. |
| `periods` | **Finance/reporting periods only.** Quarterly by default. Fixed by business calendar. `period_status`: draft / active / closed. NOT used for PI Planning. |
| `resource_period_allocations` | Per resource per period per role. The finance calculator's data backbone. Closed periods become read-only. Superuser-only RLS. |
| `cost_configurations` | Platform-scoped. Per-platform uplifts (VAT, on-costs, blended day rate). `effective_from` preserves history. Superuser-only RLS. |
| `supplier_rate_cards` | Day rates by supplier + role type. Superuser-only RLS. See 1.8. |

### 1.4 Despatch module tables (`apps/despatch/`)

| Table | Purpose |
|---|---|
| `planning_increments` | PI Planning periods. Fully flexible dates, no dependency on core `periods`. Owned entirely by Despatch. |

### 1.4a Cursus module tables (`apps/cursus/`)

| Table | Purpose |
|---|---|
| `org_containers` | Self-referential presentation layer for rendering org charts and roadmap views. Flexible grouping that sits *alongside* the typed hierarchy (`platforms` / `workstreams` / `teams`) — does not replace it. Containers reference core entities in application code but do not own them. Finance and planning continue to use the typed source of truth. |

### 1.5 Cross-cutting standards

- **Field naming:** explicit, never generic. `team_name` not `name`,
  `resource_id` not `id`.
- **Slugs:** every lookup and every entity with a stable display name has a
  `*_slug` column for URL/ID stability. Suite convention.
- **Timestamps:** `created_at` and `updated_at` are `NOT NULL DEFAULT NOW()`
  on every table. `deleted_at TIMESTAMPTZ` (nullable) for soft delete.
- **Soft deletes only.** Partial indexes filter `WHERE deleted_at IS NULL`.
  The `@plato/schema` client must filter by default.
- **`updated_at`** maintained via shared `plato_set_updated_at()` trigger.
- **UUID PKs everywhere.** No text PKs (avoids client fingerprints).
- **RLS enabled on every table from day one.** Single-tenant model means
  most policies gate on `plato_is_active_user()`. Commercially sensitive
  tables gate on `plato_is_superuser()` instead.
- **`sort_order INTEGER NOT NULL DEFAULT 0`** on any ordered entity.

### 1.6 Org hierarchy model

```
Platform (L3)          — long-running, Technology-owned, stable
  └── Workstream (L2)  — grouping of related work, Platform-scoped
        └── Team (L1)  — delivery team, optional
```

**Platforms** (`platforms`)
- Technology-owned, long-running infrastructure products (WEB, BIG, PDA, EPS, APP, ETP etc.)
- `platform_infrastructure_type` is NOT a field on platforms. Infrastructure is tracked at team level.
- Platforms are stable. They do not map to ARTs.

**Workstreams** (`workstreams`)
- Defined by Technology for Tech-funded work; defined by Commercial for commercially-funded work.
- `art_id` nullable FK. Commercial-defined workstreams have `art_id` set. Tech-defined workstreams have `art_id = NULL`.
- `funding_source` enum: `T4B / T4T / external`
- `workstream_theme` text — filterable attribute for roadmap grouping views. Values are user-defined, not an enum.
- Workstream CRUD lives in both Cursus and Despatch — neither is dependent on the other.

**Teams** (`teams`)
- Teams are optional. A Platform can operate without defined Teams.
- `platform_id` FK NOT NULL — a team always belongs to a Platform.
- `infrastructure_id` FK — one infrastructure at a time. Updated when a team migrates.
- `workstream_id` FK — primary workstream. Use `team_workstreams` join for edge cases.
- `team_workstreams` join table: `(team_id, workstream_id, is_primary BOOLEAN)` — supports teams working across multiple workstreams within the same ART.

**ARTs** (`arts`)
- Cross-platform. Commercially-defined. Can change.
- Optional — only relevant to organisations using SAFe / PI Planning.
- Any user can create ARTs as a grouping mechanism.
- In Despatch, ARTs are selected into PI cycles. Tech-defined ARTs can be excluded from PI Planning events.
- A Workstream not linked to any ART is valid.

**Infrastructure** (`infrastructures`)
- Lookup table: e.g. `Azure Cloud`, `Ensono On-Prem`.
- FK on `teams`. One infrastructure per team at any point in time.

**Org Containers** (`org_containers`) — *presentation-only, does not affect hierarchy*
- Self-referential tree. Cursus-owned.
- Exists to render flexible views that don't fit the typed hierarchy.
- Does not replace Platform / Workstream / Team and does not participate in finance or planning calculations.

### 1.7 Role/Resource separation model

- **Roles and resources are separate tables.**
- **`roles.resource_id`** is nullable many-to-one. Vacant role = NULL. Split allocation = same person filling multiple roles.
- **No `role_assignments` join table.** No history table. If history is ever needed, Chronicle owns it.
- **Role code format:** `{ROLE}-{NNN}` — e.g. `ENG-001`, `DO-001`, `QA-001`. Monotonic per role_code. Immutable. Not team-scoped.
- **Resource code:** none. People are identified by name + UUID.

**Role grouping** (`role_grouping_enum`) — three values, each with strict FK-presence rules enforced by `roles_grouping_scope_chk`:

| Value | `team_id` | `workstream_id` | Meaning |
|---|---|---|---|
| `leadership` | NULL | NULL | Org-wide leadership role. Not scoped to team or workstream. |
| `group_horizontal` | NULL | **required** | Role operating across a workstream, not embedded in a single team. |
| `team_embedded` | **required** | NULL | Role embedded in a specific delivery team. |

**Independent flags on `roles`** — neither depends on `role_grouping`, both are freely overridable on any role:

| Flag | Type | Default | Meaning |
|---|---|---|---|
| `is_extended_leadership` | BOOLEAN NOT NULL | `FALSE` | Marks roles that count as extended leadership regardless of grouping. No constraint relative to `role_grouping`. |
| `is_recoverable` | BOOLEAN NOT NULL | `TRUE` (column default) — *spec requires `FALSE` for leadership roles* | Whether the role is recoverable (e.g. cost-recoverable). For `role_grouping = 'leadership'`, the spec requires `FALSE`. Postgres cannot express "default FALSE when column X = Y", so application code and seed data MUST explicitly set `is_recoverable = FALSE` when inserting leadership roles. |

**UX consequence (deferred to UI session):** moving a person vs. moving the role+person together is a UI choice; schema supports both.

### 1.8 Rate card model

Day rates are supplier + role-type scoped, not hardcoded per resource. The MVP and the full model are the same — skip the interim MVP.

```sql
supplier_rate_cards (
  supplier_id       UUID FK → suppliers
  role_definition_id UUID FK → role_definitions
  day_rate          INTEGER NOT NULL  -- stored in pence
  effective_from    DATE NOT NULL
)

resources (
  ...
  day_rate_override  INTEGER NULL  -- pence. If set, ignores rate card. Rate card updates do not affect this resource.
)
```

When a supplier rate changes, update one `supplier_rate_cards` row. All resources on that supplier/role combination update automatically. Resources with `day_rate_override` set are unaffected.

A view `resources_current_rate` joins resources to their effective rate card (or override) for UI ergonomics. Migration `001` implements the override path only; full rate-card resolution is deferred to `002+`.

**Sensitivity:** `supplier_rate_cards` is superuser-only RLS. `resources.day_rate_override` writes are trigger-gated to superuser. Read-gating of `day_rate_override` is handled at the `@plato/schema` client layer.

### 1.9 Suppliers model

- UUID PK (not text PK as in legacy Nucleus).
- `supplier_name`, `supplier_abbreviation`, `supplier_slug`, `supplier_colour`, `supplier_logo_url`, `sort_order`.
- Per-org seed data, client-configurable. Nothing hardcoded.

### 1.10 Finance calculator support

The RMG quarterly day-rate spreadsheet is the canonical use case.

- **`periods`** is Nucleus-owned. Financial/reporting periods only. Quarterly by default. Fixed by business calendar. Completely separate from PI Planning cycles.
- **`resource_period_allocations`** is the snapshot. Day rate, utilisation, capacity, chargeable flag — all per resource per period per role. Rates can change quarter to quarter without losing history. **Superuser-only RLS.**
- **`cost_configurations`** is platform-scoped. Each platform runs its own calculator independently. Different platforms = different uplifts, different blended rates, different VAT handling. `effective_from` preserves history. **Superuser-only RLS.**
- **Day rate does NOT live on `resources` directly.** Derived from rate card (or override).

### 1.11 Period separation

Two completely separate concepts. No shared table. No FK between them.

| Concept | Table | Owner | Nature |
|---|---|---|---|
| Financial/reporting periods | `periods` | Nucleus | Fixed by business calendar. Quarterly. Feed the finance calculator. |
| PI Planning cycles | `planning_increments` | Despatch | Fully flexible dates. Can slip, shorten, overlap. Owned entirely by Despatch. |

### 1.12 Cost codes

**Dropped.** Cost codes (Planview-style BAU/F_GOV/PR) are not Plato's concern. Planview owns that. No `cost_codes` table.

---

## Section 2 — Decisions OPEN

### 2.1 Discipline taxonomy seed values

The `disciplines` lookup table is defined and its FK on `resources` is locked. The seed value list (Backend, Frontend, Full Stack, Mobile, DevOps/SRE, Data/Analytics, QA/Test, Architecture, Product, Delivery, ???) is **not yet confirmed**. To be agreed before data migration `002_seed_lookups.sql` is written. Not a blocker for migration `001`.

### 2.2 Roadmap item anchoring (parked — Cursus session)

What is a roadmap item at schema level? What does it attach to — Workstream, Team, `org_container`, or any of these? Agreed that it must work without Teams present. Full design deferred to a dedicated Cursus module session.

### 2.3 DASHBOARD_SPEC.md (memory reminder)

Document on another device. Contains Despatch context relevant to schema design. Bring into a Despatch session.

### 2.4 Read-gating of `resources.day_rate_override`

Migration `001` gates *writes* via trigger. Reads are not gated at DB level (Supabase's single `authenticated` role makes column GRANTs ineffective; Postgres has no native column-level RLS). Resolution options for `002+`:
- A `resources_non_sensitive` view excluding the column, consumed by admin/viewer
- A column-returning RPC gated by `plato_is_superuser()`
- Enforcement at the `@plato/schema` client abstraction only

Pick one before exposing the resources list to non-superusers.

---

## Section 3 — ADRs to write before migration `001`

| ADR | Topic |
|---|---|
| 007 | Single-tenant deployment model |
| 008 | Soft deletes + partial indexes convention |
| 009 | Timestamp nullability — NOT NULL DEFAULT NOW() suite-wide |
| 010 | Explicit field naming convention |
| 011 | Role/Resource separation, no history table |
| 012 | Role code format `{ROLE}-{NNN}`, monotonic, immutable |
| 013 | Temporal modelling via period snapshots (finance only) |
| 014 | Cost configurations scoped to platforms |
| 015 | Shared entity ownership — table in `@plato/schema`, CRUD in any dependent app |
| 016 | Platform/Workstream/Team/ART hierarchy model |
| 017 | `planning_increments` owned by Despatch, independent of core financial periods |
| 018 | Rate card model — supplier + role scoped, resource-level override |
| 019 | Teams are optional — Platforms can operate without defined Teams |
| 020 | ARTs are a shared entity, not Despatch-exclusive |
| 021 | Three-tier user role model, superuser RLS for commercial data |
| 022 | `org_containers` as presentation layer alongside typed hierarchy |

---

## Section 4 — Migration plan

- File: `packages/schema/migrations/001_core_schema.sql`
- Immutable baseline. Any change ships as `002_*`.
- Includes shared `plato_set_updated_at()`, `plato_is_active_user()`,
  `plato_is_superuser()`, `plato_guard_day_rate_override()` functions.
- All RLS policies included in `001`.
- Suppliers + role_definitions + disciplines + skills seeded as separate
  data migration `002_seed_lookups.sql` (per-deployment customisable).
  Discipline seed values to be confirmed before this file is written.
- Add `packages/schema/migrations/README.md` explaining the
  immutable-baseline convention.

---

## Section 5 — Decisions explicitly deferred (do not resolve in schema sessions)

- UI behaviour for move-person-vs-move-role (UI/UX session).
- The actual report layout for the finance calculator (report layer concern).
- Period state machine workflows beyond `period_status`.
- Multi-tenancy (explicit future migration if ever needed).
- Roadmap item schema and anchoring (Cursus module session).
- Discipline seed value list (data migration session).
- `workstream_theme` value list — user-defined, not an enum, no seed needed.
- Read-gating of `day_rate_override` (see 2.4) — a `002+` concern.
