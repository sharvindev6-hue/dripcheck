'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ItemThumb from '@/components/ItemThumb'
import Sheet from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { SearchIcon } from '@/components/icons'
import { createClient } from '@/lib/supabase'
import { normalizeItem } from '@/lib/items'
import { imageFor, useSignedImages } from '@/lib/useSignedImages'
import { itemCostPerWear } from '@/lib/stats'
import type { Item } from '@/types'

type Filter = 'all' | Item['category']

const FILTERS: Filter[] = ['all', 'top', 'bottom', 'outerwear', 'shoes']

export default function ClosetPage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const signed = useSignedImages(items)
  const selected = items.find(item => item.id === selectedId) ?? null

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
      const { data, error: queryError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (queryError) throw queryError
      setItems((data ?? []).map(row => normalizeItem(row as Record<string, unknown>)))
    } catch (loadError) {
      console.error('[dripcheck:closet]', loadError)
      setError('Your closet could not load. Check the Supabase setup and try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: items.length }
    for (const item of items) map[item.category] = (map[item.category] ?? 0) + 1
    return map
  }, [items])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter(item => {
      if (filter !== 'all' && item.category !== filter) return false
      if (!needle) return true
      return (
        item.name.toLowerCase().includes(needle) ||
        item.primary_color.toLowerCase().includes(needle) ||
        item.category.includes(needle)
      )
    })
  }, [filter, items, query])

  const washCount = items.filter(item => item.status === 'dirty').length

  const toggleWash = async (item: Item) => {
    const nextStatus = item.status === 'dirty' ? 'clean' : 'dirty'
    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!response.ok) throw new Error('patch failed')
      setItems(previous =>
        previous.map(row => (row.id === item.id ? { ...row, status: nextStatus } : row))
      )
      showToast(nextStatus === 'dirty' ? 'Sent to the wash.' : 'Back in rotation.')
    } catch {
      showToast('Could not update that piece.', 'error')
    }
  }

  const remove = async (item: Item) => {
    if (!window.confirm(`Remove "${item.name}" from your closet? Its photo is deleted too.`)) {
      return
    }
    try {
      const response = await fetch(`/api/items/${item.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('delete failed')
      setItems(previous => previous.filter(row => row.id !== item.id))
      setSelectedId(null)
      showToast('Removed from your closet.')
    } catch {
      showToast('Could not remove that piece.', 'error')
    }
  }

  return (
    <section className="scr on">
      <div className="tbar">Closet</div>
      <div className="scroll">
        <div className="lt">
          <div className="ltrow">
            <h1 className="ttl">
              <mark className="hl">Closet</mark>
            </h1>
            <Link href="/add" className="try">
              + Add
            </Link>
          </div>
          <p>
            {items.length} {items.length === 1 ? 'piece' : 'pieces'}
            {washCount > 0 ? `, ${washCount} in the wash` : ''}. Tap one to see it up close.
          </p>
        </div>

        <label className="sr0">
          <SearchIcon size={20} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search your closet"
            autoComplete="off"
            aria-label="Search your closet"
          />
        </label>

        <div className="tabs2">
          {FILTERS.map(value => (
            <button
              key={value}
              type="button"
              className={filter === value ? 'on' : undefined}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? 'All' : value[0].toUpperCase() + value.slice(1)}
              <b>{counts[value] ?? 0}</b>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty">
            <p className="empty-eyebrow">Closet</p>
            <h2>Loading your pieces…</h2>
            <p>Reading the rail.</p>
          </div>
        ) : error ? (
          <div className="empty">
            <p className="empty-eyebrow">Something is offline</p>
            <h2>Your closet did not load.</h2>
            <p>{error}</p>
            <button type="button" className="btn pri" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="empty">
            <p className="empty-eyebrow">Empty rail</p>
            <h2>Your closet is waiting.</h2>
            <p>Add a few pieces and Milli starts building complete looks from what you own.</p>
            <Link href="/add" className="btn pri">
              Add your first piece
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <p className="empty-eyebrow">No matches</p>
            <h2>Nothing on this rail.</h2>
            <p>Try another category or a shorter search.</p>
            <button
              type="button"
              className="btn pri"
              onClick={() => {
                setQuery('')
                setFilter('all')
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="g2">
            {visible.map(item => (
              <button
                key={item.id}
                type="button"
                className={item.status === 'dirty' ? 'tile dirty' : 'tile'}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="art">
                  {item.status === 'dirty' ? <span className="bd">Wash</span> : null}
                  <ItemThumb item={item} src={imageFor(item, signed)} />
                </div>
                <b>{item.name}</b>
                <small>
                  {item.category} · {item.fit ?? 'regular'}
                </small>
              </button>
            ))}
          </div>
        )}
      </div>

      <Sheet open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected?.name}>
        {selected ? (
          <>
            <div className="art">
              <ItemThumb item={selected} src={imageFor(selected, signed)} />
            </div>
            <div className="grp">
              <div className="rw">
                <div className="t">Category</div>
                <span className="v" style={{ textTransform: 'capitalize' }}>
                  {selected.category}
                </span>
              </div>
              <div className="rw">
                <div className="t">Fit</div>
                <span className="v" style={{ textTransform: 'capitalize' }}>
                  {selected.fit ?? 'regular'}
                </span>
              </div>
              <div className="rw">
                <div className="t">Warmth</div>
                <span className="v" style={{ textTransform: 'capitalize' }}>
                  {selected.warmth}
                </span>
              </div>
              <div className="rw">
                <div className="t">Colour</div>
                <span className="v">
                  <span
                    className="dot"
                    style={{ background: selected.color_hex ?? '#A8A6A1', display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }}
                  />
                  {selected.primary_color}
                </span>
              </div>
              <div className="rw">
                <div className="t">Price</div>
                <span className="v">{selected.price != null ? `$${selected.price.toFixed(2)}` : '—'}</span>
              </div>
              <div className="rw">
                <div className="t">
                  Cost per wear
                  <small>
                    {selected.times_worn > 0
                      ? `${selected.times_worn} wear${selected.times_worn === 1 ? '' : 's'}`
                      : 'Not worn yet'}
                  </small>
                </div>
                <span className="v">
                  {itemCostPerWear(selected) != null ? `$${itemCostPerWear(selected)!.toFixed(2)}` : '—'}
                </span>
              </div>
              <button type="button" className="rw" onClick={() => void toggleWash(selected)}>
                <div className="t">In the wash</div>
                <span className={selected.status === 'dirty' ? 'sw2 on' : 'sw2'} />
              </button>
            </div>

            {selected.status === 'dirty' ? (
              <p className="week-why">This piece is in the wash. Mark it clean before building a look around it.</p>
            ) : (
              <Link href={`/?around=${selected.id}`} className="btn" onClick={() => setSelectedId(null)}>
                Build a look around this
              </Link>
            )}

            <div className="sheet-actions">
              <button type="button" className="rw danger" onClick={() => void remove(selected)}>
                <div className="t">Remove from closet</div>
              </button>
            </div>

          </>
        ) : null}
      </Sheet>
    </section>
  )
}
