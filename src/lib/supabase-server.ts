import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getPublicEnv, getServerEnv } from './env'

export async function createClient() {
  const env = getPublicEnv()
  const cookieStore = await cookies()

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component: cookies are read-only there.
            // Session refresh is handled by middleware instead.
          }
        },
      },
    }
  )
}

/**
 * Service-role client for server-only storage cleanup. Returns null when the
 * key is absent so the app still works with the anon key alone. Never import
 * this module from a client component.
 */
export function createAdminClient(): SupabaseClient | null {
  const serviceKey = getServerEnv().SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  const env = getPublicEnv()
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
