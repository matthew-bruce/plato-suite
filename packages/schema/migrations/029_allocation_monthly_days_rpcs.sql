-- Atomic writes for the Schedule page's optional monthly day breakdown.
--
-- resource_period_allocations.capacity_days stays the single authoritative
-- total that every cost calculation (BASE, blended rate, recovery variance)
-- reads. resource_period_allocation_monthly_days is a data-entry aid layered
-- on top. The invariant these functions exist to enforce is:
--
--   when any monthly row exists for an allocation,
--   capacity_days = SUM(resource_period_allocation_monthly_days.days)
--
-- Doing that as two client round trips (upsert the month, then update
-- capacity_days) would leave the total silently disagreeing with its own
-- breakdown whenever the second write failed — the same class of bug
-- migration 028 removed from assignResourceToAllocation. So both writes live
-- in one plpgsql function, one transaction.
--
-- Mirrors 028's conventions: plain (not SECURITY DEFINER) so the caller's RLS
-- still applies — both tables are gated on plato_is_superuser() — and real
-- exceptions are raised rather than swallowed.

-- Upsert a set of months and re-sync capacity_days to the new sum.
--
-- Takes arrays so a single-field edit (one month) and the "Populate working
-- days" button (every month at once) share one code path and one round trip.
-- A NULL entry in p_days means "clear this month", deleting its row — that is
-- how blanking an individual month input is expressed.
--
-- Returns the recomputed capacity_days so the client can reconcile its
-- optimistic state against what actually landed.
CREATE OR REPLACE FUNCTION public.set_allocation_monthly_days(
  p_allocation_id uuid,
  p_months        date[],
  p_days          numeric[]
) RETURNS numeric
LANGUAGE plpgsql
AS $$
declare
  v_exists  boolean;
  v_total   numeric;
  v_idx     int;
begin
  if p_months is null or p_days is null then
    raise exception 'months and days arrays are required';
  end if;

  if array_length(p_months, 1) is distinct from array_length(p_days, 1) then
    raise exception 'months and days arrays must be the same length';
  end if;

  select true into v_exists
  from public.resource_period_allocations
  where allocation_id = p_allocation_id
    and deleted_at is null;

  if not found then
    raise exception 'Allocation not found';
  end if;

  for v_idx in 1 .. coalesce(array_length(p_months, 1), 0) loop
    if p_days[v_idx] is null then
      delete from public.resource_period_allocation_monthly_days
      where allocation_id = p_allocation_id
        and month_start_date = p_months[v_idx];
    else
      if p_days[v_idx] < 0 then
        raise exception 'Monthly days cannot be negative (% for %)', p_days[v_idx], p_months[v_idx];
      end if;

      insert into public.resource_period_allocation_monthly_days
        (allocation_id, month_start_date, days)
      values
        (p_allocation_id, p_months[v_idx], p_days[v_idx])
      on conflict (allocation_id, month_start_date) do update
        set days = excluded.days,
            updated_at = now();
    end if;
  end loop;

  -- Re-sync the authoritative total from whatever rows now remain. When the
  -- last monthly row has just been cleared this lands on 0, which is the
  -- correct sum of an empty breakdown and hands the total back to manual
  -- entry on the client.
  select coalesce(sum(days), 0) into v_total
  from public.resource_period_allocation_monthly_days
  where allocation_id = p_allocation_id;

  update public.resource_period_allocations
  set capacity_days = v_total,
      updated_at = now()
  where allocation_id = p_allocation_id
    and deleted_at is null;

  return v_total;
end;
$$;

-- Drop the whole breakdown for an allocation, returning the total to manual
-- entry. capacity_days is deliberately left at its current value: the figure
-- on screen stays put, and the user is now free to overwrite it directly.
-- This backs the "x" clear button next to a locked total.
CREATE OR REPLACE FUNCTION public.clear_allocation_monthly_days(
  p_allocation_id uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
begin
  delete from public.resource_period_allocation_monthly_days
  where allocation_id = p_allocation_id;
end;
$$;
