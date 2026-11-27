import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { logServerError } from '@/lib/api'
import { requestOrigin } from '@/lib/requestOrigin'
import { safeNextPath } from '@/lib/safeNext'

export const dynamic = 'force-dynamic'

const OTP_TYPES = new Set([
  'magiclink',
  'email',
  'signup',
  'recovery',
  'invite',
  'email_change',
])

/**
 * Supabase magic-link landing. Exchanges the PKCE code for a cookie-backed
 * session (the old page called getSession(), which never exchanged anything).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const next = safeNextPath(url.searchParams.get('next'))
  const error = url.searchParams.get('error')

  const origin = requestOrigin(request)

  if (error) {
    return NextResponse.redirect(new URL('/login?error=auth', origin))
  }

  const supabase = await createClient().catch(configError => {
    logServerError('auth:config', configError)
    return null
  })
  if (!supabase) {
    return NextResponse.redirect(new URL('/login?error=config', origin))
  }

  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError) return NextResponse.redirect(new URL(next, origin))
    logServerError('auth:exchange', exchangeError)
  }

  // Email templates configured with `token_hash` instead of PKCE. The type is
  // attacker-controlled query data, so only the OTP types Supabase defines are
  // forwarded.
  if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'magiclink' | 'email' | 'signup' | 'recovery' | 'invite' | 'email_change',
    })
    if (!otpError) return NextResponse.redirect(new URL(next, origin))
    logServerError('auth:verify-otp', otpError)
  }

  return NextResponse.redirect(new URL('/login?error=auth', origin))
}
