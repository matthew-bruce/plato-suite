-- 035_resource_location_unspecified.sql
--
-- resource_location_enum has carried a fourth value, 'unspecified', on the
-- live database since September 2026, and five allocations already use it.
-- It was never added by a migration, so migrations 003..034 rebuild a
-- three-value enum: a fresh environment would reject every write the
-- Location dropdown's "Unspecified" option makes, and the Summary tab's
-- fourth location row would never be populated there.
--
-- This reconciles the file history with the database rather than changing it.
-- IF NOT EXISTS makes it a no-op against the live instance.
--
-- Semantics: 'unspecified' means no location has been decided for this row —
-- the same thing a NULL means. Both report as "Unspecified" wherever the
-- application groups by location (see locationBucket in
-- apps/nucleus/lib/schedule/ui.ts), so a breakdown always accounts for every
-- row. The column stays nullable; nothing is backfilled.

ALTER TYPE resource_location_enum ADD VALUE IF NOT EXISTS 'unspecified';

COMMENT ON COLUMN resources.resource_location IS
  'Broad location category: onshore (e.g. UK), nearshore (e.g. Poland), offshore (e.g. India), or unspecified when not yet decided.';
