-- TBC allocation rows (resource_id IS NULL on resource_period_allocations) cannot
-- have team assignments today because resource_team_assignments.resource_id is
-- NOT NULL and is the only join key. Add allocation_id as an alternative key so
-- TBC rows can carry team assignments before a resource is assigned.

-- resource_id must become nullable: a TBC team assignment row keys on
-- allocation_id instead, with resource_id left NULL until a resource is assigned.
ALTER TABLE resource_team_assignments
  ALTER COLUMN resource_id DROP NOT NULL;

-- Nullable FK to the allocation row, used only for TBC (resource_id IS NULL) rows.
ALTER TABLE resource_team_assignments
  ADD COLUMN allocation_id UUID REFERENCES resource_period_allocations(allocation_id) ON DELETE CASCADE;

-- Replace the single unique constraint with two partial unique indexes, one per
-- join key, since a row now uses exactly one of resource_id or allocation_id.
ALTER TABLE resource_team_assignments
  DROP CONSTRAINT resource_team_assignments_resource_id_team_id_period_id_key;

CREATE UNIQUE INDEX rta_named_unique
  ON resource_team_assignments(resource_id, team_id, period_id)
  WHERE resource_id IS NOT NULL;

CREATE UNIQUE INDEX rta_tbc_unique
  ON resource_team_assignments(allocation_id, team_id)
  WHERE resource_id IS NULL AND allocation_id IS NOT NULL;
