-- Creates public.resource_supplier_transitions.
--
-- Purpose: records a resource's move between suppliers — principally the
-- Capgemini → TCS ("Dudley") transition running across Q2/Q3 FY26/27. One row
-- per resource per move. Read by the Resource Timeline view, which uses it to
-- clip supplier coverage bars to real contractual boundaries rather than to
-- calendar quarter edges.
--
-- The three dates are deliberately distinct and are NOT interchangeable:
--
--   last_working_day  last day at from_supplier. Clips the outgoing bar.
--   joining_date      first day on to_supplier's books (DOJ). INFORMATIONAL
--                     ONLY — it is recorded for the transition record and must
--                     never set a timeline bar's start or end. A person can be
--                     on TCS's payroll days or weeks before any billable cover
--                     begins, so rendering DOJ as the bar start overstates
--                     coverage. Bar geometry comes from the derivation in
--                     lib/resource-timeline/deriveSegments.ts, which reads
--                     resource_period_allocation_monthly_days.
--   commercial_start  first day of real commercial/billable cover at
--                     to_supplier. Nullable: where it is NULL the value is
--                     derived from Q3 monthly days rather than assumed.
--
-- This table is read-only from the app for now — it is populated by migration
-- and seed only (034), with no UI write path.

CREATE TABLE IF NOT EXISTS public.resource_supplier_transitions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id        UUID        NOT NULL
                       REFERENCES public.resources(resource_id),
  from_supplier_id   UUID        REFERENCES public.suppliers(supplier_id),
  to_supplier_id     UUID        REFERENCES public.suppliers(supplier_id),
  last_working_day   DATE,
  joining_date       DATE,
  commercial_start   DATE,
  status             TEXT        NOT NULL DEFAULT 'pending',
  notes              TEXT,
  is_confirmed       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ,

  CONSTRAINT resource_supplier_transitions_status_check CHECK (
    status = ANY (ARRAY[
      'confirmed', 'pending', 'not_moving', 'signed_doj_tbc',
      'resigned', 'on_leave', 'left_platform', 'overlap_risk'
    ])
  ),

  -- A transition with neither end is not a transition. Mirrors the intent of
  -- rpa_supplier_or_resource_chk on resource_period_allocations.
  CONSTRAINT resource_supplier_transitions_endpoint_check CHECK (
    from_supplier_id IS NOT NULL OR to_supplier_id IS NOT NULL
  )
);

COMMENT ON TABLE public.resource_supplier_transitions IS
  'One row per resource per supplier move. Drives the Resource Timeline '
  'view''s bar clipping. joining_date is informational only and never sets '
  'bar geometry — see commercial_start.';

COMMENT ON COLUMN public.resource_supplier_transitions.joining_date IS
  'Date of joining at to_supplier. Recorded for the transition record only. '
  'Never used to set a timeline bar''s start or end — use commercial_start, '
  'or derive from resource_period_allocation_monthly_days where NULL.';

COMMENT ON COLUMN public.resource_supplier_transitions.commercial_start IS
  'First day of real commercial/billable cover at to_supplier. NULL means '
  'derive it from Q3 monthly days rather than assume the joining_date.';

-- Partial indexes scoped to live rows, per ADR-008 (soft deletes).
CREATE INDEX IF NOT EXISTS resource_supplier_transitions_resource_id_idx
  ON public.resource_supplier_transitions (resource_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS resource_supplier_transitions_deleted_at_idx
  ON public.resource_supplier_transitions (deleted_at);

-- One live transition row per resource per (from → to) pair. Makes the seed in
-- 034 re-runnable as an upsert rather than a duplicate-producing insert.
-- NULLS NOT DISTINCT so a second "CG → nobody" row for the same person
-- collides rather than silently inserting alongside the first.
CREATE UNIQUE INDEX IF NOT EXISTS resource_supplier_transitions_unique
  ON public.resource_supplier_transitions (resource_id, from_supplier_id, to_supplier_id)
  NULLS NOT DISTINCT
  WHERE deleted_at IS NULL;

ALTER TABLE public.resource_supplier_transitions
  ENABLE ROW LEVEL SECURITY;

-- Mirrors resource_period_allocations_superuser_access exactly: a single
-- FOR ALL policy on the authenticated role gated by plato_is_superuser().
-- This view joins allocation data that is already superuser-only, so a looser
-- policy here would not widen access to anything useful.
DROP POLICY IF EXISTS resource_supplier_transitions_superuser_access
  ON public.resource_supplier_transitions;
CREATE POLICY resource_supplier_transitions_superuser_access
  ON public.resource_supplier_transitions
  FOR ALL
  TO authenticated
  USING (plato_is_superuser())
  WITH CHECK (plato_is_superuser());

DROP TRIGGER IF EXISTS resource_supplier_transitions_set_updated_at
  ON public.resource_supplier_transitions;
CREATE TRIGGER resource_supplier_transitions_set_updated_at
  BEFORE UPDATE ON public.resource_supplier_transitions
  FOR EACH ROW EXECUTE FUNCTION plato_set_updated_at();
