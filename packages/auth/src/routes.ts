// Pure routing logic — no vendor SDK, no framework. Unit-tested.

/** Routes reachable without a valid session. Everything else is gated. */
export const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'] as const

/**
 * Whether a pathname may be served to an unauthenticated request.
 *
 * The three auth pages are always public. Anything under `/auth/` (the code
 * exchange route handler used by the password-reset link) must also be
 * reachable without a session — it is what *establishes* the session.
 *
 * `pathname` is the URL path only (no query string), as provided by
 * `NextRequest.nextUrl.pathname`.
 */
export function isPublicPath(pathname: string): boolean {
  if ((PUBLIC_PATHS as readonly string[]).includes(pathname)) return true
  if (pathname === '/auth' || pathname.startsWith('/auth/')) return true
  return false
}
