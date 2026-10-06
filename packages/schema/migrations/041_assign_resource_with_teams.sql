-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.assign_resource_to_vacant_allocation_with_teams(uuid, uuid, uuid, text, jsonb);
-- Nothing else needs undoing: this migration only ADDS a function.
-- assign_resource_to_vacant_allocation (028 / 028b) is untouched, so code that
-- still calls it keeps working until the new code is deployed.
--
-- One atomic "put this person into this vacant role, with these teams".
--
-- Until now the assign wizard did this in up to three separate saves for a
-- person who already had teams this period: clear the role's own team rows,
-- assign the person (assign_resource_to_vacant_allocation), then replace the
-- person's team rows with the confirmed selection (update_team_assignments).
-- A failure between them left a half-done state — and putting the role's rows
-- back afterwards was a fourth save that could fail too. This function does
-- the whole thing in one transaction: any failure changes nothing.
--
-- p_assignments:
--   NULL  → the person had no teams this period. Behave exactly like 028: the
--           role's own team rows move onto the person, so the role's teams
--           become theirs.
--   array → the person already had teams, and the user confirmed this exact
--           selection. The role's own team rows are soft-deleted (NOT moved —
--           anything the user kept from them is already in the selection),
--           then the person's team rows for p_period_id are replaced with it.
--           [] means "no team": the person's rows for the period are removed
--           and none inserted.
--   Each element is { team_id, capacity_split }, capacity_split a percentage
--   (the same payload update_team_assignments takes), stored divided by 100.
--
-- Errors are plain English because they can reach a user; the Schedule calls
-- these rows "roles". "Role already filled" carries SQLSTATE RFILL, the same
-- code and message as migration 040, so the page detects it by code.
--
-- The engagement link (resource_period_allocations.engagement_id) is set by
-- the resource_period_allocations_set_engagement trigger (migration 037) on
-- the resource_id update below, exactly as for 028.

CREATE OR REPLACE FUNCTION public.assign_resource_to_vacant_allocation_with_teams(
  p_allocation_id     uuid,
  p_resource_id       uuid,
  p_period_id         uuid,
  p_resource_location text  DEFAULT NULL,
  p_assignments       jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $function$
declare
  v_existing_resource uuid;
  v_role_period       uuid;
  v_elem              jsonb;
  v_split             numeric;
  v_total             numeric := 0;
  v_count             int := 0;
  v_distinct          int := 0;
begin
  -- a. Lock the role so nothing can fill it between this check and the update.
  select a.resource_id, a.period_id
    into v_existing_resource, v_role_period
    from public.resource_period_allocations a
   where a.allocation_id = p_allocation_id
     and a.deleted_at is null
     for update;

  if not found then
    raise exception 'This role could not be found. It may have been removed. Reload the page to see the latest.'
      using errcode = 'P0002';
  end if;

  if v_existing_resource is not null then
    raise exception
      'This role already has a person assigned. Edit the person''s team assignments instead.'
      using errcode = 'RFILL',
            detail  = format('allocation_id=%s resource_id=%s', p_allocation_id, v_existing_resource);
  end if;

  if p_period_id is distinct from v_role_period then
    raise exception 'This role belongs to a different period. Reload the page to see the latest.';
  end if;

  -- e. Validate the selection before writing anything.
  if p_assignments is not null then
    if jsonb_typeof(p_assignments) <> 'array' then
      raise exception 'The team selection could not be read. Please try again.';
    end if;

    for v_elem in select value from jsonb_array_elements(p_assignments) loop
      if (v_elem->>'team_id') is null then
        raise exception 'A team in the selection has no team chosen.';
      end if;
      v_split := (v_elem->>'capacity_split')::numeric;
      if v_split is null or v_split <= 0 or v_split > 100 then
        raise exception 'Each team''s split must be more than 0%% and no more than 100%%.';
      end if;
      v_total := v_total + v_split;
      v_count := v_count + 1;
    end loop;

    if v_total > 100 then
      raise exception 'Team splits can''t add up to more than 100%% (got %).', v_total || '%';
    end if;

    select count(distinct (value->>'team_id'))
      into v_distinct
      from jsonb_array_elements(p_assignments);
    if v_distinct <> v_count then
      raise exception 'The same team is listed more than once.';
    end if;
  end if;

  -- b. Put the person into the role (location as 028b does).
  update public.resource_period_allocations
     set resource_id       = p_resource_id,
         resource_location = coalesce(p_resource_location::resource_location_enum, resource_location),
         updated_at        = now()
   where allocation_id = p_allocation_id;

  if p_assignments is null then
    -- c. Person with no teams: the role's teams become theirs (as 028).
    update public.resource_team_assignments
       set resource_id   = p_resource_id,
           allocation_id = null
     where allocation_id = p_allocation_id
       and resource_id is null
       and deleted_at is null;
  else
    -- d. Person with teams: drop the role's own rows, then replace the
    --    person's rows for the period with the confirmed selection.
    update public.resource_team_assignments
       set deleted_at = now()
     where allocation_id = p_allocation_id
       and resource_id is null
       and deleted_at is null;

    update public.resource_team_assignments
       set deleted_at = now()
     where resource_id = p_resource_id
       and period_id = p_period_id
       and deleted_at is null;

    insert into public.resource_team_assignments (resource_id, team_id, period_id, capacity_split)
    select
      p_resource_id,
      (elem->>'team_id')::uuid,
      p_period_id,
      (elem->>'capacity_split')::numeric / 100
    from jsonb_array_elements(p_assignments) as elem;
  end if;
end;
$function$;
