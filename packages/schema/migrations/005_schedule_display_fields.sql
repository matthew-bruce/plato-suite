-- 005_schedule_display_fields.sql
-- Adds role_title and planview_code snapshot columns to resource_period_allocations.
-- See ADR-013 (temporal modelling) for rationale on denormalisation.

ALTER TABLE resource_period_allocations
  ADD COLUMN IF NOT EXISTS role_title    TEXT,
  ADD COLUMN IF NOT EXISTS planview_code TEXT
    CHECK (planview_code IN ('PR', 'F_Gov', 'BAU', 'ETP'));

COMMENT ON COLUMN resource_period_allocations.role_title IS
  'Role title snapshotted at allocation time. Denormalised per ADR-013.';

COMMENT ON COLUMN resource_period_allocations.planview_code IS
  'Planview funding bucket: PR = Platform Request (time-recoverable via PR tickets), '
  'F_Gov = Factory Governance (overhead, blended into rate), '
  'BAU = Business As Usual (not borne by platform), '
  'ETP = Enterprise Tooling Platform cost line.';
