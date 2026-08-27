'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Item, Outfit } from '@/types'
import Navbar from '@/components/Navbar'
import { useToast } from '@/components/Toast'
import { OCCASIONS, getOccasionTarget, type OccasionValue } from '@/lib/constants'
import { generateOutfit as generateOutfitLocal, getTemplateExplanation } from '@/lib/outfitEngine'
import { getTodayLocalDateString } from '@/lib/date'
import Image from 'next/image'
import { MilliAvatar, EmptySparkles } from '@/components/icons'

// Item-id slot order inside an outfits.item_ids array. Kept as constants so
// rehydrating a saved outfit never relies on fragile positional indexing.
const TOP_IDX    = 0
const BOTTOM_IDX = 1
const SHOES_IDX  = 2
const OUTER_IDX  = 3

const WEATHER_CACHE_KEY = 'dripcheck_weather'
const WEATHER_CACHE_TS  = 'dripcheck_weather_ts'
const WEATHER_TTL_MS    = 30 * 60 * 1000 // 30 min — OpenWeather free-tier friendly

interface OutfitDisplay {
  top: Item
  bottom: Item
  shoes: Item
  outerwear?: Item
}

interface WeatherSnapshot {
  temp: number
  condition: string
  city: string
}

const supabase = createClient()

export default function OutfitPage() {
  const [items, setItems] = useState<Item[]>([])
  const [todaysOutfit, setTodaysOutfit] = useState<OutfitDisplay | null>(null)
  const [outfitSource, setOutfitSource] = useState<'ai' | 'rules' | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [weatherTemp, setWeatherTemp] = useState<number | null>(20)
  const [occasion, setOccasion] = useState<OccasionValue>('casual')
  const [explanation, setExplanation] = useState('')
  const [saving, setSaving] = useState(false)
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null)
  const { showToast } = useToast()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // Load items
    const { data: itemsData } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', user.id)

    if (itemsData) setItems(itemsData)

    // Load today's saved outfit, if any
    const today = getTodayLocalDateString()
    const { data: existing } = await supabase
      .from('outfits')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()

    if (existing && Array.isArray(existing.item_ids) && existing.item_ids.length >= 3) {
      // ONE query for every item referenced in the saved outfit — fixes the
      // previous N+1 (one .single() per id). Build a map and destructure by
      // the explicit index constants above.
      const { data: rows } = await supabase
        .from('items')
        .select('*')
        .in('id', existing.item_ids)
      const byId = new Map((rows ?? []).map(r => [r.id as string, r as Item]))

      const top    = byId.get(existing.item_ids[TOP_IDX])
      const bottom = byId.get(existing.item_ids[BOTTOM_IDX])
      const shoes  = byId.get(existing.item_ids[SHOES_IDX])
      const outer  = byId.get(existing.item_ids[OUTER_IDX])

      if (top && bottom && shoes) {
        setTodaysOutfit({ top, bottom, shoes, outerwear: outer ?? undefined })
        setExplanation(existing.explanation_text || '')
        setOutfitSource((existing.generated_by as 'ai' | 'rules') || 'rules')
      }
    }

    setLoading(false)
  }, [])

  // Auto-fetch weather once on mount. Cache for 30 min in sessionStorage so
  // we don't hammer OpenWeather on every navigation. Any failure silently
  // keeps the manual temperature input usable.
  useEffect(() => {
    const cached = sessionStorage.getItem(WEATHER_CACHE_KEY)
    const cachedTs = sessionStorage.getItem(WEATHER_CACHE_TS)
    if (cached && cachedTs) {
      const age = Date.now() - Number(cachedTs)
      if (Number.isFinite(age) && age < WEATHER_TTL_MS) {
        try {
          const snap = JSON.parse(cached) as WeatherSnapshot
          if (typeof snap.temp === 'number') {
            setWeather(snap)
            setWeatherTemp(snap.temp)
            return
          }
        } catch {/* fall through to network fetch */}
      }
    }
    fetch('/api/weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: 'Toronto' }),
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: WeatherSnapshot | null) => {
        if (data && typeof data.temp === 'number') {
          setWeather(data)
          setWeatherTemp(data.temp)
          sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data))
          sessionStorage.setItem(WEATHER_CACHE_TS, String(Date.now()))
        }
      })
      .catch(() => { /* silent: keep manual input */ })
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const generateNewOutfit = async () => {
    if (items.length < 3) {
      showToast('Need at least 3 items to generate!', 'error')
      return
    }
    setGenerating(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Real yesterday's-items query (replaces the hardcoded []).
      // Falls back to [] on any failure so generation still works.
      let yesterdayItems: string[] = []
      try {
        const { data: lastOutfit } = await supabase
          .from('outfits')
          .select('item_ids')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (lastOutfit?.item_ids) yesterdayItems = lastOutfit.item_ids
      } catch {/* no prior outfit — that's fine */}
      // (yesterdayItems is consumed by /api/stylist via the recent_combinations
      //  lookup on the server — kept here as documentation of the data flow.)
      void yesterdayItems

      // Try the AI stylist first. ANY failure — non-ok response, network
      // error, malformed payload, or missing item ids — falls through to a
      // local rules-engine run. The user always sees an outfit.
      let data: { source?: 'ai' | 'rules'; item_ids?: string[]; explanation?: string; error?: string } | null = null
      try {
        const r = await fetch('/api/stylist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ occasion, temp: weatherTemp, note: '' }),
        })
        if (r.ok) {
          data = await r.json()
        }
      } catch {
        // network/timeout — data stays null and we fall through to local rules
      }

      // Hydrate the returned ids against the items we already loaded — no extra DB roundtrip.
      const byId = new Map(items.map(i => [i.id, i]))
      let top: Item | undefined
      let bottom: Item | undefined
      let shoes: Item | undefined
      let outer: Item | undefined
      let explanationText = ''
      let source: 'ai' | 'rules' = 'rules'

      if (data && Array.isArray(data.item_ids) && data.item_ids.length >= 3) {
        top    = byId.get(data.item_ids[TOP_IDX])
        bottom = byId.get(data.item_ids[BOTTOM_IDX])
        shoes  = byId.get(data.item_ids[SHOES_IDX])
        outer  = data.item_ids[OUTER_IDX] ? byId.get(data.item_ids[OUTER_IDX]) : undefined
        explanationText = data.explanation || ''
        source = data.source === 'ai' ? 'ai' : 'rules'
      }

      // Fallback: local rules engine when AI path produced nothing usable.
      if (!top || !bottom || !shoes) {
        const combo = generateOutfitLocal(items, weatherTemp, occasion, yesterdayItems)
        if (!combo) {
          showToast('No combo works — add more variety!', 'error')
          return
        }
        top    = combo.top
        bottom = combo.bottom
        shoes  = combo.shoes
        outer  = combo.outerwear
        explanationText = getTemplateExplanation(combo)
        source = 'rules'
      }

      setTodaysOutfit({ top, bottom, shoes, outerwear: outer ?? undefined })
      setExplanation(explanationText)
      setOutfitSource(source)
    } finally {
      setGenerating(false)
    }
  }

  const saveOutfit = async () => {
    if (!todaysOutfit) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const itemIds = [
      todaysOutfit.top.id,
      todaysOutfit.bottom.id,
      todaysOutfit.shoes.id,
      ...(todaysOutfit.outerwear ? [todaysOutfit.outerwear.id] : []),
    ]

    const insert: Partial<Outfit> = {
      user_id: user.id,
      date: getTodayLocalDateString(),
      occasion,
      weather_temp: weatherTemp,
      item_ids: itemIds,
      explanation_text: explanation,
      was_worn: true,
      generated_by: outfitSource ?? 'rules',
    }

    const { error } = await supabase.from('outfits').insert(insert)
    if (error) {
      showToast('Could not save — try again.', 'error')
    } else {
      showToast('Outfit saved ✨')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin border-[4px] border-cream border-t-pink" />
          <p className="font-mono text-sm font-extrabold uppercase tracking-wider text-ink">LOADING YOUR STYLE…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream md:flex-row">
      <Navbar />

      <main className="flex-1 p-4 pb-28 md:p-10 md:pb-10">
        <div className="mx-auto max-w-3xl">
          <header className="mb-8">
            <p className="font-mono text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-soft">↳ OUTFIT OF THE DAY</p>
            <h1 className="mt-1 font-mono text-5xl font-extrabold uppercase leading-none tracking-tighter text-ink md:text-6xl">
              TODAY&apos;S LOOK
            </h1>
          </header>

          <section className="mb-8 bg-cream border-[3px] border-ink shadow-chunk p-6">
            {weather && (
              <div className="mb-4 inline-flex items-center gap-2 bg-yellow border-[3px] border-ink px-3 py-1 font-mono text-xs font-extrabold uppercase tracking-wider text-ink">
                <span>📍 {weather.city}</span>
                <span>·</span>
                <span>{weather.temp}°C</span>
                {weather.condition && (
                  <>
                    <span>·</span>
                    <span>{weather.condition}</span>
                  </>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block font-mono text-xs font-extrabold uppercase tracking-wider text-ink">↳ TEMP (°C)</label>
                <input
                  type="number"
                  value={weatherTemp ?? ''}
                  onChange={(e) => setWeatherTemp(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border-[3px] border-ink bg-cream font-mono focus:bg-yellow outline-none"
                  placeholder="20"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs font-extrabold uppercase tracking-wider text-ink">↳ OCCASION</label>
                <select
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value as OccasionValue)}
                  className="w-full px-4 py-2 border-[3px] border-ink bg-cream font-mono font-extrabold uppercase tracking-wider focus:bg-yellow outline-none"
                >
                  {OCCASIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.emoji} {o.label.toUpperCase()}</option>
                  ))}
                </select>
                <p className="mt-1 font-mono text-[10px] font-extrabold uppercase tracking-wider text-ink-soft">
                  TARGET FORMALITY: {getOccasionTarget(occasion).replace('_', ' ').toUpperCase()}
                </p>
              </div>
            </div>
          </section>

          {!todaysOutfit ? (
            <section className="bg-cream border-[3px] border-ink shadow-chunkLg px-6 py-16 text-center">
              <div className="mx-auto mb-5 flex justify-center">
                <EmptySparkles size={120} />
              </div>
              <h2 className="font-mono text-3xl font-extrabold uppercase tracking-tighter text-ink">READY FOR THE DRIP?</h2>
              <p className="mx-auto mt-2 max-w-sm font-mono text-sm font-bold uppercase tracking-wider text-ink-soft">
                MILLI PICKS FROM YOUR CLOSET
              </p>
              <button
                onClick={generateNewOutfit}
                disabled={items.length < 3 || generating}
                className="mt-6 inline-flex items-center gap-2 bg-pink border-[3px] border-ink shadow-chunk px-8 py-4 font-mono font-extrabold uppercase tracking-wider text-ink btn-press disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? 'MILLI IS THINKING…' : '✦ GENERATE MY OUTFIT'}
              </button>
              {items.length < 3 && (
                <p className="mt-3 font-mono text-xs font-extrabold uppercase tracking-wider text-pink">ADD MORE ITEMS TO YOUR CLOSET FIRST</p>
              )}
            </section>
          ) : (
            <div className="space-y-6">
              {/* Lookbook hero — torn-out zine page. */}
              <article className="overflow-hidden bg-cream border-[3px] border-ink shadow-chunkLg">
                <div className="border-b-[3px] border-ink bg-pink px-6 py-4">
                  <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.22em] text-ink">↳ LOOK 01</p>
                  <h2 className="mt-1 font-mono text-3xl font-extrabold uppercase tracking-tighter text-ink">THE EDIT</h2>
                </div>
                <div className="grid grid-cols-2 gap-3 p-6 md:grid-cols-4">
                  <NumberedTile n="01" item={todaysOutfit.top}    label="TOP" />
                  <NumberedTile n="02" item={todaysOutfit.bottom} label="BOTTOM" />
                  <NumberedTile n="03" item={todaysOutfit.shoes}  label="SHOES" />
                  {todaysOutfit.outerwear
                    ? <NumberedTile n="04" item={todaysOutfit.outerwear} label="LAYER" />
                    : <EmptyTile n="04" label="NO LAYER" />}
                </div>
                {/* Milli's chat bubble — zine sticker style. */}
                <div className="border-t-[3px] border-ink bg-yellow px-6 py-5">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 border-[3px] border-ink bg-cream p-1">
                      <MilliAvatar size={48} />
                    </div>
                    <div className="relative flex-1 bg-cream border-[3px] border-ink px-4 py-3">
                      <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-soft">↳ MILLI SAYS</p>
                      <p className="mt-1 font-mono text-lg font-bold uppercase leading-snug text-ink">
                        &ldquo;{explanation}&rdquo;
                      </p>
                      {outfitSource && (
                        <span
                          className={`mt-3 inline-flex items-center gap-1 border-[3px] border-ink px-3 py-1 font-mono text-[11px] font-extrabold uppercase tracking-wider ${
                            outfitSource === 'ai'
                              ? 'bg-pink text-ink'
                              : 'bg-cyan text-ink'
                          }`}
                        >
                          {outfitSource === 'ai' ? '✨ MILLI PICKED THIS' : '⚡ QUICK PICK (OFFLINE)'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </article>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={generateNewOutfit}
                  disabled={generating}
                  className="flex-1 bg-cream border-[3px] border-ink shadow-chunk px-6 py-3 font-mono font-extrabold uppercase tracking-wider text-ink btn-press disabled:opacity-50"
                >
                  {generating ? 'MILLI IS THINKING…' : '↻ TRY ANOTHER'}
                </button>
                <button
                  onClick={saveOutfit}
                  disabled={saving}
                  className="flex-1 bg-lime border-[3px] border-ink shadow-chunk px-6 py-3 font-mono font-extrabold uppercase tracking-wider text-ink btn-press disabled:opacity-50"
                >
                  {saving ? 'SAVING…' : '✓ SAVE OUTFIT'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function NumberedTile({ item, label, n }: { item: Item; label: string; n: string }) {
  return (
    <figure className="relative overflow-hidden bg-cream border-[3px] border-ink shadow-chunk">
      <div className="relative aspect-[4/5] w-full">
        <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" />
      </div>
      <figcaption className="flex items-center justify-between border-t-[3px] border-ink bg-cream px-2.5 py-2 font-mono text-[10px] font-extrabold uppercase tracking-[0.18em]">
        <span className="text-ink">{label}</span>
        <span className="bg-pink border-2 border-ink px-2 py-0.5 text-ink">{n}</span>
      </figcaption>
    </figure>
  )
}

function EmptyTile({ label, n }: { label: string; n: string }) {
  return (
    <div className="flex aspect-[4/5] flex-col items-center justify-center border-[3px] border-dashed border-ink bg-cyan/30 px-2 text-center">
      <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink">{label}</span>
      <span className="mt-1 bg-cream border-2 border-ink px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase text-ink">{n}</span>
    </div>
  )
}
