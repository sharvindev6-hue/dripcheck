import { NextResponse } from 'next/server'
import { createClient } from './supabase-server'
import type { RateLimitResult } from './rate-limit'

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export interface AuthContext {
  supabase: ServerSupabase
  user: { id: string; email?: string | null }
}

/** Resolve the signed-in user or null. Never trusts client-supplied ids. */
export async function getAuth(): Promise<AuthContext | null> {
  let supabase: ServerSupabase
  try {
    supabase = await createClient()
  } catch (configError) {
    // A missing Supabase config is a deployment problem, not an authenticated
    // request. Return 401 rather than leaking a 500 from every API route.
    console.error('[dripcheck:auth:config]', configError)
    return null
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { supabase, user: { id: user.id, email: user.email } }
}

export function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

export function badRequest(code = 'invalid_request') {
  return NextResponse.json({ error: code }, { status: 400 })
}

export function forbidden(code = 'forbidden') {
  return NextResponse.json({ error: code }, { status: 403 })
}

export function notFound(code = 'not_found') {
  return NextResponse.json({ error: code }, { status: 404 })
}

export function conflict(code = 'conflict') {
  return NextResponse.json({ error: code }, { status: 409 })
}

export function payloadTooLarge(code = 'payload_too_large') {
  return NextResponse.json({ error: code }, { status: 413 })
}

export function serverError(code = 'server_error') {
  return NextResponse.json({ error: code }, { status: 500 })
}

export function tooMany(result: RateLimitResult) {
  return NextResponse.json(
    { error: 'rate_limited' },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Remaining': String(result.remaining),
      },
    }
  )
}

/** Log server-side detail, return nothing useful to the client. */
export function logServerError(scope: string, error: unknown) {
  console.error(`[dripcheck:${scope}]`, error)
}
