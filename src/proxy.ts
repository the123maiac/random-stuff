import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

// Paths reachable without a session. Everything else redirects to /login.
// `/s` and `/site` serve published apps to anonymous visitors.
const PUBLIC_PATHS = ['/login', '/signup', '/auth', '/s', '/site']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

// The app's own hostname(s). Requests arriving on any other Host are treated as
// published custom domains. If NEXT_PUBLIC_APP_URL is unset we can't tell the
// app's host from a custom one, so custom-domain serving stays off.
const APP_HOSTNAME = publicEnv.NEXT_PUBLIC_APP_URL
  ? new URL(publicEnv.NEXT_PUBLIC_APP_URL).hostname.toLowerCase()
  : null

function isAppHost(hostname: string): boolean {
  if (!APP_HOSTNAME) return true
  return (
    hostname === APP_HOSTNAME ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.vercel.app')
  )
}

/**
 * Refreshes the Supabase auth token on every request and does a coarse,
 * optimistic redirect for signed-out users. This is NOT the authorization
 * boundary — each protected Route Handler and Server Action re-checks the user
 * with `supabase.auth.getUser()` before trusting it.
 */
export async function proxy(request: NextRequest) {
  // Custom-domain serving: a request on a non-app Host is a visitor to someone's
  // published site. Rewrite it to the public /site handler (which resolves the
  // Host to a verified domain) and skip auth entirely — no session is involved.
  const requestHostname = (request.headers.get('host') ?? '').split(':')[0].toLowerCase()
  if (!isAppHost(requestHostname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/site'
    url.search = ''
    return NextResponse.rewrite(url)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // Touching getUser() here is what refreshes an expiring token and rewrites
  // the session cookies onto `response`. Do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
