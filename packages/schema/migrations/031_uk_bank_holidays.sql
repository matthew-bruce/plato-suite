-- Documents the uk_bank_holidays reference table.
--
-- RETROACTIVE: this table already exists on the live database — it was
-- applied out of band while the Schedule monthly day-breakdown was being
-- built. This file exists so the repo's migration history matches the
-- deployed schema; it is written idempotently and is a no-op against the
-- current database. See the ordering caveat in 030.
--
-- Purpose: England-and-Wales bank holiday dates, used by the Schedule page's
-- "Populate working days" button to subtract weekday holidays from each
-- month's weekday count. The UI deliberately disables that button for any
-- calendar year with no rows here rather than producing an unadjusted (and
-- therefore over-counted) figure — so an empty year is a meaningful state,
-- not just missing data.
--
-- SEED DATA IS NOT INCLUDED HERE. The live table was seeded separately with
-- 2024-2028 (8 dates per year) from the official gov.uk feed. That data is
-- deliberately not re-embedded as an INSERT, because gov.uk revises
-- substitute-day titles occasionally and a hardcoded copy would drift.
-- If this migration is ever replayed against a fresh database the table will
-- be created EMPTY, and the seed must be reconciled by running:
--
--   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
--     npx tsx scripts/sync-bank-holidays.ts
--
-- which pulls the england-and-wales division straight from gov.uk. Until
-- that is done, "Populate working days" will correctly disable itself
-- rather than silently miscount.

CREATE TABLE IF NOT EXISTS public.uk_bank_holidays (
  holiday_date DATE PRIMARY KEY,
  title        TEXT NOT NULL,
  division     TEXT NOT NULL DEFAULT 'england-and-wales'
);

COMMENT ON TABLE public.uk_bank_holidays IS
  'Reference data: England-and-Wales bank holidays from gov.uk. Seeded and '
  'refreshed via scripts/sync-bank-holidays.ts, not by this migration.';

ALTER TABLE public.uk_bank_holidays ENABLE ROW LEVEL SECURITY;

-- Readable by any active user (it is public reference data); writes are left
-- to the service-role sync script, which bypasses RLS.
DROP POLICY IF EXISTS uk_bank_holidays_read_access ON public.uk_bank_holidays;
CREATE POLICY uk_bank_holidays_read_access
  ON public.uk_bank_holidays
  FOR SELECT
  USING (plato_is_active_user());
