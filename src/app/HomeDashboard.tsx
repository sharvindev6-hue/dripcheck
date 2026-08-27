'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase'
import { Item, Outfit } from '@/types'
import { BrandMark, EmptySparkles } from '@/components/icons'
import { Flame, Sparkles, ArrowRight } from 'lucide-react'
import { getTodayLocalDateString, addDaysLocal } from '@/lib/date'

const supabase = createClient()

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5)  return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function todayISO(): string {
  return getTodayLocalDateString()
}

function dateRange(days: number): string[] {
  const out: string[] = []
  const today = todayISO()
  for (let i = days - 1; i >= 0; i--) {
    out.push(addDaysLocal(today, -i))
  }
  return out
}

// Streak: count consecutive days (going back from today) where was_worn === true.
function calcStreak(history: { date: string; was_worn: boolean }[]): number {
  const worn = new Set(history.filter(h => h.was_worn).map(h => h.date))
  let streak = 0
  for (const d of dateRange(60)) {
    if (worn.has(d)) streak++
    else if (d === todayISO()) continue
    else break
  }
  return streak
}

export default function HomeDashboard() {
  const [loading, setLoading] = useState(true)
  const [items, setItems]     = useState<Item[]>([])
  const [today, setToday]     = useState<Outfit | null>(null)
  const [history, setHistory] = useState<{ date: string; was_worn: boolean }[]>([])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: itemsData }, { data: todayData }, { data: histData }] = await Promise.all([
      supabase.from('items').select('*').eq('user_id', user.id),
      supabase.from('outfits').select('*').eq('user_id', user.id).eq('date', todayISO()).maybeSingle(),
      supabase.from('outfits').select('date, was_worn').eq('user_id', user.id)
        .gte('date', dateRange(14)[0]).order('date', { ascending: true }),
    ])
    setItems(itemsData || [])
    setToday(todayData ?? null)
    setHistory(histData || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const totalWears = history.filter(h => h.was_worn).length
    const itemsWithPrice = items.filter(i => i.price != null && i.price > 0)
    const sumPrice = itemsWithPrice.reduce((s, i) => s + (i.price ?? 0), 0)
    const cpw = totalWears > 0 ? sumPrice / totalWears : null
    return { pieces: items.length, streak: calcStreak(history), cpw }
  }, [items, history])

  const last14 = useMemo(() => {
    const map = new Map(history.map(h => [h.date, h.was_worn]))
    return dateRange(14).map(d => ({ date: d, was_worn: map.get(d) === true }))
  }, [history])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-accent" />
          <p className="text-ink-soft">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper md:flex-row">
      <Navbar />
      <main className="flex-1 p-4 pb-28 md:p-10 md:pb-10">
        <div className="mx-auto max-w-3xl">
          <header className="mb-10 flex items-center gap-3">
            <BrandMark size={36} />
            <span className="font-display text-2xl font-bold tracking-tight text-ink">DripCheck</span>
          </header>

          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">{greeting()}</p>
          <h1 className="mt-1 font-display text-5xl font-bold leading-none tracking-tight text-ink md:text-6xl">
            Let&apos;s get dressed.
          </h1>

          <section className="mt-8 grid grid-cols-3 gap-3">
            <StatCard
              icon={<Flame size={18} />}
              label="Streak"
              value={stats.streak > 0 ? `${stats.streak} day${stats.streak === 1 ? '' : 's'}` : '—'}
              tone="blush"
            />
            <StatCard
              icon={<Sparkles size={18} />}
              label="Pieces"
              value={String(stats.pieces)}
              tone="sage"
            />
            <StatCard
              icon={<span className="font-display text-base font-bold">$</span>}
              label="Cost / wear"
              value={stats.cpw != null ? `$${stats.cpw.toFixed(2)}` : '—'}
              tone="blush"
            />
          </section>

          <section className="mt-8 rounded-card border border-black/5 bg-white p-6 shadow-soft">
            {today ? (
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">Today&apos;s outfit</p>
                  <h2 className="mt-1 font-display text-2xl font-bold text-ink capitalize">
                    {today.occasion.replace('_', ' ')}
                  </h2>
                  {today.weather_temp != null && (
                    <p className="mt-1 text-sm text-ink-soft">{today.weather_temp}°C · {today.item_ids.length} pieces</p>
                  )}
                </div>
                <Link
                  href="/outfit"
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-all hover:bg-ink/90"
                >
                  View look <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <EmptySparkles size={80} />
                <h2 className="font-display text-2xl font-bold text-ink">No outfit yet</h2>
                <p className="max-w-sm text-ink-soft">
                  {items.length < 3
                    ? `Add at least 3 pieces to your closet first. You have ${items.length} so far.`
                    : 'Tap below to let Milli style today.'}
                </p>
                <Link
                  href={items.length < 3 ? '/closet' : '/outfit'}
                  className="mt-2 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent to-accent-2 px-6 py-3 text-sm font-semibold text-white shadow-soft transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {items.length < 3 ? 'Add to closet' : 'Get today’s look'} <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </section>

          <section className="mt-8">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">Last 14 days</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {last14.map((d, i) => {
                const isToday = d.date === todayISO()
                const isFuture = d.date > todayISO()
                const tone = isFuture
                  ? 'bg-sage/30 text-ink-soft'
                  : d.was_worn
                    ? 'bg-ink text-paper'
                    : 'bg-white text-ink-soft ring-1 ring-black/5'
                return (
                  <div
                    key={d.date}
                    className={`fade-up fade-up-d${Math.min(i + 1, 8)} flex h-14 w-12 flex-shrink-0 flex-col items-center justify-center rounded-2xl text-[10px] font-semibold uppercase ${tone} ${isToday ? 'ring-2 ring-accent' : ''}`}
                    title={d.date}
                  >
                    <span>{new Date(d.date).getDate()}</span>
                    <span className="opacity-70">{d.was_worn ? 'wore' : isFuture ? '—' : 'skip'}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'blush' | 'sage' }) {
  return (
    <div className={`rounded-card px-4 py-3 shadow-soft ${tone === 'blush' ? 'bg-blush' : 'bg-sage/60'}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
        {icon} <span>{label}</span>
      </div>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{value}</p>
    </div>
  )
}
