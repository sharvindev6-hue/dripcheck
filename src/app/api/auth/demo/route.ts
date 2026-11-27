import { NextResponse, type NextRequest } from 'next/server'
import { logServerError } from '@/lib/api'
import { isDemoLoginEnabled } from '@/lib/demo'
import { getServerEnv } from '@/lib/env'
import { requestOrigin } from '@/lib/requestOrigin'
import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// 303 so the browser follows the POST with a GET on the callback/login page.
function loginError(origin: string) {
  return NextResponse.redirect(new URL('/login?error=demo', origin), 303)
}

/**
 * Development-only shortcut for the seeded demo account. Production builds
 * return 404 even if the route is bundled, and the login page hides the
 * button outside development.
 */
export async function POST(request: NextRequest) {
  if (!isDemoLoginEnabled()) {
    return new NextResponse('Not found', { status: 404 })
  }

  const origin = requestOrigin(request)
  const demoEmail = getServerEnv().DEMO_USER_EMAIL

  // `createAdminClient` reads the public Supabase env, which throws when the
  // deployment is not configured. Treat that as a failed demo login, not a 500.
  const admin = (() => {
    try {
      return createAdminClient()
    } catch (error) {
      logServerError('auth:demo:config', error)
      return null
    }
  })()
  if (!admin || !demoEmail) return loginError(origin)

  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: demoEmail,
      options: { redirectTo: new URL('/auth/callback', origin).toString() },
    })
    const tokenHash = data?.properties?.hashed_token

    if (error || !tokenHash) {
      logServerError('auth:demo', error ?? new Error('demo link had no token'))
      return loginError(origin)
    }

    const callback = new URL('/auth/callback', origin)
    callback.searchParams.set('token_hash', tokenHash)
    callback.searchParams.set('type', 'magiclink')
    callback.searchParams.set('next', '/')
    return NextResponse.redirect(callback, 303)
  } catch (error) {
    logServerError('auth:demo', error)
    return loginError(origin)
  }
}
