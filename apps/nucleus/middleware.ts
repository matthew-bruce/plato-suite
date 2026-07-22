import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@plato/auth/middleware'
import { isPublicPath } from '@plato/auth'

export async function middleware(request: NextRequest) {
  // Refresh the session (if any) and get the verified user. `response` carries
  // any refreshed auth cookies — return it on the pass-through path.
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // No session + a gated route → send to login, remembering where they were.
  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Already signed in but sitting on /login → bounce to the app.
  if (user && pathname === '/login') {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    homeUrl.search = ''
    return NextResponse.redirect(homeUrl)
  }

  return response
}

export const config = {
  // Run on everything except Next internals and static asset files. Which of
  // the matched routes are public is decided in code via isPublicPath().
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
