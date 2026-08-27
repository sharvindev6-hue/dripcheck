'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// Single browser client for the whole module (avoids re-creating it every render)
const supabase = createClient()

export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const finish = async () => {
      try {
        const { error } = await supabase.auth.getSession()
        if (error) throw error
        router.replace('/closet')
      } catch (err) {
        console.error('Auth callback error:', err)
        setError('Authentication failed. Please try again.')
      }
    }

    finish()
  }, [router])

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg px-4">
        <div className="w-full max-w-md rounded-card border border-hairline-strong bg-surface-1 shadow-luxe p-8 text-center">
          <p role="alert" className="font-mono text-xs uppercase tracking-wider text-brick">
            {error}
          </p>
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="mt-6 inline-flex items-center justify-center bg-cream text-ink font-body font-semibold py-2.5 px-5 rounded-card border border-hairline-strong hover:opacity-90 transition"
          >
            Back to Login
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-[4px] border-surface-2 border-t-champagne-start" />
        <p className="font-mono text-xs font-extrabold uppercase tracking-[0.22em] text-muted">
          Signing you in…
        </p>
      </div>
    </main>
  )
}
