import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getPublicEnv, hasPublicEnv } from '@/lib/env'
import { requestOrigin } from '@/lib/requestOrigin'
import { safeNextPath } from '@/lib/safeNext'

const PUBLIC_PAGES = new Set(['/login'])
const PUBLIC_API_PREFIXES = ['/api/auth', '/api/health']
const AUTH_CALLBACK = '/auth/callback'
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function isPublic(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return true
  if (pathname === AUTH_CALLBACK || pathname.startsWith(`${AUTH_CALLBACK}/`)) return true
  return PUBLIC_API_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function createNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function supabaseOrigin(): string {
  try {
    const configured = process.env.NEXT_PUBLIC_SUPABASE_URL
    return configured ? new URL(configured).origin : ''
  } catch {
    return ''
  }
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production'
  const origin = supabaseOrigin()
  const connectSources = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    ...(origin ? [origin] : []),
  ]

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    // `strict-dynamic` lets Next's runtime load its own chunks after the
    // nonce-bearing bootstrap scripts run. `unsafe-eval` stays dev-only.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com" +
      (origin ? ` ${origin}` : ''),
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    "manifest-src 'self'",
  ].join('; ')
}

function withCsp<T extends NextResponse>(response: T, csp: string): T {
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Next 14 derives the CSP nonce from the request header. Strip any inbound
  // value first so a caller cannot supply a malformed nonce (CVE-2026-44581);
  // the only nonce Next sees is the one generated below.
  const nonce = createNonce()
  const csp = buildCsp(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('content-security-policy')
  requestHeaders.set('content-security-policy', csp)
  requestHeaders.set('x-nonce', nonce)

  // Same-origin guard for every mutation. A browser marks cross-site fetches
  // with Sec-Fetch-Site; a present but mismatched Origin is rejected too. A
  // literal `null` Origin (sandboxed document) never gets a mutation through.
  if (pathname.startsWith('/api') && MUTATING_METHODS.has(request.method)) {
    const site = request.headers.get('sec-fetch-site')
    const origin = request.headers.get('origin')
    if (site === 'cross-site' || origin === 'null') {
      return withCsp(NextResponse.json({ error: 'bad_origin' }, { status: 403 }), csp)
    }
    if (origin && origin !== requestOrigin(request)) {
      return withCsp(NextResponse.json({ error: 'bad_origin' }, { status: 403 }), csp)
    }
  }

  // Without Supabase config there is no session to inspect. Let the app show
  // its setup notice instead of 500-ing on every request.
  if (!hasPublicEnv()) {
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }), csp)
  }

  const env = getPublicEnv()
  let response = withCsp(NextResponse.next({ request: { headers: requestHeaders } }), csp)

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Rebuild the outgoing header bag so refreshed cookies and the CSP
          // nonce both reach the render.
          requestHeaders.set(
            'cookie',
            request.cookies
              .getAll()
              .map(cookie => `${cookie.name}=${cookie.value}`)
              .join('; ')
          )
          response = withCsp(NextResponse.next({ request: { headers: requestHeaders } }), csp)
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh an expired session. This is the only place cookies are written
  // outside route handlers.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (isPublic(pathname)) {
    if (user && pathname === '/login') {
      return withCsp(NextResponse.redirect(new URL('/', requestOrigin(request))), csp)
    }
    return response
  }

  if (!user) {
    if (pathname.startsWith('/api')) {
      return withCsp(NextResponse.json({ error: 'unauthorized' }, { status: 401 }), csp)
    }
    const login = new URL('/login', requestOrigin(request))
    login.searchParams.set('next', safeNextPath(`${pathname}${request.nextUrl.search}`))
    return withCsp(NextResponse.redirect(login), csp)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ttf|otf|ico)$).*)',
  ],
}
