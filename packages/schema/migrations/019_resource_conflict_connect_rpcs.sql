-- Same-period conflict resolution for the Add Role/Resource wizard.
--
-- When an already-recognised resource is connected to an allocation while it
-- already holds another active allocation in the same period, the wizard
-- offers to merge the two records. Each "Connect and…" choice must be a single
-- atomic operation so a partial failure can never leave one row soft-deleted
-- and the other half-written. These mirror the update_team_assignments (017)
-- pattern: one plpgsql function per choice, all writes in one transaction.

-- "Connect and keep existing details": the resource's existing standalone
-- allocation row is kept untouched (its rate / role / capacity stand). The
-- vacant seat's team assignment(s) are re-keyed onto the resource, and the
-- vacant seat's own allocation row is soft-deleted.
CREATE OR REPLACE FUNCTION public.connect_resource_keep_existing(
  p_resource_id         uuid,
  p_period_id           uuid,
  p_vacant_allocation_id uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
begin
  -- Drop any of the resource's existing active team rows whose team also sits
  -- on the vacant seat, so re-keying below can't hit the partial unique index
  -- (resource_id, team_id, period_id) WHERE deleted_at IS NULL.
  update public.resource_team_assignments
  set deleted_at = now()
  where resource_id = p_resource_id
    and period_id = p_period_id
    and deleted_at is null
    and team_id in (
      select team_id
      from public.resource_team_assignments
      where allocation_id = p_vacant_allocation_id
        and resource_id is null
        and deleted_at is null
    );

  -- Re-key the vacant seat's TBC team assignments onto the existing resource.
  update public.resource_team_assignments
  set resource_id = p_resource_id,
      allocation_id = null
  where allocation_id = p_vacant_allocation_id
    and resource_id is null
    and deleted_at is null;

  -- Soft-delete the now-superseded vacant seat allocation row.
  update public.resource_period_allocations
  set deleted_at = now(),
      updated_at = now()
  where allocation_id = p_vacant_allocation_id
    and deleted_at is null;
end;
$$;

-- "Connect and use vacant seat details": the vacant seat wins. The resource is
-- assigned into the vacant seat (its role / capacity / rate stand) and the
-- resource's previous standalone allocation row — plus the team assignments
-- tied to it — is soft-deleted.
CREATE OR REPLACE FUNCTION public.connect_resource_use_vacant(
  p_resource_id              uuid,
  p_period_id                uuid,
  p_vacant_allocation_id     uuid,
  p_superseded_allocation_id uuid,
  p_resource_location        text
) RETURNS void
LANGUAGE plpgsql
AS $$
begin
  -- Clean up the resource's existing standalone team assignments (tied to the
  -- now-superseded row) before the vacant seat's team rows are re-keyed onto
  -- the resource, so we never collide on the named partial unique index.
  update public.resource_team_assignments
  set deleted_at = now()
  where resource_id = p_resource_id
    and period_id = p_period_id
    and deleted_at is null;

  -- Soft-delete the resource's previous standalone allocation row.
  update public.resource_period_allocations
  set deleted_at = now(),
      updated_at = now()
  where allocation_id = p_superseded_allocation_id
    and deleted_at is null;

  -- Fill the vacant seat with the resource (normal fill-vacant-seat action).
  update public.resource_period_allocations
  set resource_id = p_resource_id,
      resource_location = coalesce(p_resource_location, resource_location),
      updated_at = now()
  where allocation_id = p_vacant_allocation_id
    and deleted_at is null;

  -- Carry the vacant seat's TBC team assignments over to the resource.
  update public.resource_team_assignments
  set resource_id = p_resource_id,
      allocation_id = null
  where allocation_id = p_vacant_allocation_id
    and resource_id is null
    and deleted_at is null;
end;
$$;
