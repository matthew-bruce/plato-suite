-- Controlled-write path for setting a platform's blended day rate.
--
-- cost_configurations was deliberately excluded from the dev-phase open-write
-- policy (migration 018) — alongside users and supplier_rate_cards — and it has
-- FORCE ROW LEVEL SECURITY on, so even the table owner is subject to its
-- policies. The app talks to Postgres as the `anon` role (no INSERT policy on
-- this table), so a direct client-side INSERT is refused by RLS.
--
-- This function is the single sanctioned write path. It is SECURITY DEFINER and
-- owned by `postgres`, which carries the BYPASSRLS attribute; a BYPASSRLS role
-- bypasses row security unconditionally, even under FORCE ROW LEVEL SECURITY.
-- The table's RLS policies themselves are left untouched — only the execution
-- context of this write changes. search_path is pinned per Supabase guidance.
--
-- INSERT-ONLY: always creates a new effective-dated row, never UPDATEs an
-- existing rate. VAT / on-costs uplifts are carried forward unchanged from the
-- platform's most recent live configuration. The (platform_id, effective_from)
-- partial unique index (WHERE deleted_at IS NULL) prevents two live rows
-- sharing a date; a collision raises unique_violation (SQLSTATE 23505), which
-- the caller surfaces as a clear "rate already exists for this date" message.
CREATE OR REPLACE FUNCTION public.set_blended_rate(
  p_platform_id        uuid,
  p_effective_from     date,
  p_blended_rate_pence integer
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_vat       numeric;
  v_on_costs  numeric;
  v_id        uuid;
begin
  if p_platform_id is null then
    raise exception 'platform_id is required';
  end if;
  if p_effective_from is null then
    raise exception 'effective_from is required';
  end if;
  if p_blended_rate_pence is null or p_blended_rate_pence < 0 then
    raise exception 'blended_rate_pence must be a non-negative integer';
  end if;

  -- Carry VAT / on-costs forward from the platform's most recent live config so
  -- those uplifts are unchanged — only the blended rate moves.
  select vat_uplift_percent, on_costs_uplift_percent
    into v_vat, v_on_costs
  from public.cost_configurations
  where platform_id = p_platform_id
    and deleted_at is null
  order by effective_from desc
  limit 1;

  insert into public.cost_configurations (
    platform_id,
    effective_from,
    blended_day_rate_override,
    vat_uplift_percent,
    on_costs_uplift_percent
  ) values (
    p_platform_id,
    p_effective_from,
    p_blended_rate_pence,
    coalesce(v_vat, 0),
    coalesce(v_on_costs, 0)
  )
  returning cost_configuration_id into v_id;

  return v_id;
end;
$$;
