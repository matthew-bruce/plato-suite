-- Add a short abbreviation to platforms, mirroring suppliers.supplier_abbreviation
-- alongside supplier_name. Used by the Blended Rates page filter pills (WEB,
-- APP, BIG, EPS, ETP, PDA). Nullable — same pattern as the supplier column.

ALTER TABLE platforms
  ADD COLUMN IF NOT EXISTS platform_abbreviation TEXT;

-- Seed the six existing platforms. Keyed on platform_code (stable) so this is
-- safe to re-run and independent of generated platform_id values.
UPDATE platforms SET platform_abbreviation = 'WEB' WHERE platform_code = 'WEB';
UPDATE platforms SET platform_abbreviation = 'APP' WHERE platform_code = 'APP';
UPDATE platforms SET platform_abbreviation = 'BIG' WHERE platform_code = 'BIG';
UPDATE platforms SET platform_abbreviation = 'EPS' WHERE platform_code = 'EPS';
UPDATE platforms SET platform_abbreviation = 'ETP' WHERE platform_code = 'ETP';
UPDATE platforms SET platform_abbreviation = 'PDA' WHERE platform_code = 'PDA';
