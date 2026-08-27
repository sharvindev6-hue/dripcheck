'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// Single browser client for the whole module (avoids re-creating it every render)
const supabase = createClient()

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Already signed in? Skip the form entirely.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/closet')
    })
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)
    setIsError(false)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      setIsError(false)
      setMessage('Check your inbox for the magic link.')
      setEmail('')
    } catch {
      setIsError(true)
      setMessage('Could not send link. Please try again.')
    } finally {
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
          <p className="font-mono text-[11px] font-extrabold uppercase tracking-[0.22em] text-muted">
            ↳ THE DAILY STYLIST
          </p>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-tight text-text">
            DripCheck
          </h1>
          <p className="mt-3 font-body text-sm text-muted">
            Sign in to digitize your wardrobe and let Milli pick your fit.
          </p>
        </div>

        <div className="rounded-card border border-hairline-strong bg-surface-1 shadow-luxe p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block font-mono text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted mb-2"
              >
                ↳ EMAIL
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                disabled={isLoading}
                className="w-full px-4 py-3 bg-surface-2 border border-hairline-strong rounded-card font-body text-text placeholder:text-faint focus:outline-none focus:border-champagne-start focus:shadow-ai-glow transition disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full inline-flex items-center justify-center ai-gradient font-mono font-extrabold uppercase tracking-[0.18em] py-3.5 px-5 rounded-card border border-hairline-strong btn-press disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'SENDING…' : 'SEND MAGIC LINK'}
            </button>
          </form>

          {message && (
            <p
              role={isError ? 'alert' : 'status'}
              className={`mt-4 rounded-card border px-4 py-3 font-mono text-[11px] font-extrabold uppercase tracking-[0.18em] ${
                isError
                  ? 'border-brick/40 bg-brick/10 text-brick'
                  : 'border-sage/40 bg-sage/10 text-sage'
              }`}
            >
              {message}
            </p>
          )}

          <div className="mt-6 pt-6 border-t border-hairline">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full py-2 font-mono text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted hover:text-text transition-colors"
            >
              SIGN OUT
            </button>
          </div>
        </div>

        <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
          MAGIC LINK · NO PASSWORD NEEDED
        </p>
      </div>
    </main>
  )
}
