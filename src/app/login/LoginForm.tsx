'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HangerIcon } from '@/components/icons'
import { createClient } from '@/lib/supabase'
import { hasPublicEnv } from '@/lib/env'

function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/'
  if (/[\u0000-\u001f]/.test(value)) return '/'
  return value
}

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nextPath, setNextPath] = useState('/')
  const configured = hasPublicEnv()
  const isDevelopment = process.env.NODE_ENV === 'development'

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const next = safeNext(params.get('next'))
    setNextPath(next)

    const errorCode = params.get('error')
    if (errorCode) {
      setError(
        errorCode === 'demo'
          ? 'Demo sign-in is unavailable. Check the local Supabase and demo env values.'
          : 'That sign-in link did not work. Send a fresh one.'
      )
    }

    if (!configured) return
    try {
      const supabase = createClient()
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) router.replace(next)
      })
    } catch {
      // The setup notice below explains a missing environment.
    }
  }, [configured, router])

  const sendLink = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loading || !email.trim()) return
    setLoading(true)
    setMessage(null)
    setError(null)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      })
      if (authError) throw authError

      setMessage('Check your inbox for the magic link. It signs you in on this device.')
      setEmail('')
    } catch {
      setError('Could not send the link. Check your email address and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!configured) {
    return (
      <main className="login">
        <div className="login-inner">
          <div className="login-brand">
            <span className="login-mark">
              <HangerIcon size={30} />
            </span>
            <span className="login-word">
              Drip<em>Check</em>
            </span>
          </div>
          <h1 className="login-title">Connect Supabase first.</h1>
          <p className="login-sub">
            Copy <code>.env.example</code> to <code>.env.local</code> and set the project URL and
            anon key, then restart the dev server. The app needs them for sign-in and storage.
          </p>
          <div className="login-card">
            <p className="login-fine">
              Apply <code>supabase/migrations/0001_recovery.sql</code> in the Supabase SQL editor,
              then enable Email magic links under Authentication.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="login">
      <div className="login-inner">
        <div className="login-brand">
          <span className="login-mark">
            <HangerIcon size={30} />
          </span>
          <span className="login-word">
            Drip<em>Check</em>
          </span>
        </div>

        <h1 className="login-title">
          Get dressed
          <br />
          <em>without the</em>
          <br />
          decision fatigue.
        </h1>
        <p className="login-sub">
          Digitize your closet once. Every morning, a complete look for the weather and whatever
          you are doing.
        </p>

        <div className="login-card">
          <form onSubmit={(event) => void sendLink(event)}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              required
              disabled={loading}
            />
            <button
              type="submit"
              className="btn pri login-btn"
              disabled={loading || !email.trim()}
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>

          {message ? (
            <p className="login-msg" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="login-msg err" role="alert">
              {error}
            </p>
          ) : null}

          {isDevelopment ? (
            <div className="login-demo">
              <p className="login-demo-or">or</p>
              <form action="/api/auth/demo" method="post">
                <button type="submit" className="btn sec login-demo-btn">
                  Use the demo closet
                </button>
              </form>
              <p className="login-fine">
                Development only. Signs in as the seeded demo account.
              </p>
            </div>
          ) : null}

          <p className="login-fine">
            No password. The link signs you in on this device. Photos stay in a private bucket only
            your account can read.
          </p>
        </div>

        <p className="login-foot">Private closet · Private photos · Only your clothes</p>
      </div>
    </main>
  )
}
