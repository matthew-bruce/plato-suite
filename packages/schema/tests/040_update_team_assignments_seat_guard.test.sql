-- Test for migration 040: update_team_assignments refuses seat mode on an
-- assigned seat, and is unchanged for a vacant seat and for person mode.
--
-- Run against a Supabase BRANCH or local stack with 040 applied — never
-- production. Everything runs inside one transaction that is rolled back at
-- the end, so no data is left behind. It reads existing rows for fixtures
-- (one assigned seat, one vacant seat, one team) rather than inserting
-- allocations, so it does not depend on resource_period_allocations' column
-- defaults.
--
-- Pass: the script finishes with NOTICE 'PASS: ...' lines and no exception.
-- Fail: it raises 'FAIL: ...'.
--
--   psql "$BRANCH_DB_URL" -v ON_ERROR_STOP=1 -f packages/schema/tests/040_update_team_assignments_seat_guard.test.sql

BEGIN;

DO $test$
declare
  v_assigned_seat    uuid;
  v_assigned_period  uuid;
  v_assigned_person  uuid;
  v_vacant_seat      uuid;
  v_vacant_period    uuid;
  v_team             uuid;
  v_raised           boolean := false;
  v_message          text;
  v_count            int;
  v_seat_rows_before int;
begin
  -- Fixtures ---------------------------------------------------------------
  select a.allocation_id, a.period_id, a.resource_id
    into v_assigned_seat, v_assigned_period, v_assigned_person
    from public.resource_period_allocations a
   where a.resource_id is not null and a.deleted_at is null
   limit 1;
  if v_assigned_seat is null then
    raise exception 'FAIL: fixture — no assigned allocation to test against';
  end if;

  select a.allocation_id, a.period_id
    into v_vacant_seat, v_vacant_period
    from public.resource_period_allocations a
   where a.resource_id is null and a.deleted_at is null
   limit 1;
  if v_vacant_seat is null then
    raise exception 'FAIL: fixture — no vacant allocation to test against';
  end if;

  select t.team_id into v_team
    from public.teams t
   where t.deleted_at is null
   limit 1;
  if v_team is null then
    raise exception 'FAIL: fixture — no team to test against';
  end if;

  -- 1. Seat mode on an ASSIGNED seat raises, and writes nothing ------------
  select count(*) into v_seat_rows_before
    from public.resource_team_assignments
   where allocation_id = v_assigned_seat and deleted_at is null;

  begin
    perform public.update_team_assignments(
      null, v_assigned_period, v_assigned_seat,
      jsonb_build_array(jsonb_build_object('team_id', v_team, 'capacity_split', 100))
    );
  exception when others then
    v_raised := true;
    v_message := sqlerrm;
  end;

  if not v_raised then
    raise exception 'FAIL: seat mode on an assigned seat did not raise';
  end if;
  if v_message not like '%already has a resource assigned%' then
    raise exception 'FAIL: raised the wrong error: %', v_message;
  end if;

  select count(*) into v_count
    from public.resource_team_assignments
   where allocation_id = v_assigned_seat and deleted_at is null;
  if v_count <> v_seat_rows_before then
    raise exception 'FAIL: seat rows on the assigned seat changed (% -> %)', v_seat_rows_before, v_count;
  end if;
  raise notice 'PASS: seat mode on an assigned seat raises and writes nothing';

  -- 2. Seat mode on a VACANT seat behaves as before ------------------------
  perform public.update_team_assignments(
    null, v_vacant_period, v_vacant_seat,
    jsonb_build_array(jsonb_build_object('team_id', v_team, 'capacity_split', 100))
  );

  select count(*) into v_count
    from public.resource_team_assignments
   where allocation_id = v_vacant_seat
     and resource_id is null
     and deleted_at is null;
  if v_count <> 1 then
    raise exception 'FAIL: vacant seat should hold exactly 1 seat-keyed row, has %', v_count;
  end if;

  select count(*) into v_count
    from public.resource_team_assignments
   where allocation_id = v_vacant_seat
     and resource_id is null
     and deleted_at is null
     and team_id = v_team
     and capacity_split = 1;
  if v_count <> 1 then
    raise exception 'FAIL: vacant seat row has the wrong team or split';
  end if;
  raise notice 'PASS: seat mode on a vacant seat replaces its rows as before';

  -- 3. Person mode is untouched by the guard -------------------------------
  perform public.update_team_assignments(
    v_assigned_person, v_assigned_period, null,
    jsonb_build_array(jsonb_build_object('team_id', v_team, 'capacity_split', 100))
  );

  select count(*) into v_count
    from public.resource_team_assignments
   where resource_id = v_assigned_person
     and period_id = v_assigned_period
     and deleted_at is null;
  if v_count <> 1 then
    raise exception 'FAIL: person mode should leave exactly 1 row, has %', v_count;
  end if;
  raise notice 'PASS: person mode still replaces the person''s rows';
end
$test$;

ROLLBACK;
