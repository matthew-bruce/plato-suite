-- Atomic fill-vacant-seat for assignResourceToAllocation() (schedule.ts).
--
-- Replaces two separate, non-transactional client-side writes — an UPDATE to
-- resource_period_allocations.resource_id followed by a "best-effort" UPDATE
-- re-keying the vacant seat's resource_team_assignments row, with the second
-- write's failure swallowed (console.error only, still returned success).
-- Confirmed via the 2026-07-23 investigation docs
-- (docs/investigations/2026-07-23-assignResource-silent-failure-challenge.md)
-- as a genuine latent bug: a re-key failure (e.g. a unique-index collision on
-- rta_named_unique) could leave the allocation named while its team
-- assignment row stayed stranded on the vacant seat — exactly the
-- "cost row filled, team-assignment row still vacant" shape found in that
-- audit (though that specific historical data was traced to direct DB edits,
-- not this code path).
--
-- Mirrors the connect_resource_keep_existing / connect_resource_use_vacant
-- pattern (migration 019): one plpgsql function, all writes in one
-- transaction, a real error raised (and surfaced to the caller) rather than
-- swallowed.
--
-- Distinct from the 019 RPCs: those handle the same-period CONFLICT case,
-- where the resource already holds another active allocation that must be
-- merged into or superseded by the vacant seat. This RPC is the plain case —
-- findResourcePeriodConflicts has already confirmed the resource holds no
-- other active allocation in this period, so there is nothing to reconcile
-- beyond the vacant seat's own team assignments.

CREATE OR REPLACE FUNCTION public.assign_resource_to_vacant_allocation(
  p_allocation_id     uuid,
  p_resource_id       uuid,
  p_resource_location text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $$
declare
  v_rows int;
begin
  update public.resource_period_allocations
  set resource_id = p_resource_id,
      resource_location = coalesce(p_resource_location, resource_location),
      updated_at = now()
  where allocation_id = p_allocation_id
    and deleted_at is null;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Allocation not found';
  end if;

  -- Re-key the vacant seat's TBC team assignments onto the resource, same
  -- transaction as the update above: if this fails (e.g. a unique-index
  -- collision on rta_named_unique), the whole function rolls back — the
  -- allocation is never left named with its team assignments stranded on
  -- the vacant seat.
  update public.resource_team_assignments
  set resource_id = p_resource_id,
      allocation_id = null
  where allocation_id = p_allocation_id
    and resource_id is null
    and deleted_at is null;
end;
$$;
