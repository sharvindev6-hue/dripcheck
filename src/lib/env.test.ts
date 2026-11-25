import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasPublicEnv } from './env'

describe('hasPublicEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is false when the Supabase vars are missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    expect(hasPublicEnv()).toBe(false)
  })

  it('is false when the URL is not a URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not-a-url')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'a'.repeat(32))
    expect(hasPublicEnv()).toBe(false)
  })

  it('is true for a plausible config', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'a'.repeat(32))
    expect(hasPublicEnv()).toBe(true)
  })
})
