-- 027 — prevent duplicate active resources by name + supplier
--
-- Root cause: 11 EPAM resources existed twice (an original April record plus
-- a June duplicate from an unknown bulk script that inserted without checking
-- for an existing resource by name first). The April duplicates have been
-- soft-deleted as a data-hygiene fix. Neither resource-creation code path in
-- the app (createResourceAndAllocation's "new" mode, nor the standalone
-- insertResource used by the assign-mode wizard) has ever had a duplicate
-- check beyond a non-blocking "similar name" UI advisory, so this is a real
-- gap in the app itself, not just a rogue-script problem.
--
-- Verified clear before filing this migration (2026-07-23):
--   SELECT lower(resource_name), supplier_id, COUNT(*) FROM resources
--   WHERE deleted_at IS NULL GROUP BY 1, 2 HAVING COUNT(*) > 1;
-- returned zero rows (checked both with and without trim()).
--
-- This is a partial unique index, not a table constraint, so soft-deleted
-- rows (deleted_at IS NOT NULL) never collide with an active or future row —
-- re-adding someone who was soft-deleted, or having a soft-deleted duplicate
-- alongside a corrected active record (the exact EPAM shape), is unaffected.

CREATE UNIQUE INDEX resources_name_supplier_active_unique
ON resources (lower(resource_name), supplier_id)
WHERE deleted_at IS NULL;
