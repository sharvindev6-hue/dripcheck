'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Mannequin from '@/components/Mannequin'
import ItemArt from '@/components/ItemArt'
import { useToast } from '@/components/Toast'
import { HeartIcon } from '@/components/icons'
import { createClient } from '@/lib/supabase'
import { normalizeItem, normalizeOutfit } from '@/lib/items'
import { toDrawable } from '@/lib/garment'
import { addDaysLocal, getTodayLocalDateString } from '@/lib/date'
import type { Item, Outfit } from '@/types'

function localPart(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function dateLabel(date: string, today: string): string {
  if (date === today) return 'Today'
  if (date === addDaysLocal(today, -1)) return 'Yesterday'
  return localPart(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function occasionLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

export default function LooksPage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [items, setItems] = useState<Item[]>([])
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

      const [itemsResult, outfitsResult] = await Promise.all([
        supabase.from('items').select('*').eq('user_id', user.id),
        supabase
          .from('outfits')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(60),
      ])

      if (itemsResult.error || outfitsResult.error) {
        throw itemsResult.error ?? outfitsResult.error
      }

      setItems((itemsResult.data ?? []).map(row => normalizeItem(row as Record<string, unknown>)))
      setOutfits((outfitsResult.data ?? []).map(row => normalizeOutfit(row as Record<string, unknown>)))
    } catch (loadError) {
      console.error('[dripcheck:looks]', loadError)
      setError('Saved looks could not load. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  const byId = useMemo(() => new Map(items.map(item => [item.id, item])), [items])

  const saved = useMemo(
    () =>
      outfits
        .map(outfit => ({
          outfit,
          pieces: outfit.item_ids
            .map(id => byId.get(id))
            .filter((item): item is Item => Boolean(item)),
        }))
        .filter(entry => entry.pieces.length >= 3),
    [byId, outfits]
  )

  const toggleFavorite = async (outfit: Outfit) => {
    const next = !outfit.is_favorite
    setOutfits(previous =>
      previous.map(row => (row.id === outfit.id ? { ...row, is_favorite: next } : row))
    )
    try {
      const response = await fetch(`/api/outfits/${outfit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: next }),
      })
      if (!response.ok) throw new Error('favorite failed')
      showToast(next ? 'Saved to your looks.' : 'Removed from saved looks.')
    } catch {
      setOutfits(previous =>
        previous.map(row => (row.id === outfit.id ? { ...row, is_favorite: !next } : row))
      )
      showToast('Could not update that look.', 'error')
    }
  }

  return (
    <section className="scr on">
      <div className="tbar">Looks</div>
      <div className="scroll">
        <div className="lt">
          <h1 className="ttl">
            <mark className="hl">Looks</mark>
          </h1>
          <p>Saved looks, lined up. Tap one to load it back into Today.</p>
        </div>

        {loading ? (
          <div className="empty">
            <p className="empty-eyebrow">Looks</p>
            <h2>Opening the archive…</h2>
            <p>Collecting the looks you logged.</p>
          </div>
        ) : error ? (
          <div className="empty">
            <p className="empty-eyebrow">Something is offline</p>
            <h2>Saved looks did not load.</h2>
            <p>{error}</p>
            <button type="button" className="btn pri" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : saved.length === 0 ? (
          <div className="empty">
            <p className="empty-eyebrow">No looks yet</p>
            <h2>Wear something first.</h2>
            <p>When you tap “Wear this” on Today, the look lands here with its pieces and wear count.</p>
            <Link href="/" className="btn pri">
              Go to Today
            </Link>
          </div>
        ) : (
          saved.map(({ outfit, pieces }) => {
            const title = occasionLabel(outfit.occasion)
            return (
              <article className="post" key={outfit.id}>
                <div className="ph">
                  <div className="av">YO</div>
                  <div>
                    <b>@you</b>
                    <small>
                      {dateLabel(outfit.date, today)} · {title}
                    </small>
                  </div>
                </div>

                <div className="pimg">
                  <Mannequin items={pieces.map(toDrawable)} />
                  <div className="pcs">
                    {pieces.map(piece => (
                      <span key={piece.id}>
                        <ItemArt item={piece} bare />
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pa">
                  <button
                    type="button"
                    className={outfit.is_favorite ? 'hb on' : 'hb'}
                    onClick={() => void toggleFavorite(outfit)}
                    aria-label={outfit.is_favorite ? 'Remove from saved looks' : 'Save look'}
                  >
                    <HeartIcon size={26} />
                    {outfit.is_favorite ? 'Saved' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="try"
                    onClick={() => router.push(`/?look=${outfit.id}`)}
                  >
                    Try this look
                  </button>
                </div>

                <p className="cap">
                  <b>@you</b>{' '}
                  {outfit.explanation_text ||
                    `${pieces.length} pieces for ${title.toLowerCase()}.`}
                </p>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
