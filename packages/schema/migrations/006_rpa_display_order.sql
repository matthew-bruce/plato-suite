-- 006_rpa_display_order.sql
-- Adds a per-row display_order to resource_period_allocations so the Platform
-- Schedule can persist manual drag-and-drop ordering within each supplier group.
--
-- NOTE ON NUMBERING/LOCATION: the feature spec referenced
-- `supabase/migrations/013_rpa_display_order.sql`, but this repository keeps its
-- canonical migrations in `packages/schema/migrations/` (latest was 005), so this
-- file follows the established convention as 006.
--
-- NOTE ON BACKFILL ORDER: the spec suggested ordering the backfill by
-- resources.sort_order then resources.resource_name. The `resources` table in this
-- schema has no sort_order column (sort_order lives on `suppliers`), so the backfill
-- orders by resource_name only — which matches the schedule query's default
-- within-group ordering and is stable.

ALTER TABLE resource_period_allocations
  ADD COLUMN IF NOT EXISTS display_order INTEGER;

COMMENT ON COLUMN resource_period_allocations.display_order IS
  'Manual within-group display order for the Platform Schedule. Rows render in '
  'display_order ASC NULLS LAST within a (period, supplier) group. Nullable: rows '
  'inserted without an explicit value sort last.';

-- Backfill all existing rows with a sensible default.
-- Partition by (period_id, supplier_id) — matching the drag group boundary.
-- Order within each group by resource_name for stability.
UPDATE resource_period_allocations rpa
SET display_order = sub.row_num
FROM (
  SELECT
    rpa2.allocation_id,
    ROW_NUMBER() OVER (
      PARTITION BY rpa2.period_id, rpa2.supplier_id
      ORDER BY COALESCE(r.resource_name, 'ZZZ')
    ) AS row_num
  FROM resource_period_allocations rpa2
  LEFT JOIN resources r ON r.resource_id = rpa2.resource_id
) sub
WHERE rpa.allocation_id = sub.allocation_id;
