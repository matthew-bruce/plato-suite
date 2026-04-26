# ADR-010 — Explicit Field Naming Convention

Date: 2026-04-19
Status: Accepted

## Decision
Field names must be explicit and unambiguous across the entire schema.
Generic names (`name`, `description`, `status`, `id`) are prohibited.
Every field must be prefixed with the entity it belongs to.

```sql
-- ❌ Wrong — ambiguous across tables
name, description, status, code

-- ✅ Correct — explicit and unambiguous
team_name, team_description, team_status
resource_name, supplier_name, platform_code
```

## Context
A schema with generic field names creates ambiguity when multiple tables
are joined, when reading query results, and when writing TypeScript types.
`name` on a `teams` row and `name` on a `resources` row are
indistinguishable in query output. Explicit naming eliminates this class
of bug entirely and makes every field self-documenting.

## Rules
- Primary key: `{table_singular}_id` (e.g. `platform_id`, `team_id`)
- Name field: `{entity}_name` (e.g. `platform_name`, `resource_name`)
- Code/abbreviation: `{entity}_code` or `{entity}_abbreviation`
- Slug: `{entity}_slug`
- Description: `{entity}_description`
- Status enum: `{entity}_status`
- Boolean flags: `is_{adjective}` (e.g. `is_active`, `is_primary`)
- Timestamps: `created_at`, `updated_at`, `deleted_at` — these three
  are the only fields exempt from the prefix rule, as they are
  universal and unambiguous by convention

## Consequences
- TypeScript types are unambiguous — `PlatformRow.platform_name` vs
  `TeamRow.team_name` are distinct with no aliasing required
- Supabase `.select()` queries return self-documenting objects
- Slightly more verbose SQL — accepted cost
- All legacy tables with generic names must be migrated before use
  in Plato Suite (this was a blocker for the platform-org-structure
  legacy tables which used `name`, `code`, `description`)
