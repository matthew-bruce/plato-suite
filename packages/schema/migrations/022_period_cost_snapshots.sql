-- Frozen cost figures for locked periods.
--
-- Once a period is locked its Applied Blended Rate (and everything derived from
-- it) must stop tracking the live cost_configurations table — historic/active
-- figures can't be allowed to move when someone later edits a rate. We capture
-- the resolved figures at the instant of locking into this table, and the read
-- path serves a locked period from its snapshot instead of the live lookup.
--
-- periods is platform-agnostic but cost data is per-platform, so the snapshot is
-- keyed by (period_id, platform_id). One row per platform that has a resolvable
-- configuration at lock time; platforms with no effective config simply get no
-- row (which reads back as "no rate configured", exactly as the live lookup
-- would have returned at that instant).

CREATE TABLE IF NOT EXISTS public.period_cost_snapshots (
  snapshot_id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id                   uuid NOT NULL REFERENCES public.periods(period_id),
  platform_id                 uuid NOT NULL REFERENCES public.platforms(platform_id),
  -- Frozen resolved figures (same shape/units as cost_configurations).
  blended_day_rate_override   integer,           -- integer pence, may be null
  vat_uplift_percent          numeric NOT NULL DEFAULT 0,
  on_costs_uplift_percent     numeric NOT NULL DEFAULT 0,
  -- Provenance: the cost_configurations row this froze from, and its date.
  source_cost_configuration_id uuid REFERENCES public.cost_configurations(cost_configuration_id),
  effective_from              date,
  snapshotted_at              timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz
);

-- One live snapshot per (period, platform).
CREATE UNIQUE INDEX IF NOT EXISTS period_cost_snapshots_unique
  ON public.period_cost_snapshots (period_id, platform_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS period_cost_snapshots_period_idx
  ON public.period_cost_snapshots (period_id)
  WHERE deleted_at IS NULL;

-- RLS: open read for the dev phase (the app reads snapshots as anon). Writes
-- only ever happen through the SECURITY DEFINER functions below, so there is
-- deliberately no write policy — a direct anon write is refused.
ALTER TABLE public.period_cost_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Open read — dev phase (ADR-031)" ON public.period_cost_snapshots;
CREATE POLICY "Open read — dev phase (ADR-031)"
  ON public.period_cost_snapshots FOR SELECT USING (true);

-- ── Lock transition: snapshot on false → true ───────────────────────────────
-- Replaces the existing simple periods.locked update. On a false→true
-- transition it freezes the currently-resolved config for every platform
-- (latest effective_from on or before the period start) BEFORE flipping the
-- flag. Unlocking, or re-locking an already-locked period, never re-snapshots
-- except on a genuine fresh false→true transition (a prior cycle's snapshot is
-- superseded). SECURITY DEFINER so it can write the RLS-protected tables.
CREATE OR REPLACE FUNCTION public.set_period_locked(
  p_period_id uuid,
  p_locked    boolean
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_was_locked boolean;
  v_start      date;
begin
  select locked, period_start_date
    into v_was_locked, v_start
  from public.periods
  where period_id = p_period_id and deleted_at is null
  for update;

  if not found then
    raise exception 'period % not found', p_period_id;
  end if;

  if p_locked and not v_was_locked then
    -- Supersede any stale snapshot from a previous lock cycle.
    update public.period_cost_snapshots
      set deleted_at = now(), updated_at = now()
      where period_id = p_period_id and deleted_at is null;

    insert into public.period_cost_snapshots (
      period_id, platform_id, blended_day_rate_override,
      vat_uplift_percent, on_costs_uplift_percent,
      source_cost_configuration_id, effective_from
    )
    select p_period_id, eff.platform_id, eff.blended_day_rate_override,
           eff.vat_uplift_percent, eff.on_costs_uplift_percent,
           eff.cost_configuration_id, eff.effective_from
    from (
      select distinct on (platform_id)
        platform_id, cost_configuration_id, blended_day_rate_override,
        vat_uplift_percent, on_costs_uplift_percent, effective_from
      from public.cost_configurations
      where deleted_at is null and effective_from <= v_start
      order by platform_id, effective_from desc
    ) eff;
  end if;

  update public.periods
    set locked = p_locked, updated_at = now()
    where period_id = p_period_id;

  return p_locked;
end;
$$;

-- ── Row-level edit / soft-delete for the Rate History table ──────────────────
-- cost_configurations is RLS-locked (FORCE RLS, off the open-write policy), so
-- corrections go through these SECURITY DEFINER functions, mirroring
-- set_blended_rate. The (platform_id, effective_from) unique index still guards
-- against duplicate live dates; a collision raises 23505 for the caller.
CREATE OR REPLACE FUNCTION public.update_cost_configuration(
  p_cost_configuration_id uuid,
  p_effective_from        date,
  p_blended_rate_pence    integer,
  p_vat_uplift            numeric,
  p_on_costs_uplift       numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
begin
  update public.cost_configurations
    set effective_from          = coalesce(p_effective_from, effective_from),
        blended_day_rate_override = p_blended_rate_pence,
        vat_uplift_percent       = coalesce(p_vat_uplift, vat_uplift_percent),
        on_costs_uplift_percent  = coalesce(p_on_costs_uplift, on_costs_uplift_percent),
        updated_at               = now()
  where cost_configuration_id = p_cost_configuration_id
    and deleted_at is null;

  if not found then
    raise exception 'cost_configuration % not found', p_cost_configuration_id;
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_cost_configuration(
  p_cost_configuration_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
begin
  update public.cost_configurations
    set deleted_at = now(), updated_at = now()
  where cost_configuration_id = p_cost_configuration_id
    and deleted_at is null;

  if not found then
    raise exception 'cost_configuration % not found', p_cost_configuration_id;
  end if;
end;
$$;

-- ── Backfill: snapshot every period that is locked RIGHT NOW ─────────────────
-- Runs once, here, so Q4 FY25/26 and Q1 FY26/27 ship with a snapshot rather
-- than an empty one waiting on the next lock toggle. Uses the same resolution
-- rule as the live lookup, evaluated at each period's start date today.
INSERT INTO public.period_cost_snapshots (
  period_id, platform_id, blended_day_rate_override,
  vat_uplift_percent, on_costs_uplift_percent,
  source_cost_configuration_id, effective_from
)
SELECT pr.period_id, eff.platform_id, eff.blended_day_rate_override,
       eff.vat_uplift_percent, eff.on_costs_uplift_percent,
       eff.cost_configuration_id, eff.effective_from
FROM public.periods pr
CROSS JOIN LATERAL (
  SELECT DISTINCT ON (platform_id)
    platform_id, cost_configuration_id, blended_day_rate_override,
    vat_uplift_percent, on_costs_uplift_percent, effective_from
  FROM public.cost_configurations
  WHERE deleted_at IS NULL AND effective_from <= pr.period_start_date
  ORDER BY platform_id, effective_from DESC
) eff
WHERE pr.locked = true
  AND pr.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.period_cost_snapshots s
    WHERE s.period_id = pr.period_id
      AND s.platform_id = eff.platform_id
      AND s.deleted_at IS NULL
  );
