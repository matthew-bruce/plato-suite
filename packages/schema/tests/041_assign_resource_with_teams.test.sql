-- Test for migration 041: assign_resource_to_vacant_allocation_with_teams.
--
-- Run against a Supabase BRANCH or local stack with 041 (and 040) applied —
-- never production. Everything runs inside one transaction that is rolled
-- back at the end, and each scenario additionally runs in its own
-- sub-transaction that is undone before the next, so every scenario starts
-- from the same vacant role. Fixtures are existing rows (one vacant role, one
-- person, two teams), so nothing depends on column defaults.
--
-- Pass: NOTICE 'PASS: …' lines and no exception. Fail: an exception 'FAIL: …'.
--
--   psql "$BRANCH_DB_URL" -v ON_ERROR_STOP=1 -f packages/schema/tests/041_assign_resource_with_teams.test.sql

BEGIN;

DO $test$
declare
  v_role     uuid;
  v_period   uuid;
  v_person   uuid;
  v_filled   uuid;
  v_team_a   uuid;
  v_team_b   uuid;
  v_count    int;
  v_state    text;
  v_message  text;
  v_resource uuid;

  -- Runs inside each scenario's sub-transaction, after its assertions, so the
  -- scenario's writes are undone. Any other exception is a real failure.
  c_done constant text := 'scenario-done';
begin
  -- Fixtures ---------------------------------------------------------------
  select a.allocation_id, a.period_id into v_role, v_period
    from public.resource_period_allocations a
   where a.resource_id is null and a.deleted_at is null
   limit 1;
  if v_role is null then raise exception 'FAIL: fixture — no vacant role'; end if;

  select a.allocation_id into v_filled
    from public.resource_period_allocations a
   where a.resource_id is not null and a.deleted_at is null
   limit 1;
  if v_filled is null then raise exception 'FAIL: fixture — no filled role'; end if;

  select r.resource_id into v_person
    from public.resources r
   where r.deleted_at is null
   limit 1;
  if v_person is null then raise exception 'FAIL: fixture — no person'; end if;

  select t.team_id into v_team_a from public.teams t where t.deleted_at is null order by t.team_id limit 1;
  select t.team_id into v_team_b from public.teams t where t.deleted_at is null and t.team_id <> v_team_a order by t.team_id limit 1;
  if v_team_a is null or v_team_b is null then raise exception 'FAIL: fixture — need two teams'; end if;

  -- Common starting state for every scenario (undone with the transaction):
  -- the vacant role has team A at 100%; the person has no team rows in the
  -- role's period.
  update public.resource_team_assignments set deleted_at = now()
   where resource_id = v_person and period_id = v_period and deleted_at is null;
  perform public.update_team_assignments(
    null, v_period, v_role,
    jsonb_build_array(jsonb_build_object('team_id', v_team_a, 'capacity_split', 100))
  );

  -- 1. A filled role raises RFILL with the plain-English message ----------
  begin
    perform public.assign_resource_to_vacant_allocation_with_teams(v_filled, v_person, v_period);
    raise exception 'FAIL: a filled role did not raise';
  exception when others then
    v_state := sqlstate; v_message := sqlerrm;
    if v_message like 'FAIL:%' then raise; end if;
  end;
  if v_state <> 'RFILL' then
    raise exception 'FAIL: filled role raised % (%), expected RFILL', v_state, v_message;
  end if;
  if v_message <> 'This role already has a person assigned. Edit the person''s team assignments instead.' then
    raise exception 'FAIL: filled role message: %', v_message;
  end if;
  raise notice 'PASS: a filled role raises RFILL';

  -- 2. A missing role raises a plain "could not be found" -----------------
  begin
    perform public.assign_resource_to_vacant_allocation_with_teams(gen_random_uuid(), v_person, v_period);
    raise exception 'FAIL: a missing role did not raise';
  exception when others then
    v_message := sqlerrm;
    if v_message like 'FAIL:%' then raise; end if;
  end;
  if v_message not like 'This role could not be found%' then
    raise exception 'FAIL: missing role message: %', v_message;
  end if;
  raise notice 'PASS: a missing role raises "could not be found"';

  -- 3. NULL assignments: behaves like 028 — the role's teams move across --
  begin
    perform public.assign_resource_to_vacant_allocation_with_teams(v_role, v_person, v_period, null, null);

    select resource_id into v_resource from public.resource_period_allocations where allocation_id = v_role;
    if v_resource is distinct from v_person then raise exception 'FAIL: NULL path did not assign the person'; end if;

    select count(*) into v_count from public.resource_team_assignments
     where resource_id = v_person and period_id = v_period and team_id = v_team_a
       and capacity_split = 1 and allocation_id is null and deleted_at is null;
    if v_count <> 1 then raise exception 'FAIL: NULL path did not move the role''s team onto the person'; end if;

    select count(*) into v_count from public.resource_team_assignments
     where allocation_id = v_role and resource_id is null and deleted_at is null;
    if v_count <> 0 then raise exception 'FAIL: NULL path left a row keyed to the role'; end if;

    raise exception using message = c_done;
  exception when others then
    if sqlerrm <> c_done then raise; end if;
  end;
  raise notice 'PASS: NULL assignments move the role''s teams onto the person';

  -- 4. [] : no team — role rows dropped, person rows removed, none added --
  begin
    -- Give the person a team of their own in the period first.
    perform public.update_team_assignments(
      v_person, v_period, null,
      jsonb_build_array(jsonb_build_object('team_id', v_team_b, 'capacity_split', 100))
    );
    perform public.assign_resource_to_vacant_allocation_with_teams(v_role, v_person, v_period, null, '[]'::jsonb);

    select count(*) into v_count from public.resource_team_assignments
     where resource_id = v_person and period_id = v_period and deleted_at is null;
    if v_count <> 0 then raise exception 'FAIL: [] left % team rows on the person', v_count; end if;

    select count(*) into v_count from public.resource_team_assignments
     where allocation_id = v_role and deleted_at is null;
    if v_count <> 0 then raise exception 'FAIL: [] left the role''s own team row'; end if;

    raise exception using message = c_done;
  exception when others then
    if sqlerrm <> c_done then raise; end if;
  end;
  raise notice 'PASS: [] leaves the person with no team';

  -- 5. A selection replaces the person's rows exactly; role rows not moved -
  begin
    perform public.update_team_assignments(
      v_person, v_period, null,
      jsonb_build_array(jsonb_build_object('team_id', v_team_b, 'capacity_split', 100))
    );
    -- Confirmed: team A at 50% (the role's team, kept) and team B at 30%.
    perform public.assign_resource_to_vacant_allocation_with_teams(
      v_role, v_person, v_period, null,
      jsonb_build_array(
        jsonb_build_object('team_id', v_team_a, 'capacity_split', 50),
        jsonb_build_object('team_id', v_team_b, 'capacity_split', 30)
      )
    );

    select count(*) into v_count from public.resource_team_assignments
     where resource_id = v_person and period_id = v_period and deleted_at is null;
    if v_count <> 2 then raise exception 'FAIL: selection left % rows, expected 2', v_count; end if;

    select count(*) into v_count from public.resource_team_assignments
     where resource_id = v_person and period_id = v_period and deleted_at is null
       and ((team_id = v_team_a and capacity_split = 0.5) or (team_id = v_team_b and capacity_split = 0.3));
    if v_count <> 2 then raise exception 'FAIL: selection rows have the wrong teams or splits'; end if;

    -- The role's own row was soft-deleted, not moved (no row of it now has a person).
    select count(*) into v_count from public.resource_team_assignments
     where allocation_id = v_role and deleted_at is null;
    if v_count <> 0 then raise exception 'FAIL: the role''s own team row is still live'; end if;

    raise exception using message = c_done;
  exception when others then
    if sqlerrm <> c_done then raise; end if;
  end;
  raise notice 'PASS: a selection replaces the person''s teams exactly';

  -- 6. Invalid selections raise and change nothing -----------------------
  declare
    v_bad jsonb;
    v_cases jsonb[] := array[
      jsonb_build_array(jsonb_build_object('team_id', v_team_a, 'capacity_split', 0)),
      jsonb_build_array(jsonb_build_object('team_id', v_team_a, 'capacity_split', 101)),
      jsonb_build_array(
        jsonb_build_object('team_id', v_team_a, 'capacity_split', 60),
        jsonb_build_object('team_id', v_team_b, 'capacity_split', 50)
      ),
      jsonb_build_array(
        jsonb_build_object('team_id', v_team_a, 'capacity_split', 50),
        jsonb_build_object('team_id', v_team_a, 'capacity_split', 50)
      )
    ];
  begin
    foreach v_bad in array v_cases loop
      begin
        perform public.assign_resource_to_vacant_allocation_with_teams(v_role, v_person, v_period, null, v_bad);
        raise exception 'FAIL: invalid selection % did not raise', v_bad;
      exception when others then
        if sqlerrm like 'FAIL:%' then raise; end if;
      end;

      select resource_id into v_resource from public.resource_period_allocations where allocation_id = v_role;
      if v_resource is not null then raise exception 'FAIL: invalid selection % still assigned the person', v_bad; end if;

      select count(*) into v_count from public.resource_team_assignments
       where allocation_id = v_role and resource_id is null and team_id = v_team_a and deleted_at is null;
      if v_count <> 1 then raise exception 'FAIL: invalid selection % touched the role''s team row', v_bad; end if;
    end loop;
  end;
  raise notice 'PASS: split 0%%, split 101%%, total 110%% and a repeated team all raise and change nothing';
end
$test$;

ROLLBACK;
