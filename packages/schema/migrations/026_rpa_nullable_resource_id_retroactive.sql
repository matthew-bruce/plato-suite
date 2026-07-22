-- 026 — resource_period_allocations.resource_id nullable (RETROACTIVE RECORD)
--
-- This file is a backfilled paper trail, not a new change. The ALTER below was
-- actually applied directly to the live Supabase project on 2026-05-28 via the
-- Supabase MCP connector (Supabase:apply_migration), during a Claude Chat design
-- session, without a corresponding .sql file ever being committed to this repo.
-- A later, unrelated migration was then filed as "006"
-- (006_rpa_display_order.sql), so there is no numbering collision with a
-- migration that was actually run in that slot — but the repo's migration
-- history did not reflect this change at all until now, and ADR-032 (which
-- should have documented the decision) was never written either. See
-- ADR-032-nullable-resource-id-vacant-slots.md, written alongside this file on
-- 2026-07-22, and SCHEMA_DESIGN.md §2.5.
--
-- Do not expect this file to error on re-run against the live project — the
-- column is already nullable there. It is filed here purely so the migration
-- history is complete and future readers aren't confused by a schema that
-- doesn't match what 001-025 would produce on a fresh database.
--
-- Effect (as actually applied 2026-05-28): resource_period_allocations rows can
-- now have resource_id = NULL, representing a vacant/TBC cost placeholder — a
-- role that exists and has an agreed rate in a SoW/PO, but no named person yet.
-- role_title (migration 005) already carries the role description independent
-- of resource_id. See migration 019 (connect_resource_keep_existing /
-- connect_resource_use_vacant) for the RPCs that fill a vacant seat.

ALTER TABLE resource_period_allocations
  ALTER COLUMN resource_id DROP NOT NULL;
