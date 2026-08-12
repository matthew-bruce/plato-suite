-- Documents the resource_period_allocation_monthly_days table.
--
-- RETROACTIVE: this table already exists on the live database — it was
-- applied out of band while the Schedule monthly day-breakdown was being
-- built. This file exists so the repo's migration history matches the
-- deployed schema; it is written idempotently and is a no-op against the
-- current database. See the ordering caveat in 030 — the RPCs in 029 operate
-- on this table, so on a fresh database this file must be applied first.
--
-- Purpose: optional per-calendar-month breakdown of an allocation's days.
-- resource_period_allocations.capacity_days remains the single authoritative
-- total that every cost calculation reads; rows here are a data-entry aid.
-- The invariant — enforced in one transaction by set_allocation_monthly_days
-- (migration 029), never by the client — is:
--
--   when any monthly row exists for an allocation,
--   capacity_days = SUM(resource_period_allocation_monthly_days.days)
--
-- An allocation with no rows here is in "manual total" mode: capacity_days is
-- typed directly and no breakdown exists.

CREATE TABLE IF NOT EXISTS public.resource_period_allocation_monthly_days (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id    UUID        NOT NULL
                     REFERENCES public.resource_period_allocations(allocation_id),
  month_start_date DATE        NOT NULL,
  days             NUMERIC     NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One row per allocation per month; this is the upsert conflict target
  -- used by set_allocation_monthly_days.
  UNIQUE (allocation_id, month_start_date)
);

COMMENT ON TABLE public.resource_period_allocation_monthly_days IS
  'Optional per-month breakdown of an allocation''s days. capacity_days on '
  'the parent row stays authoritative and is kept equal to SUM(days) by the '
  'set_allocation_monthly_days RPC.';

ALTER TABLE public.resource_period_allocation_monthly_days
  ENABLE ROW LEVEL SECURITY;

-- Mirrors the parent table's superuser-only write access.
DROP POLICY IF EXISTS resource_period_allocation_monthly_days_superuser_access
  ON public.resource_period_allocation_monthly_days;
CREATE POLICY resource_period_allocation_monthly_days_superuser_access
  ON public.resource_period_allocation_monthly_days
  FOR ALL
  USING (plato_is_superuser())
  WITH CHECK (plato_is_superuser());
