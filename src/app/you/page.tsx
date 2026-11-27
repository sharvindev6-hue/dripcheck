'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { CheckIcon, LockIcon } from '@/components/icons'
import { createClient } from '@/lib/supabase'
import { normalizeItem, normalizeOutfit } from '@/lib/items'
import { buildStats } from '@/lib/stats'
import { getTodayLocalDateString } from '@/lib/date'
import type { Item, Outfit } from '@/types'

type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'
type Silhouette = 'tailored' | 'relaxed' | 'oversized'

interface Profile {
  id: string
  email: string
  size: Size | null
  silhouette: Silhouette | null
  city: string | null
}

const SIZES: Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

const SILHOUETTES: { value: Silhouette; label: string; hint: string }[] = [
  { value: 'tailored', label: 'Tailored', hint: 'Closer to the body' },
  { value: 'relaxed', label: 'Relaxed', hint: 'Room to move' },
  { value: 'oversized', label: 'Oversized', hint: 'Loose all over' },
]

function initials(email: string): string {
  const name = email.split('@')[0] ?? ''
  const parts = name.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (name.slice(0, 2) || 'YO').toUpperCase()
}

export default function YouPage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [cityDraft, setCityDraft] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const today = getTodayLocalDateString()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const [profileResult, itemsResult, outfitsResult] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('items').select('*').eq('user_id', user.id),
        supabase.from('outfits').select('*').eq('user_id', user.id),
      ])

      if (profileResult.error || itemsResult.error || outfitsResult.error) {
        throw profileResult.error ?? itemsResult.error ?? outfitsResult.error
      }

      const row = profileResult.data
      const nextProfile: Profile = {
        id: user.id,
        email: typeof row?.email === 'string' && row.email ? row.email : user.email ?? '',
        size: SIZES.includes(row?.size as Size) ? (row?.size as Size) : null,
        silhouette:
          row?.silhouette === 'tailored' || row?.silhouette === 'relaxed' || row?.silhouette === 'oversized'
            ? row.silhouette
            : null,
        city: typeof row?.city === 'string' ? row.city : null,
      }

      setProfile(nextProfile)
      setCityDraft(nextProfile.city ?? '')
      setItems((itemsResult.data ?? []).map(item => normalizeItem(item as Record<string, unknown>)))
      setOutfits((outfitsResult.data ?? []).map(outfit => normalizeOutfit(outfit as Record<string, unknown>)))
    } catch (loadError) {
      console.error('[dripcheck:you]', loadError)
      setError('Your profile could not load. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => buildStats(items, outfits, today), [items, outfits, today])

  const save = useCallback(
    async (patch: Partial<Pick<Profile, 'size' | 'silhouette' | 'city'>>) => {
      if (!profile || saving) return
      const previous = profile
      setProfile({ ...profile, ...patch })
      setSaving(true)
      try {
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.profile) throw new Error('save failed')
        showToast('Saved.')
      } catch {
        setProfile(previous)
        setCityDraft(previous.city ?? '')
        showToast('Could not save that. Try again.', 'error')
      } finally {
        setSaving(false)
      }
    },
    [profile, saving, showToast]
  )

  const signOut = async () => {
    try {
      const response = await fetch('/api/auth/signout', { method: 'POST' })
      if (!response.ok) throw new Error('signout failed')
    } catch {
      // Even if the request fails, clear the browser session.
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
      } catch {
        // Nothing else to clear; the middleware will still guard the app.
      }
    }
    router.replace('/login')
    router.refresh()
  }

  const deleteAccount = async () => {
    if (deleting || deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? 'delete failed')

      // The account is gone. Clear any client-side session and leave.
      try {
        await createClient().auth.signOut()
      } catch {
        // The server already invalidated the session.
      }
      router.replace('/login')
      router.refresh()
    } catch {
      showToast('Could not delete the account. Try again.', 'error')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <section className="scr on">
        <div className="tbar">You</div>
        <div className="scroll">
          <div className="empty">
            <p className="empty-eyebrow">You</p>
            <h2>Loading your fit profile…</h2>
            <p>Pulling your sizes and stats.</p>
          </div>
        </div>
      </section>
    )
  }

  if (error || !profile) {
    return (
      <section className="scr on">
        <div className="tbar">You</div>
        <div className="scroll">
          <div className="empty">
            <p className="empty-eyebrow">Something is offline</p>
            <h2>Your profile did not load.</h2>
            <p>{error ?? 'No profile found.'}</p>
            <button type="button" className="btn pri" onClick={() => void load()}>
              Try again
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="scr on">
      <div className="tbar">You</div>
      <div className="scroll">
        <div className="lt">
          <h1 className="ttl">
            <mark className="hl">You</mark>
          </h1>
        </div>

        <div className="prof">
          <div className="av">{initials(profile.email)}</div>
          <div>
            <b>@you</b>
            <small>{profile.email || 'Signed in'}</small>
          </div>
        </div>

        <div className="stats">
          <div>
            <b>{stats.looks}</b>
            <span>looks saved</span>
          </div>
          <div>
            <b>{stats.pieces}</b>
            <span>pieces</span>
          </div>
          <div>
            <b>{stats.streak}</b>
            <span>day streak</span>
          </div>
        </div>

        <div className="gl">Fit</div>
        <div className="grp">
          <div className="rw">
            <div className="t">
              Size
              <small>Used to keep proportions consistent</small>
            </div>
            <div className="sg">
              {SIZES.map(size => (
                <button
                  key={size}
                  type="button"
                  className={profile.size === size ? 'on' : undefined}
                  onClick={() => void save({ size })}
                  aria-pressed={profile.size === size}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="gl">How you like to wear it</div>
        <div className="grp">
          {SILHOUETTES.map(option => (
            <button
              key={option.value}
              type="button"
              className={profile.silhouette === option.value ? 'rw on' : 'rw'}
              onClick={() => void save({ silhouette: option.value })}
              aria-pressed={profile.silhouette === option.value}
            >
              <div className="t">
                {option.label}
                <small>{option.hint}</small>
              </div>
              <span className="ck">
                <CheckIcon size={15} />
              </span>
            </button>
          ))}
        </div>

        <div className="gl">Weather</div>
        <div className="grp">
          <div className="rw city-row">
            <div className="t">
              City
              <small>Used for today&apos;s temperature</small>
            </div>
            <input
              value={cityDraft}
              onChange={event => setCityDraft(event.target.value)}
              placeholder="Toronto"
              aria-label="City for weather"
              className="cityinput"
            />
          </div>
        </div>
        <button
          type="button"
          className="you-save"
          disabled={saving || cityDraft.trim() === (profile.city ?? '')}
          onClick={() => void save({ city: cityDraft.trim() || null })}
        >
          {saving ? 'Saving…' : 'Save city'}
        </button>

        <div className="gl">Account</div>
        <div className="grp">
          <div className="rw">
            <div className="t">
              Email
              <small>Magic-link sign in</small>
            </div>
            <span className="v">{profile.email || '—'}</span>
          </div>
          <button type="button" className="rw danger" onClick={() => void signOut()}>
            <div className="t">Sign out</div>
          </button>
        </div>

        <div className="gl">Privacy &amp; data</div>
        <div className="grp">
          <a className="rw" href="/api/account" download>
            <div className="t">
              Download my data
              <small>Profile, closet and looks as JSON</small>
            </div>
            <span className="v">Export</span>
          </a>
          <button
            type="button"
            className="rw danger"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting}
          >
            <div className="t">
              Delete my account
              <small>Removes every piece, look and private photo</small>
            </div>
          </button>
        </div>

        {deleteOpen ? (
          <div className="grp">
            <div className="rw">
              <div className="t">
                This cannot be undone
                <small>Type DELETE to confirm</small>
              </div>
              <input
                value={deleteConfirm}
                onChange={event => setDeleteConfirm(event.target.value)}
                aria-label="Type DELETE to confirm account deletion"
                className="cityinput"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="delete-actions">
              <button
                type="button"
                className="btn sec"
                onClick={() => {
                  setDeleteOpen(false)
                  setDeleteConfirm('')
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn pri"
                onClick={() => void deleteAccount()}
                disabled={deleting || deleteConfirm !== 'DELETE'}
              >
                {deleting ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="priv">
          <LockIcon size={22} />
          <span>
            Wardrobe photos live in a private bucket and are only readable by your signed-in
            account. Item details stay private too, and Milli only ever suggests clothes you
            own. When you use AI tagging, that one photo is sent to our vision provider to
            suggest tags; background removal runs locally.
          </span>
        </div>
      </div>
    </section>
  )
}
