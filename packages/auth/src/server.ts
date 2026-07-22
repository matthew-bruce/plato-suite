import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getPublicSupabaseEnv } from './env'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Cookie-aware Supabase client for server components, server actions and route
 * handlers. Queries run as the currently-logged-in user, so RLS
 * (`auth.role() = 'authenticated'` on Tessera, `plato_is_active_user()` on
 * Nucleus) is enforced with the real session.
 *
 * In a plain server component cookies are read-only, so `setAll` is a no-op
 * there (session refresh is middleware's job — see ./middleware). In a route
 * handler / server action, `setAll` writes cookies normally.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()
  const { url, anonKey } = getPublicSupabaseEnv()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Component render context — cookies are immutable here.
          // Safe to ignore: middleware refreshes the session cookie instead.
        }
      },
    },
  })
}

/**
 * Exchange an OAuth/PKCE `code` (from the password-reset or OAuth redirect) for
 * a session, setting the auth cookies. Call this from an /auth/callback route
 * handler so application code never touches supabase.auth.* directly.
 */
export async function exchangeAuthCode(code: string): Promise<{ ok: boolean }> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  return { ok: !error }
}
