-- =============================================================================
-- 002_resource_location_and_job_title.sql
-- Adds location, country, and job title display fields to resources.
-- Part of @plato/schema. Applied to Nucleus project 22 Apr 2025.
-- =============================================================================

CREATE TYPE resource_location_enum AS ENUM ('onshore', 'nearshore', 'offshore');

ALTER TABLE resources
  ADD COLUMN resource_location  resource_location_enum NULL,
  ADD COLUMN resource_country   TEXT NULL,
  ADD COLUMN resource_job_title TEXT NULL;

COMMENT ON COLUMN resources.resource_location IS 'Broad location category: onshore (e.g. UK), nearshore (e.g. Poland), offshore (e.g. India).';
COMMENT ON COLUMN resources.resource_country IS 'Country of residence. Free text, not normalised.';
COMMENT ON COLUMN resources.resource_job_title IS 'External job title / display label. Not an org chart position — see roles table.';
