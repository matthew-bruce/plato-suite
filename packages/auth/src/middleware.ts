import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getPublicSupabaseEnv } from './env'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Refresh the Supabase session for an incoming request and return both the
 * response (carrying any refreshed session cookies) and the verified user.
 *
 * Uses `auth.getUser()`, which revalidates the JWT against the Auth server —
 * never `getSession()`, which only decodes the (spoofable) cookie. Each app's
 * middleware calls this, then decides whether to redirect based on `user` and
 * `isPublicPath()`.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request })
  const { url, anonKey } = getPublicSupabaseEnv()

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
