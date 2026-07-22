import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

/**
 * Browser-side Supabase client for client components. Cookie-backed via
 * @supabase/ssr so it shares the session established at login by @plato/auth —
 * client-side queries therefore run as the logged-in user and satisfy RLS
 * (`plato_is_active_user()` on Nucleus, `auth.role() = 'authenticated'` on
 * Tessera). Singleton per tab.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY')

  _client = createBrowserClient(url, key)
  return _client
}
