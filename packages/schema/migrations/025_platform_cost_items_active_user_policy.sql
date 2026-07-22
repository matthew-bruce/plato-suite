-- 025 — platform_cost_items: add the "any active user" RLS policy
--
-- platform_cost_items only ever had an ADR-031 open dev-phase policy, never an
-- ADR-021 role-gated one, so migration 024 (which dropped all open policies)
-- left it with NO policy at all — locked to nobody (service-role only).
--
-- It is reference/config data (per-platform cost line items), not commercially
-- sensitive in the way cost_configurations / supplier_rate_cards are (those stay
-- superuser-only). Put it in the same "any active user" tier as the other
-- reference tables (suppliers, role_definitions, disciplines, …): full access
-- to any authenticated user who maps to a non-deleted public.users row.
--
-- Mirrors the live *_active_user_access convention exactly:
--   FOR ALL TO authenticated USING (plato_is_active_user()) WITH CHECK (…).
-- DROP-IF-EXISTS first so this is safe to re-run and can't create a duplicate.

DROP POLICY IF EXISTS platform_cost_items_active_user_access ON public.platform_cost_items;

CREATE POLICY platform_cost_items_active_user_access ON public.platform_cost_items
  FOR ALL
  TO authenticated
  USING (plato_is_active_user())
  WITH CHECK (plato_is_active_user());
