-- Atomic "Create New Period" for the Platform Schedule wizard.
--
-- Creates a fresh draft period and, optionally, copies a source period's
-- schedule forward as a starting basis. The period insert and the allocation /
-- team-assignment duplication must not be separate unguarded steps — a partial
-- failure would leave a half-populated period — so both happen inside this one
-- SECURITY DEFINER function (a single transaction), mirroring set_period_locked
-- and the connect RPCs.
--
-- What is copied when p_copy_from_period_id is provided:
--   * resource_period_allocations — every non-deleted row of the source period
--     (resource, supplier, role, rate, capacity, location, display order), with
--     fresh allocation_ids in the new period. These are ordinary editable draft
--     rows; nothing is locked.
--   * resource_team_assignments — carried forward so team splits survive. Rows
--     keyed by resource_id copy straight across (they re-associate with the new
--     allocation via resource_id + period_id); TBC rows keyed by allocation_id
--     are remapped to the newly-created allocation ids.
--
-- What is NOT copied: period_cost_snapshots. Those are frozen figures for
-- locked periods; a new draft resolves cost live and must never inherit a
-- previous quarter's frozen snapshot.

CREATE OR REPLACE FUNCTION public.create_period_with_optional_copy(
  p_period_name         text,
  p_start_date          date,
  p_end_date            date,
  p_copy_from_period_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_new_period_id uuid;
begin
  if p_period_name is null or btrim(p_period_name) = '' then
    raise exception 'period name is required';
  end if;
  if p_start_date is null or p_end_date is null then
    raise exception 'start and end dates are required';
  end if;
  if p_end_date < p_start_date then
    raise exception 'end date % is before start date %', p_end_date, p_start_date;
  end if;

  -- Fresh draft, never locked.
  insert into public.periods (period_name, period_start_date, period_end_date, period_status, locked)
  values (btrim(p_period_name), p_start_date, p_end_date, 'draft', false)
  returning period_id into v_new_period_id;

  if p_copy_from_period_id is not null then
    -- Duplicate allocations with pre-generated ids so the same mapping drives
    -- both the allocation insert and the TBC team-assignment remap below.
    with mapping as (
      select
        allocation_id                as old_id,
        gen_random_uuid()            as new_id,
        resource_id, role_id, day_rate, utilisation_percent, capacity_days,
        is_chargeable, role_title, planview_code, supplier_id, vat_applies,
        display_order, resource_location
      from public.resource_period_allocations
      where period_id = p_copy_from_period_id and deleted_at is null
    ),
    ins_alloc as (
      insert into public.resource_period_allocations (
        allocation_id, period_id, resource_id, role_id, day_rate, utilisation_percent,
        capacity_days, is_chargeable, role_title, planview_code, supplier_id,
        vat_applies, display_order, resource_location
      )
      select
        m.new_id, v_new_period_id, m.resource_id, m.role_id, m.day_rate, m.utilisation_percent,
        m.capacity_days, m.is_chargeable, m.role_title, m.planview_code, m.supplier_id,
        m.vat_applies, m.display_order, m.resource_location
      from mapping m
      returning 1
    )
    -- TBC team assignments (keyed by allocation_id, no resource yet) → remap to
    -- the corresponding new allocation.
    insert into public.resource_team_assignments (
      resource_id, team_id, period_id, capacity_split, is_primary, allocation_id
    )
    select rta.resource_id, rta.team_id, v_new_period_id, rta.capacity_split, rta.is_primary, m.new_id
    from public.resource_team_assignments rta
    join mapping m on m.old_id = rta.allocation_id
    where rta.period_id = p_copy_from_period_id
      and rta.deleted_at is null
      and rta.allocation_id is not null;

    -- Assigned-resource team assignments (keyed by resource_id) copy straight
    -- across; they re-associate with the copied allocation via resource_id.
    insert into public.resource_team_assignments (
      resource_id, team_id, period_id, capacity_split, is_primary
    )
    select rta.resource_id, rta.team_id, v_new_period_id, rta.capacity_split, rta.is_primary
    from public.resource_team_assignments rta
    where rta.period_id = p_copy_from_period_id
      and rta.deleted_at is null
      and rta.allocation_id is null
      and rta.resource_id is not null;
  end if;

  return v_new_period_id;
end;
$$;

-- Match the grant surface of the other schedule/rate RPCs (called from server
-- actions using the anon key).
GRANT EXECUTE ON FUNCTION public.create_period_with_optional_copy(text, date, date, uuid)
  TO anon, authenticated, service_role;
