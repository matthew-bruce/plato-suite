# ADR-031 — Temporary Anon RLS Policies for Pre-Auth Development

Date: 2026-04-19
Status: Accepted — temporary, expires on auth implementation

## Decision
During the pre-authentication development phase, non-sensitive tables
in Nucleus have anon read and write RLS policies to allow the app to
function without a logged-in user. These policies MUST be removed
before any production deployment or client demonstration.

## Current temporary policies (as of April 2026)
```sql
-- Read
CREATE POLICY platforms_anon_read   ON platforms   FOR SELECT TO anon USING (deleted_at IS NULL);
CREATE POLICY workstreams_anon_read ON workstreams  FOR SELECT TO anon USING (deleted_at IS NULL);
CREATE POLICY teams_anon_read       ON teams        FOR SELECT TO anon USING (deleted_at IS NULL);
CREATE POLICY disciplines_anon_read ON disciplines  FOR SELECT TO anon USING (deleted_at IS NULL);

-- Write (broader — allows create/update/delete without auth)
CREATE POLICY platforms_anon_write   ON platforms   FOR ALL TO anon USING (deleted_at IS NULL) WITH CHECK (true);
CREATE POLICY workstreams_anon_write ON workstreams  FOR ALL TO anon USING (deleted_at IS NULL) WITH CHECK (true);
CREATE POLICY teams_anon_write       ON teams        FOR ALL TO anon USING (deleted_at IS NULL) WITH CHECK (true);
```

## Why this is necessary
The server-side Supabase client uses the service role key when
`SUPABASE_SERVICE_ROLE_KEY` is set as a Vercel environment variable,
which bypasses RLS entirely. However, this key was not confirmed as
set in Vercel during initial development, so anon policies were
added as a fallback.

Once the service role key is confirmed in Vercel environment variables,
the anon write policies can be removed immediately. The service role
key on the server client is the correct long-term solution — it means
the server always has full access and RLS enforces rules only for
client-side queries from logged-in users.

## Removal checklist
Before any production deployment:
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel
- [ ] Confirm server-side queries work without anon policies
- [ ] Drop all anon read/write policies on non-sensitive tables
- [ ] Verify the app functions correctly with auth gating only
- [ ] Sensitive tables (`supplier_rate_cards`, `resource_period_allocations`,
      `cost_configurations`) already have superuser-only RLS — these
      are correct and should not be changed

## Consequences
- The demo app is currently publicly writable — anyone with the URL
  can create, edit, or delete platforms, workstreams, and teams
- This is acceptable during development but unacceptable for any
  client-facing deployment
- Auth implementation is tracked as a production-readiness blocker
