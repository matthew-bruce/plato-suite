-- 038_engagement_no_overlap.sql
-- Already applied live to nwltpivvqynkfghazjpi on 30 Sep 2026. Recorded for history, do not re-run.

create extension if not exists btree_gist;

alter table public.resource_engagements
  add constraint resource_engagements_no_overlap
  exclude using gist (resource_id with =, daterange(roll_on_date, roll_off_date, '[]') with &&)
  where (deleted_at is null);

create or replace function public.plato_allocation_set_engagement()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_ps date;
  v_pe date;
  v_roll_on date;
begin
  if new.resource_id is null or new.supplier_id is null then
    new.engagement_id := null;
    return new;
  end if;

  new.engagement_id := plato_resolve_engagement(new.resource_id, new.supplier_id, new.period_id);
  if new.engagement_id is not null then
    return new;
  end if;

  select period_start_date, period_end_date into v_ps, v_pe
  from periods where period_id = new.period_id;

  -- Estimated roll-on starts after any engagement this person closed before period end
  select greatest(v_ps, max(e.roll_off_date) + 1) into v_roll_on
  from resource_engagements e
  where e.resource_id = new.resource_id
    and e.deleted_at is null
    and e.roll_off_date is not null
    and e.roll_off_date < v_pe;

  -- Never block a schedule write: on overlap, leave engagement_id null (surfaced as a data issue)
  begin
    insert into resource_engagements (resource_id, supplier_id, roll_on_date, roll_on_estimated)
    values (new.resource_id, new.supplier_id, v_roll_on, true)
    returning engagement_id into new.engagement_id;
  exception when exclusion_violation then
    new.engagement_id := null;
  end;

  return new;
end
$function$;
