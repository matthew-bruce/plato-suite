-- 024 — Authenticated-only access: close ADR-031 (Nucleus) and ADR-TESS-001 (Tessera)
--
-- See ADR-033. Two different jobs because the two apps are in different states:
--
--   NUCLEUS already has the correct ADR-021 role-gated policies
--   (plato_is_active_user() on general tables, plato_is_superuser() on the
--   commercially-sensitive ones) sitting *underneath* the temporary ADR-031
--   open dev-phase policies. Per the "dead auth-gated policy" trap
--   (SCHEMA_DESIGN §4a) the open policies OR alongside the good ones and negate
--   them, so the fix is simply to DROP every open/anon policy — leaving the
--   ADR-021 policies as the sole, correct gate. We add NOTHING to Nucleus.
--
--   TESSERA has no role model — only open USING(true) policies. We drop them
--   all and replace each table's access with a single authenticated-only
--   policy.
--
-- Server-side reads are unaffected either way: Nucleus server code uses the
-- service-role client (bypasses RLS); Tessera server components now query as
-- the logged-in user via the cookie-aware SSR client, satisfying the new
-- authenticated policy.

-- ─────────────────────────────────────────────────────────────────────────────
-- PART A — NUCLEUS: drop every ADR-031 open / anon policy, keep role-gated ones
--
-- Targets exactly (verified against pg_policies at authoring time):
--   arts, cost_configurations(read), disciplines(+anon_read), infrastructures
--   (+anon_read), org_containers, organisations, period_cost_snapshots(read),
--   periods(read+write), planning_increments, platform_cost_items(read+write),
--   platforms(anon_read+anon_write), resource_period_allocations(read+write),
--   resource_skills, resource_team_assignments(read+write), resources
--   (+anon_read), role_definitions(+anon_read), roles, skills(+anon_read),
--   suppliers(+anon_read), team_workstreams, teams(anon_read+anon_write),
--   workstreams(anon_read+anon_write).
--
-- The WHERE clause is the specification: an open policy is one whose qual is a
-- bare `true` OR that is granted to the `anon` role. The NOT ILIKE guards make
-- it impossible to drop any ADR-021 policy (active_user / superuser) or the
-- users self-access policy, even by accident.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'tessera_%'
      AND (qual = 'true' OR 'anon' = ANY(roles))
      AND policyname NOT ILIKE '%active_user%'
      AND policyname NOT ILIKE '%superuser%'
      AND policyname NOT ILIKE '%self_access%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART B — TESSERA: drop all open policies, replace with authenticated-only
--
-- Drop every existing policy on every tessera_* table (they are all open), so
-- no leftover open policy can OR alongside the new one (SCHEMA_DESIGN §4a).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename LIKE 'tessera_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- One authenticated-only, full-access policy per tessera table. Tessera has no
-- sensitive-data tiering yet (ADR-033) — do not invent one here.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tessera_app_group_resources',
    'tessera_app_groups',
    'tessera_domain_app_group_links',
    'tessera_domain_parker_mapping',
    'tessera_domain_resources',
    'tessera_domain_track_content',
    'tessera_domains',
    'tessera_itinerary_days',
    'tessera_itinerary_sessions',
    'tessera_kt_actions',
    'tessera_kt_gaps',
    'tessera_kt_session_domain_links',
    'tessera_kt_session_resources',
    'tessera_kt_sessions',
    'tessera_nuggets',
    'tessera_parker_questions',
    'tessera_rag_scores'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      || 'USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')',
      t || '_authenticated', t
    );
  END LOOP;
END $$;
