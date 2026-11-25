import type { Item, Outfit, Stats } from '@/types'
import { addDaysLocal } from './date'
import { OCCASIONS } from './constants'

/**
 * Consecutive worn days ending today (or yesterday, if today has not been
 * logged yet). Walking forward from the oldest date — the old bug — broke on
 * the first unworn day in the window and reported a permanent zero.
 */
export function calcStreak(wornDates: Iterable<string>, today: string): number {
  const worn = new Set(wornDates)
  let cursor = today
  if (!worn.has(cursor)) cursor = addDaysLocal(today, -1)

  let streak = 0
  while (worn.has(cursor)) {
    streak += 1
    cursor = addDaysLocal(cursor, -1)
  }
  return streak
}

function occasionName(value: string): string {
  return OCCASIONS.find(o => o.value === value)?.label ?? value.replace(/_/g, ' ')
}

/**
 * Lifetime stats. Cost-per-wear is total spend divided by total recorded
 * wears, not a 14-day window (the old dashboard only loaded 14 days).
 */
export function buildStats(items: Item[], outfits: Outfit[], today: string): Stats {
  const wornOutfits = outfits.filter(outfit => outfit.was_worn)
  const counterWears = items.reduce((sum, item) => sum + Math.max(0, item.times_worn || 0), 0)
  const derivedWears = wornOutfits.reduce((sum, outfit) => sum + outfit.item_ids.length, 0)
  const totalWears = counterWears > 0 ? counterWears : derivedWears

  const totalSpend = items.reduce(
    (sum, item) => sum + (item.price != null && item.price > 0 ? item.price : 0),
    0
  )

  const byDate = new Map(outfits.map(outfit => [outfit.date, outfit]))
  const week: Stats['week'] = []
  for (let i = 6; i >= 0; i -= 1) {
    const date = addDaysLocal(today, -i)
    const outfit = byDate.get(date)
    week.push({
      date,
      was_worn: outfit?.was_worn ?? false,
      outfit_name: outfit ? occasionName(outfit.occasion) : null,
    })
  }

  return {
    pieces: items.length,
    looks: outfits.length,
    streak: calcStreak(
      wornOutfits.map(outfit => outfit.date),
      today
    ),
    total_spend: Math.round(totalSpend * 100) / 100,
    total_wears: totalWears,
    cost_per_wear:
      totalWears > 0 && totalSpend > 0 ? Math.round((totalSpend / totalWears) * 100) / 100 : null,
    week,
  }
}

/** Per-item cost per wear. Returns null until the piece has been worn. */
export function itemCostPerWear(item: Pick<Item, 'price' | 'times_worn'>): number | null {
  if (item.price == null || item.price <= 0) return null
  if (!item.times_worn || item.times_worn <= 0) return null
  return Math.round((item.price / item.times_worn) * 100) / 100
}
