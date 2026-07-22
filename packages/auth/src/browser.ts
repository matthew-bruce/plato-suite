import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getPublicSupabaseEnv } from './env'

let _client: SupabaseClient | null = null

/**
 * Browser-side Supabase client for auth (cookie-backed via @supabase/ssr, so
 * the session it establishes is visible to server components and middleware).
 * Singleton per tab. Internal to @plato/auth — application code calls the
 * generic auth functions (signIn/signOut/...), never this directly.
 */
export function getBrowserAuthClient(): SupabaseClient {
  if (_client) return _client
  const { url, anonKey } = getPublicSupabaseEnv()
  _client = createBrowserClient(url, anonKey)
  return _client
}
