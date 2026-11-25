import { describe, expect, it } from 'vitest'
import { buildStats, calcStreak, itemCostPerWear } from './stats'
import type { Item, Outfit } from '@/types'

const TODAY = '2026-11-24'

function item(over: Partial<Item>): Item {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u1',
    image_url: null,
    image_path: null,
    name: 'Item',
    category: 'top',
    primary_color: 'black',
    secondary_color: null,
    formality: 'casual',
    warmth: 'mild',
    price: null,
    garment_type: null,
    color_hex: null,
    fit: null,
    status: 'clean',
    times_worn: 0,
    last_worn: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  }
}

function outfit(over: Partial<Outfit>): Outfit {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u1',
    date: TODAY,
    occasion: 'casual',
    weather_temp: 18,
    item_ids: ['t', 'b', 's'],
    explanation_text: null,
    is_favorite: false,
    was_worn: true,
    generated_by: 'rules',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  }
}

describe('calcStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(calcStreak([TODAY, '2026-11-23', '2026-11-22'], TODAY)).toBe(3)
  })

  it('keeps the streak alive when today is not logged yet', () => {
    expect(calcStreak(['2026-11-23', '2026-11-22'], TODAY)).toBe(2)
  })

  it('stops at the first gap', () => {
    expect(calcStreak([TODAY, '2026-11-22'], TODAY)).toBe(1)
  })

  it('is zero with no history', () => {
    expect(calcStreak([], TODAY)).toBe(0)
  })
})

describe('buildStats', () => {
  it('computes lifetime cost per wear', () => {
    const items = [
      item({ price: 60, times_worn: 4 }),
      item({ price: 40, times_worn: 1 }),
    ]
    const stats = buildStats(items, [outfit({})], TODAY)
    expect(stats.total_spend).toBe(100)
    expect(stats.total_wears).toBe(5)
    expect(stats.cost_per_wear).toBe(20)
  })

  it('falls back to outfit item counts when counters are empty', () => {
    const items = [item({ price: 90, times_worn: 0 })]
    const stats = buildStats(
      items,
      [outfit({ item_ids: ['a', 'b', 'c'], was_worn: true })],
      TODAY
    )
    expect(stats.total_wears).toBe(3)
    expect(stats.cost_per_wear).toBe(30)
  })

  it('returns null cost per wear before anything is worn', () => {
    const stats = buildStats([item({ price: 50 })], [], TODAY)
    expect(stats.cost_per_wear).toBeNull()
    expect(stats.streak).toBe(0)
  })

  it('builds a seven-day strip from real dates', () => {
    const stats = buildStats([], [outfit({ date: TODAY, was_worn: true })], TODAY)
    expect(stats.week).toHaveLength(7)
    expect(stats.week[6]).toMatchObject({ date: TODAY, was_worn: true })
  })
})

describe('itemCostPerWear', () => {
  it('is null without a price or a wear', () => {
    expect(itemCostPerWear({ price: null, times_worn: 3 })).toBeNull()
    expect(itemCostPerWear({ price: 20, times_worn: 0 })).toBeNull()
  })

  it('divides price by lifetime wears', () => {
    expect(itemCostPerWear({ price: 100, times_worn: 8 })).toBe(12.5)
  })
})
