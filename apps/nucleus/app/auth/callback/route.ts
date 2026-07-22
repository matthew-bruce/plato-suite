import { NextResponse, type NextRequest } from 'next/server'
import { exchangeAuthCode } from '@plato/auth/server'

/**
 * OAuth/PKCE code-exchange endpoint. The password-reset email link lands here
 * with a `?code=`; we exchange it for a session (setting the auth cookies in
 * this route handler) then forward to `next` (the reset-password page).
 *
 * Public route (see @plato/auth isPublicPath) — it is what establishes the
 * session, so it must be reachable without one.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/'
  const dest = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'

  if (code) {
    const { ok } = await exchangeAuthCode(code)
    if (ok) {
      return NextResponse.redirect(`${origin}${dest}`)
    }
  }

  // No code, or exchange failed (e.g. link opened on a different device, so the
  // PKCE verifier cookie isn't present) — send them to sign in.
  return NextResponse.redirect(`${origin}/login`)
}
