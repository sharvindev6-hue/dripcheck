import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { logServerError } from '@/lib/api'

export const dynamic = 'force-dynamic'

function safeNext(value: string | null): string {
  // Reject protocol-relative, backslash-normalised and control-character
  // paths that browsers can turn into an off-site redirect.
  if (!value) return '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/'
  if (/[\u0000-\u001f]/.test(value)) return '/'
  return value
}

/**
 * Supabase magic-link landing. Exchanges the PKCE code for a cookie-backed
 * session (the old page called getSession(), which never exchanged anything).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const next = safeNext(url.searchParams.get('next'))
  const error = url.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL('/login?error=auth', request.url))
  }

  const supabase = await createClient().catch(configError => {
    logServerError('auth:config', configError)
    return null
  })
  if (!supabase) {
    return NextResponse.redirect(new URL('/login?error=config', request.url))
  }

  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError) return NextResponse.redirect(new URL(next, request.url))
    logServerError('auth:exchange', exchangeError)
  }

  // Email templates configured with `token_hash` instead of PKCE.
  if (tokenHash && type) {
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'magiclink' | 'email' | 'signup' | 'recovery' | 'invite' | 'email_change',
    })
    if (!otpError) return NextResponse.redirect(new URL(next, request.url))
    logServerError('auth:verify-otp', otpError)
  }

  return NextResponse.redirect(new URL('/login?error=auth', request.url))
}
