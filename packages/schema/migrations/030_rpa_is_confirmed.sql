-- Documents the resource_period_allocations.is_confirmed column.
--
-- RETROACTIVE: this column already exists on the live database — it was
-- applied out of band while the Schedule "Confirmed" review-tracking column
-- was being built. This file exists so the repo's migration history matches
-- the deployed schema; it is written idempotently (IF NOT EXISTS) and is a
-- no-op against the current database.
--
-- Ordering caveat: migrations 030-032 all document schema that predates the
-- already-committed 029 (the monthly-days RPCs), which references the table
-- created in 032. Against a genuinely fresh database, apply 030, 031 and 032
-- BEFORE 029. plpgsql function bodies are not resolved until execution, so
-- 029 will still create successfully in numeric order, but the RPCs it
-- defines will not work until 032 has run.
--
-- Purpose: per-allocation review flag driving the Schedule page's "Confirmed"
-- column — an editable checkbox in edit mode, a read-only status icon in view
-- mode. Purely a review-tracking field: it feeds no cost calculation.
-- Defaults false so existing and newly-created rows start unconfirmed.

ALTER TABLE public.resource_period_allocations
  ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.resource_period_allocations.is_confirmed IS
  'Review-tracking flag surfaced as the Schedule page''s Confirmed column. '
  'Not an input to any cost calculation.';

-- RLS: inherits the existing resource_period_allocations_superuser_access
-- ALL policy on the parent table. No new policy required.
