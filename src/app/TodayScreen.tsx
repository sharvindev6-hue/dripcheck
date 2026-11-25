'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Mannequin from '@/components/Mannequin'
import ItemArt from '@/components/ItemArt'
import ItemThumb from '@/components/ItemThumb'
import Sheet from '@/components/Sheet'
import Chat, { type ChatSeed } from '@/components/Chat'
import { useToast } from '@/components/Toast'
import { CheckIcon, SendIcon, WeatherIcon } from '@/components/icons'
import { createClient } from '@/lib/supabase'
import { normalizeItem, normalizeOutfit } from '@/lib/items'
import { useSignedImages, imageFor } from '@/lib/useSignedImages'
import { buildStats, itemCostPerWear } from '@/lib/stats'
import { addDaysLocal, getTodayLocalDateString } from '@/lib/date'
import {
  CATEGORY_TO_SLOT,
  SLOT_LABEL,
  colorHex,
  toDrawable,
  type GarmentSlot,
} from '@/lib/garment'
import {
  comboFromIds,
  explainOutfit,
  generateOutfit,
  matchPercent,
  scoreCombo,
  type EngineOptions,
  type SilhouettePreference,
} from '@/lib/outfitEngine'
import type { Item, Outfit } from '@/types'

interface LookState {
  itemIds: string[]
  explanation: string
  match: number
  source: 'ai' | 'rules'
  occasion: string
  wasWorn: boolean
}

interface Weather {
  temp: number
  condition: string
  city: string
}

interface Profile {
  city: string | null
  silhouette: SilhouettePreference
  size: string | null
}

const ORDER: Record<GarmentSlot, number> = { outer: 0, top: 1, bottom: 2, shoes: 3 }
const LABEL_POS: Record<GarmentSlot, [number, number]> = {
  outer: [148, 92],
  top: [140, 150],
  bottom: [126, 236],
  shoes: [118, 347],
}
const WEATHER_TTL_MS = 30 * 60 * 1000

function localPart(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function weekdayShort(date: string): string {
  return localPart(date).toLocaleDateString('en-US', { weekday: 'short' })
}

function weekdayNarrow(date: string): string {
  return localPart(date).toLocaleDateString('en-US', { weekday: 'narrow' })
}

function dateHeading(date: string): string {
  return localPart(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function occasionLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function lookTitle(temp: number | null, condition: string, occasion: string): string {
  const weather = condition.toLowerCase()
  if (/rain|drizzle|storm|shower/.test(weather)) return 'Rain-ready'
  if (temp != null && temp < 12) return 'Cold front'
  if (temp != null && temp > 24) return 'Heatwave'
  if (occasion === 'interview') return 'Sharp focus'
  if (occasion === 'date_night') return 'Night out'
  if (occasion === 'formal') return 'Dressed up'
  return 'Easy day'
}

function buildLocalLook(
  items: Item[],
  temp: number | null,
  occasion: string,
  options: EngineOptions,
  seedItemId?: string | null
): LookState | null {
  const combo = generateOutfit(items, temp, occasion, { ...options, seedItemId: seedItemId ?? null })
  if (!combo) return null
  return {
    itemIds: [
      combo.top.id,
      combo.bottom.id,
      combo.shoes.id,
      ...(combo.outerwear ? [combo.outerwear.id] : []),
    ],
    explanation: explainOutfit(combo, temp, occasion),
    match: matchPercent(combo.score),
    source: 'rules',
    occasion,
    wasWorn: false,
  }
}

async function loadWeather(city: string): Promise<Weather | null> {
  const cacheKey = `dripcheck.weather:${city.toLowerCase()}`
  try {
    const raw = sessionStorage.getItem(cacheKey)
    if (raw) {
      const cached = JSON.parse(raw) as { at: number; weather: Weather }
      if (Date.now() - cached.at < WEATHER_TTL_MS && typeof cached.weather?.temp === 'number') {
        return cached.weather
      }
    }
  } catch {
    // Ignore corrupt cache and refetch.
  }

  try {
    const response = await fetch('/api/weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city }),
    })
    if (!response.ok) return null
    const data = await response.json()
    if (typeof data.temp !== 'number') return null
    const weather: Weather = {
      temp: data.temp,
      condition: String(data.condition ?? ''),
      city: String(data.city ?? city),
    }
    sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), weather }))
    return weather
  } catch {
    return null
  }
}

export default function TodayScreen() {
  const router = useRouter()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [fatal, setFatal] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [profile, setProfile] = useState<Profile>({ city: null, silhouette: null, size: null })
  const [weather, setWeather] = useState<Weather | null>(null)
  const [look, setLook] = useState<LookState | null>(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ask, setAsk] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [seed, setSeed] = useState<ChatSeed | null>(null)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [highlight, setHighlight] = useState<GarmentSlot | null>(null)
  const [weekPreview, setWeekPreview] = useState<{
    date: string
    ids: string[]
    explanation: string
    occasion: string
  } | null>(null)
  const [dateLabel, setDateLabel] = useState('')

  const today = getTodayLocalDateString()
  const signedImages = useSignedImages(items)

  useEffect(() => {
    setDateLabel(
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    )
  }, [])

  const engineOptions = useMemo<EngineOptions>(
    () => ({
      recentItemIds: Array.from(new Set(outfits.slice(-3).flatMap(outfit => outfit.item_ids))),
      recentCombos: outfits.slice(-3).map(outfit => outfit.item_ids),
      silhouette: profile.silhouette,
    }),
    [outfits, profile.silhouette]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setFatal(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const [itemsResult, outfitsResult, profileResult] = await Promise.all([
        supabase.from('items').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('outfits').select('*').eq('user_id', user.id).order('date', { ascending: true }),
        supabase.from('users').select('*').eq('id', user.id).maybeSingle(),
      ])

      if (itemsResult.error || outfitsResult.error) {
        throw itemsResult.error ?? outfitsResult.error
      }

      const nextItems = (itemsResult.data ?? []).map(row => normalizeItem(row as Record<string, unknown>))
      const nextOutfits = (outfitsResult.data ?? []).map(row => normalizeOutfit(row as Record<string, unknown>))
      const rawProfile = profileResult.data
      const nextProfile: Profile = {
        city: typeof rawProfile?.city === 'string' ? rawProfile.city : null,
        silhouette:
          rawProfile?.silhouette === 'tailored' ||
          rawProfile?.silhouette === 'relaxed' ||
          rawProfile?.silhouette === 'oversized'
            ? rawProfile.silhouette
            : null,
        size: typeof rawProfile?.size === 'string' ? rawProfile.size : null,
      }

      setItems(nextItems)
      setOutfits(nextOutfits)
      setProfile(nextProfile)

      const nextWeather = await loadWeather(nextProfile.city ?? 'Toronto')
      setWeather(nextWeather)
      const temp = nextWeather?.temp ?? null

      const nextOptions: EngineOptions = {
        recentItemIds: Array.from(new Set(nextOutfits.slice(-3).flatMap(outfit => outfit.item_ids))),
        recentCombos: nextOutfits.slice(-3).map(outfit => outfit.item_ids),
        silhouette: nextProfile.silhouette,
      }

      const byId = new Map(nextItems.map(item => [item.id, item]))
      const validIds = (ids: string[]) => ids.filter(id => byId.has(id))
      const params =
        typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
      const aroundId = params.get('around')
      const requestedLookId = params.get('look')
      const requestedLook = requestedLookId
        ? nextOutfits.find(outfit => outfit.id === requestedLookId)
        : undefined
      const todayOutfit = nextOutfits.find(outfit => outfit.date === today)

      if (requestedLook) {
        const ids = validIds(requestedLook.item_ids)
        const combo = comboFromIds(nextItems, ids)
        if (ids.length >= 3 && combo) {
          setLook({
            itemIds: ids,
            explanation:
              requestedLook.explanation_text ||
              explainOutfit(combo, requestedLook.weather_temp, requestedLook.occasion),
            match: matchPercent(
              scoreCombo(combo.top, combo.bottom, combo.shoes, combo.outerwear, requestedLook.weather_temp, requestedLook.occasion)
            ),
            source: requestedLook.generated_by,
            occasion: requestedLook.occasion,
            wasWorn: false,
          })
        } else {
          setLook(buildLocalLook(nextItems, temp, 'casual', nextOptions))
        }
      } else if (aroundId && byId.has(aroundId)) {
        setLook(buildLocalLook(nextItems, temp, 'casual', nextOptions, aroundId))
      } else if (todayOutfit) {
        const ids = validIds(todayOutfit.item_ids)
        const combo = comboFromIds(nextItems, ids)
        if (ids.length >= 3 && combo) {
          setLook({
            itemIds: ids,
            explanation:
              todayOutfit.explanation_text || explainOutfit(combo, todayOutfit.weather_temp, todayOutfit.occasion),
            match: matchPercent(
              scoreCombo(combo.top, combo.bottom, combo.shoes, combo.outerwear, todayOutfit.weather_temp, todayOutfit.occasion)
            ),
            source: todayOutfit.generated_by,
            occasion: todayOutfit.occasion,
            wasWorn: todayOutfit.was_worn,
          })
        } else {
          setLook(buildLocalLook(nextItems, temp, 'casual', nextOptions))
        }
      } else {
        setLook(buildLocalLook(nextItems, temp, 'casual', nextOptions))
      }
    } catch (error) {
      console.error('[dripcheck:today]', error)
      setFatal('Your closet could not load. Check the Supabase setup and try again.')
    } finally {
      setLoading(false)
    }
  }, [router, today])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => buildStats(items, outfits, today), [items, outfits, today])

  const pieceMap = useMemo(() => new Map(items.map(item => [item.id, item])), [items])
  const pieces = useMemo(
    () =>
      (look?.itemIds ?? [])
        .map(id => pieceMap.get(id))
        .filter((item): item is Item => Boolean(item)),
    [look, pieceMap]
  )
  const drawables = useMemo(() => pieces.map(toDrawable), [pieces])
  const orderedPieces = useMemo(
    () =>
      [...pieces].sort(
        (a, b) =>
          ORDER[CATEGORY_TO_SLOT[a.category] ?? 'top'] - ORDER[CATEGORY_TO_SLOT[b.category] ?? 'top']
      ),
    [pieces]
  )
  const hasOuter = pieces.some(item => item.category === 'outerwear')

  const weekDays = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) => addDaysLocal(today, index - 4)).map(date => ({
        date,
        outfit: outfits.find(outfit => outfit.date === date) ?? null,
      })),
    [outfits, today]
  )

  const streakDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => addDaysLocal(today, index - 6)).map(date => ({
        date,
        letter: weekdayNarrow(date),
        worn: outfits.find(outfit => outfit.date === date)?.was_worn === true,
      })),
    [outfits, today]
  )

  const title = lookTitle(weather?.temp ?? null, weather?.condition ?? '', look?.occasion ?? 'casual')

  const applyLook = useCallback(
    (
      ids: string[],
      explanation: string,
      match: number,
      occasion?: string,
      source: 'ai' | 'rules' = 'rules'
    ) => {
      const valid = ids.filter(id => pieceMap.has(id))
      if (valid.length < 3) return
      setLook(previous => ({
        itemIds: valid,
        explanation,
        match,
        source,
        occasion: occasion ?? previous?.occasion ?? 'casual',
        wasWorn: false,
      }))
    },
    [pieceMap]
  )

  const another = useCallback(async () => {
    if (busy) return
    if (items.filter(item => item.status !== 'dirty').length < 4) {
      showToast('Add another piece so I have something to swap in.', 'error')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occasion: look?.occasion ?? 'casual',
          temp: weather?.temp ?? null,
        }),
      })
      const data = response.ok ? await response.json().catch(() => null) : null
      if (data && Array.isArray(data.item_ids) && data.item_ids.length >= 3) {
        applyLook(
          data.item_ids,
          String(data.explanation ?? ''),
          Number(data.match ?? 88),
          data.occasion,
          data.source === 'ai' ? 'ai' : 'rules'
        )
        return
      }
      const fallback = buildLocalLook(
        items,
        weather?.temp ?? null,
        look?.occasion ?? 'casual',
        engineOptions
      )
      if (fallback) setLook(fallback)
      else showToast('No complete look is possible yet. Add a top, bottom and shoes.', 'error')
    } catch {
      const fallback = buildLocalLook(
        items,
        weather?.temp ?? null,
        look?.occasion ?? 'casual',
        engineOptions
      )
      if (fallback) setLook(fallback)
      else showToast('Could not style another look. Try again.', 'error')
    } finally {
      setBusy(false)
    }
  }, [applyLook, busy, engineOptions, items, look?.occasion, showToast, weather?.temp])

  const wear = useCallback(async () => {
    if (!look || saving) return
    if (look.wasWorn) {
      showToast('Already logged for today.')
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/outfits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          occasion: look.occasion,
          weather_temp: weather?.temp ?? null,
          item_ids: look.itemIds,
          explanation_text: look.explanation,
          generated_by: look.source,
          was_worn: true,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.outfit) {
        showToast(
          response.status === 400
            ? 'That look is missing a slot. Regenerate and try again.'
            : 'Could not log the look. Try again.',
          'error'
        )
        return
      }
      const saved = normalizeOutfit(data.outfit as Record<string, unknown>)
      setOutfits(previous =>
        [...previous.filter(outfit => outfit.date !== saved.date), saved].sort((a, b) =>
          a.date.localeCompare(b.date)
        )
      )
      setLook(previous => (previous ? { ...previous, wasWorn: true } : previous))

      const replaced = outfits.find(outfit => outfit.date === today)
      const replacedIds = new Set(replaced?.item_ids ?? [])
      const increments = new Set(
        replaced?.was_worn
          ? look.itemIds.filter(id => !replacedIds.has(id))
          : look.itemIds
      )
      const decrements = new Set(
        replaced?.was_worn
          ? replaced.item_ids.filter(id => !look.itemIds.includes(id))
          : []
      )

      setItems(previous =>
        previous.map(item => {
          let times = item.times_worn ?? 0
          if (increments.has(item.id)) times += 1
          if (decrements.has(item.id)) times = Math.max(0, times - 1)
          if (times === (item.times_worn ?? 0)) return item
          return {
            ...item,
            times_worn: times,
            last_worn: increments.has(item.id) ? today : item.last_worn,
          }
        })
      )
      showToast('Logged for today.')
    } catch {
      showToast('Could not reach the server. Try again.', 'error')
    } finally {
      setSaving(false)
    }
  }, [look, outfits, saving, showToast, today, weather?.temp])

  const toggleWash = useCallback(
    async (item: Item) => {
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
        setSelectedItem(previous =>
          previous && previous.id === item.id ? { ...previous, status: nextStatus } : previous
        )
        showToast(nextStatus === 'dirty' ? 'Sent to the wash.' : 'Back in rotation.')
      } catch {
        showToast('Could not update that piece.', 'error')
      }
    },
    [showToast]
  )

  const openItem = useCallback((item: Item) => {
    setSelectedItem(item)
    setHighlight(CATEGORY_TO_SLOT[item.category] ?? 'top')
  }, [])

  const closeItem = useCallback(() => {
    setSelectedItem(null)
    setHighlight(null)
  }, [])

  const openChat = useCallback((text?: string) => {
    if (text) setSeed({ id: Date.now(), text })
    setChatOpen(true)
  }, [])

  if (loading) {
    return (
      <section className="scr on">
        <div className="tbar">Today</div>
        <div className="scroll">
          <div className="empty">
            <p className="empty-eyebrow">DripCheck</p>
            <h2>Styling your day…</h2>
            <p>Reading your closet and the weather.</p>
          </div>
        </div>
      </section>
    )
  }

  if (fatal) {
    return (
      <section className="scr on">
        <div className="tbar">Today</div>
        <div className="scroll">
          <div className="empty">
            <p className="empty-eyebrow">Something is offline</p>
            <h2>Your closet did not load.</h2>
            <p>{fatal}</p>
            <button type="button" className="btn pri" onClick={() => void load()}>
              Try again
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="scr on">
        <div className="tbar">Today</div>
        <div className="scroll">
          <header className="hd">
            <p className="meta">
              <span>{dateLabel}</span>
              <span>
                <WeatherIcon size={20} />
                {weather ? `${weather.temp}° ${weather.condition}` : 'Weather offline'}
              </span>
            </p>
            <div className="h1m">
              <h1>
                <span>
                  <mark className="hl">{title}</mark>
                </span>
              </h1>
            </div>
            <p className="why">
              {look?.explanation ||
                'Add a top, bottom and shoes and I will build a complete look from your closet.'}
            </p>
          </header>

          {look && pieces.length >= 3 ? (
            <>
              <div className="stage">
                <div className="sp">
                  <span>{look.wasWorn ? 'Worn today' : 'Today'}</span>
                  <span id="mt">{look.match}% match</span>
                </div>
                <div className="rail">
                  <Mannequin items={drawables} />
                  <div className="labels">
                    {orderedPieces.map((item, index) => {
                      const slot = CATEGORY_TO_SLOT[item.category] ?? 'top'
                      const [x, baseY] = LABEL_POS[slot]
                      const y = slot === 'top' && !hasOuter ? 108 : baseY
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="lb"
                          onClick={() => openItem(item)}
                          style={
                            {
                              '--y': y,
                              '--k': ((200 - x) / 372).toFixed(4),
                              '--d': `${0.2 + index * 0.1}s`,
                              '--c': item.color_hex ?? colorHex(item.primary_color),
                            } as CSSProperties
                          }
                        >
                          <i className="ln" />
                          <span className="sw" />
                          <span>
                            <b>{item.name}</b>
                            <small>{SLOT_LABEL[slot]}</small>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="acts">
                <button
                  type="button"
                  className={look.wasWorn ? 'btn pri done' : 'btn pri'}
                  onClick={() => void wear()}
                  disabled={saving}
                >
                  <CheckIcon size={20} />
                  <span>{saving ? 'Logging…' : look.wasWorn ? 'Worn today' : 'Wear this'}</span>
                </button>
                <button type="button" className="btn sec" onClick={() => void another()} disabled={busy}>
                  {busy ? 'Styling…' : 'Another'}
                </button>
              </div>
            </>
          ) : (
            <div className="empty">
              <p className="empty-eyebrow">Build the base</p>
              <h2>Three pieces and I can start.</h2>
              <p>
                Add at least one top, one bottom and one pair of shoes. Outerwear joins the rotation
                automatically when the weather calls for it.
              </p>
              <Link href="/add" className="btn pri">
                Add clothes
              </Link>
            </div>
          )}

          <div className="ask">
            <form
              className="askf"
              onSubmit={event => {
                event.preventDefault()
                const text = ask.trim()
                if (!text) return
                setAsk('')
                openChat(text)
              }}
            >
              <input
                value={ask}
                onChange={event => setAsk(event.target.value)}
                placeholder="Ask your stylist for a change"
                autoComplete="off"
                enterKeyHint="send"
                aria-label="Ask your stylist"
              />
              <button className="snd" type="submit" aria-label="Send">
                <SendIcon size={20} />
              </button>
            </form>
            <div className="prm">
              {['Warmer', 'Dressier', 'More casual', 'Swap shoes', 'All black'].map(prompt => (
                <button key={prompt} type="button" onClick={() => openChat(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {look && pieces.length >= 3 ? (
            <>
              <div className="sech">
                <h2>Piece by piece</h2>
                <p>{pieces.length} pieces, each picked for today.</p>
              </div>
              <div className={highlight ? 'pbw dim' : 'pbw'}>
                <div className="pbl">
                  {orderedPieces.map(item => {
                    const slot = CATEGORY_TO_SLOT[item.category] ?? 'top'
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={highlight === slot ? 'pb in act' : 'pb in'}
                        onClick={() => openItem(item)}
                        onMouseEnter={() => setHighlight(slot)}
                        onMouseLeave={() => setHighlight(null)}
                      >
                        <div className="art">
                          <ItemArt item={item} />
                        </div>
                        <h3>{item.name}</h3>
                        <span className="no">
                          {item.category} · {item.fit ?? 'regular'} fit
                        </span>
                        <p>
                          {item.primary_color} {item.category}
                          {item.price != null ? ` · $${item.price.toFixed(2)}` : ''}
                        </p>
                      </button>
                    )
                  })}
                </div>
                <div className="pbf">
                  <div style={{ height: '100%', aspectRatio: '200 / 372', margin: '0 auto' }}>
                    <Mannequin items={drawables} highlight={highlight} className="avfill" />
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <div className="sech">
            <h2>This week</h2>
            <p>Tap a day to preview it.</p>
          </div>
          <div className="wl">
            {weekDays.map(({ date, outfit }) => (
              <button
                key={date}
                type="button"
                className={date === today ? 'wr on' : 'wr'}
                onClick={() => {
                  if (!outfit) {
                    showToast('No look saved for that day.')
                    return
                  }
                  setWeekPreview({
                    date,
                    ids: outfit.item_ids,
                    explanation: outfit.explanation_text ?? '',
                    occasion: outfit.occasion,
                  })
                }}
              >
                <span className="dn">{weekdayShort(date)}</span>
                <span className="tp">
                  <WeatherIcon size={20} />
                  {outfit?.weather_temp != null ? `${outfit.weather_temp}°` : '—'}
                </span>
                <span className="nm">{outfit ? occasionLabel(outfit.occasion) : 'No look'}</span>
                <span className="mt">
                  {outfit?.item_ids.slice(0, 3).map(id => {
                    const item = pieceMap.get(id)
                    return item ? (
                      <span key={id}>
                        <ItemArt item={item} bare />
                      </span>
                    ) : null
                  })}
                </span>
              </button>
            ))}
          </div>

          <div className="sech">
            <h2>Streak</h2>
          </div>
          <div className="stk">
            <div className="n">
              <b>{stats.streak}</b>
              <span>{stats.streak === 1 ? 'day in a row' : 'days in a row'}</span>
            </div>
            <div className="sd">
              {streakDays.map(day => (
                <i
                  key={day.date}
                  className={`${day.worn ? 'on' : ''}${day.date === today ? ' td' : ''}`.trim()}
                >
                  {day.letter}
                </i>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Chat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        items={items}
        itemIds={look?.itemIds ?? []}
        temp={weather?.temp ?? null}
        condition={weather?.condition ?? ''}
        lookName={title}
        seed={seed}
        onSeedConsumed={() => setSeed(null)}
        onLookChange={applyLook}
      />

      <Sheet open={Boolean(selectedItem)} onClose={closeItem} title={selectedItem?.name}>
        {selectedItem ? (
          <>
            <div className="art">
              <ItemThumb item={selectedItem} src={imageFor(selectedItem, signedImages)} />
            </div>
            <div className="grp">
              <div className="rw">
                <div className="t">Category</div>
                <span className="v" style={{ textTransform: 'capitalize' }}>
                  {selectedItem.category}
                </span>
              </div>
              <div className="rw">
                <div className="t">Fit</div>
                <span className="v" style={{ textTransform: 'capitalize' }}>
                  {selectedItem.fit ?? 'regular'}
                </span>
              </div>
              <div className="rw">
                <div className="t">Warmth</div>
                <span className="v" style={{ textTransform: 'capitalize' }}>
                  {selectedItem.warmth}
                </span>
              </div>
              <div className="rw">
                <div className="t">Price</div>
                <span className="v">
                  {selectedItem.price != null ? `$${selectedItem.price.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="rw">
                <div className="t">
                  Cost per wear
                  <small>
                    {selectedItem.times_worn > 0
                      ? `${selectedItem.times_worn} wear${selectedItem.times_worn === 1 ? '' : 's'}`
                      : 'Not worn yet'}
                  </small>
                </div>
                <span className="v">
                  {itemCostPerWear(selectedItem) != null
                    ? `$${itemCostPerWear(selectedItem)!.toFixed(2)}`
                    : '—'}
                </span>
              </div>
              <button type="button" className="rw" onClick={() => void toggleWash(selectedItem)}>
                <div className="t">In the wash</div>
                <span className={selectedItem.status === 'dirty' ? 'sw2 on' : 'sw2'} />
              </button>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (selectedItem.status === 'dirty') {
                  showToast('That piece is in the wash. Mark it clean first.', 'error')
                  return
                }
                const generated = buildLocalLook(
                  items,
                  weather?.temp ?? null,
                  look?.occasion ?? 'casual',
                  engineOptions,
                  selectedItem.id
                )
                if (!generated) {
                  showToast('Add more pieces to build around this one.', 'error')
                  return
                }
                setLook(generated)
                closeItem()
                showToast('Built a look around this piece.')
              }}
            >
              Build a look around this
            </button>
          </>
        ) : null}
      </Sheet>

      <Sheet
        open={Boolean(weekPreview)}
        onClose={() => setWeekPreview(null)}
        title={weekPreview ? dateHeading(weekPreview.date) : undefined}
      >
        {weekPreview ? (
          <>
            <div className="week-preview">
              <Mannequin
                items={weekPreview.ids
                  .map(id => pieceMap.get(id))
                  .filter((item): item is Item => Boolean(item))
                  .map(toDrawable)}
              />
            </div>
            <p className="week-why">{weekPreview.explanation || 'Saved look.'}</p>
            <div className="grp">
              {weekPreview.ids.map(id => {
                const item = pieceMap.get(id)
                if (!item) return null
                return (
                  <div key={id} className="rw">
                    <div className="t">{item.name}</div>
                    <span className="v" style={{ textTransform: 'capitalize' }}>
                      {item.category}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        ) : null}
      </Sheet>
    </>
  )
}
