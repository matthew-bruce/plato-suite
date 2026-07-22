// Server-only entry (@plato/schema/server). Everything here queries as the
// logged-in user via the cookie-aware SSR client (next/headers), so it must
// never be imported from a client component — that's exactly why these are
// split out of the client-safe index barrel.
//
// The @supabase/ssr plumbing lives in @plato/auth (the auth vendor boundary,
// ADR-003); @plato/schema is the data-access boundary (ADR-027), so data code
// imports the client + these server queries from here rather than reaching
// into @plato/auth directly.
export { createServerSupabaseClient as getSupabaseServerComponentClient } from '@plato/auth/server'

export { getSchedulePageData } from './queries/schedule'
export { getRatesPageData } from './queries/rates'
export { getHomepageData } from './queries/homepage'
export {
  resolveCostConfiguration,
  resolveCostConfigurationByCode,
  resolveAppliedCostConfiguration,
  resolveAppliedCostConfigurationByCode,
} from './queries/costConfig'
