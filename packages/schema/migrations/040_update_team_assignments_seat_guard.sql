-- Refuse seat-keyed team writes on a seat that already has a person.
--
-- update_team_assignments (migration 017) has two modes. Given an allocation
-- id it replaces a VACANT seat's team rows, keyed by allocation_id with
-- resource_id null. Given a resource id it replaces the PERSON's team rows
-- for the period. Nothing checked that the seat was actually vacant.
--
-- The Schedule page could call the seat mode on an assigned seat: after an
-- assign it kept the row's resource_id as null in its own state, so Edit
-- Teams ran in seat mode and wrote a seat-keyed row onto a seat that had a
-- person. The live DB on 2026-10-05 held 5 such rows (4 in Q3, 1 in Q2), 4 of
-- them duplicating a person-keyed row for the same team. Those rows are
-- invisible to every reader today, but period copy (migration 023) carries
-- them forward and they block unassignResourceFromAllocation's re-key on
-- rta_tbc_unique. The page is fixed separately; this is the server-side
-- guard against any caller holding stale state.
--
-- Change: in seat mode, lock the seat (SELECT ... FOR UPDATE) and raise if its
-- resource_id is set. The lock stops a concurrent assign from slipping in
-- between the check and the insert. Everything else is unchanged: a
-- genuinely vacant seat behaves exactly as before, as does the person mode.
-- A seat id that matches no allocation also behaves exactly as before (the
-- check only raises when a row exists and has a person).
--
-- Numbered 040: 039 (resource_engagements.email) was applied to the live DB
-- on 2026-10-05 without a file in this folder.
--
-- ROLLBACK — restore the previous definition (as live on 2026-10-05):
--
--   CREATE OR REPLACE FUNCTION public.update_team_assignments(
--     p_resource_id uuid, p_period_id uuid, p_allocation_id uuid, p_assignments jsonb
--   ) RETURNS void
--   LANGUAGE plpgsql
--   AS $function$
--   begin
--     if p_allocation_id is not null then
--       update public.resource_team_assignments
--       set deleted_at = now()
--       where allocation_id = p_allocation_id
--         and resource_id is null
--         and deleted_at is null;
--
--       insert into public.resource_team_assignments (allocation_id, resource_id, team_id, period_id, capacity_split)
--       select p_allocation_id, null, (elem->>'team_id')::uuid, p_period_id,
--              (elem->>'capacity_split')::numeric / 100
--       from jsonb_array_elements(p_assignments) as elem;
--     else
--       update public.resource_team_assignments
--       set deleted_at = now()
--       where resource_id = p_resource_id
--         and period_id = p_period_id
--         and deleted_at is null;
--
--       insert into public.resource_team_assignments (resource_id, team_id, period_id, capacity_split)
--       select p_resource_id, (elem->>'team_id')::uuid, p_period_id,
--              (elem->>'capacity_split')::numeric / 100
--       from jsonb_array_elements(p_assignments) as elem;
--     end if;
--   end;
--   $function$;

CREATE OR REPLACE FUNCTION public.update_team_assignments(
  p_resource_id   uuid,
  p_period_id     uuid,
  p_allocation_id uuid,
  p_assignments   jsonb
) RETURNS void
LANGUAGE plpgsql
AS $function$
declare
  v_seat_resource_id uuid;
begin
  if p_allocation_id is not null then
    -- Seat mode is for vacant seats only. Lock the seat so an assign cannot
    -- land between this check and the insert below.
    select a.resource_id
      into v_seat_resource_id
      from public.resource_period_allocations a
     where a.allocation_id = p_allocation_id
       for update;

    if v_seat_resource_id is not null then
      raise exception
        'Allocation % already has a resource assigned; edit its team assignments by resource, not by seat',
        p_allocation_id
        using errcode = 'P0001';
    end if;

    update public.resource_team_assignments
    set deleted_at = now()
    where allocation_id = p_allocation_id
      and resource_id is null
      and deleted_at is null;

    insert into public.resource_team_assignments (allocation_id, resource_id, team_id, period_id, capacity_split)
    select
      p_allocation_id,
      null,
      (elem->>'team_id')::uuid,
      p_period_id,
      (elem->>'capacity_split')::numeric / 100
    from jsonb_array_elements(p_assignments) as elem;
  else
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
