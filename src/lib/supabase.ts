import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getPublicEnv } from './env'

let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (client) return client
  const env = getPublicEnv()
  client = createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  return client
}

// Lazy proxy: `createClient()` at module scope no longer touches env, so a
// production build without .env.local no longer crashes during prerender.
// The real client is constructed on first property access at runtime.
const lazyClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const real = getClient() as unknown as Record<PropertyKey, unknown>
    const value = real[prop]
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(real)
      : value
  },
})

/** Browser Supabase client. Safe to call during prerender; env is read lazily. */
export function createClient(): SupabaseClient {
  return lazyClient
}
