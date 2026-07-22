// Cookie-aware, session-bearing Supabase client for server components / server
// actions / route handlers. This is the read-as-the-logged-in-user path (RLS
// enforced), as distinct from getSupabaseServerClient() in ./server which uses
// the service-role key and bypasses RLS.
//
// The @supabase/ssr plumbing lives in @plato/auth (the auth vendor boundary,
// ADR-003); @plato/schema is the data-access boundary (ADR-027), so data code
// imports this rather than reaching into @plato/auth directly.
export { createServerSupabaseClient as getSupabaseServerComponentClient } from '@plato/auth/server'
