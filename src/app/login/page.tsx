'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// Single browser client for the whole module (avoids re-creating it every render)
const supabase = createClient()

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch {
      setError('Could not start Google sign-in. Please try again.')
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <p className="font-mono text-[11px] font-extrabold uppercase tracking-[0.22em] text-muted">↳ THE DAILY STYLIST</p>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-tight text-text">
            DripCheck
          </h1>
          <p className="mt-3 font-body text-sm text-muted">
            Sign in to digitize your wardrobe and let Milli pick your fit.
          </p>
        </div>

        <div className="rounded-card border border-hairline-strong bg-surface-1 shadow-luxe p-8">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-3 bg-cream text-ink font-body font-semibold py-3.5 px-5 rounded-card border border-hairline-strong hover:opacity-90 active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.5 29.4 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.5 29.4 4.5 24 4.5 16 4.5 9.1 9.2 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 43.5c5.3 0 10.1-2 13.7-5.3l-6.3-5.3c-2 1.4-4.6 2.3-7.4 2.3-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9 39.5 16 43.5 24 43.5z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.3 5.3C40.6 36 43.5 30.5 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
            </svg>
            <span>{isLoading ? 'Opening Google…' : 'Continue with Google'}</span>
          </button>

          {error && (
            <p role="alert" className="mt-4 rounded-card border border-brick/40 bg-brick/10 px-4 py-3 font-mono text-xs uppercase tracking-wider text-brick">
              {error}
            </p>
          )}

          <div className="mt-6 pt-6 border-t border-hairline">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full py-2 font-mono text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted hover:text-text transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
          Google OAuth · Supabase Auth · No password needed
        </p>
      </div>
    </main>
  )
}
