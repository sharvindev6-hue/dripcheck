import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getPublicEnv, hasPublicEnv } from '@/lib/env'

const PUBLIC_PAGES = new Set(['/login'])
const PUBLIC_API_PREFIXES = ['/api/auth', '/api/health']
const AUTH_CALLBACK = '/auth/callback'

function isPublic(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return true
  if (pathname === AUTH_CALLBACK || pathname.startsWith(`${AUTH_CALLBACK}/`)) return true
  return PUBLIC_API_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function safeNext(value: string | null): string {
  if (!value) return '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/'
  if (/[\u0000-\u001f]/.test(value)) return '/'
  return value
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Same-origin guard for every mutation. Browsers send Origin on fetch POSTs;
  // a missing header (curl, server-to-server) is allowed, but a mismatched
  // origin is rejected before auth or body parsing.
  if (
    pathname.startsWith('/api') &&
    !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
  ) {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'bad_origin' }, { status: 403 })
    }
  }

  // Without Supabase config there is no session to inspect. Let the app show
  // its setup notice instead of 500-ing on every request.
  if (!hasPublicEnv()) return NextResponse.next({ request })

  const env = getPublicEnv()
  let response = NextResponse.next({ request })

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
          response = NextResponse.next({ request })
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
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  if (!user) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const login = new URL('/login', request.url)
    login.searchParams.set('next', safeNext(`${pathname}${request.nextUrl.search}`))
    return NextResponse.redirect(login)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ttf|otf|ico)$).*)',
  ],
}
