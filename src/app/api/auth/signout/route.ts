import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { logServerError } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()
    if (error) logServerError('auth:signout', error)
  } catch (error) {
    // A deployment without Supabase has no server session to clear. The
    // browser fallback still clears local cookies.
    logServerError('auth:signout-config', error)
  }

  return NextResponse.json({ ok: true })
}
