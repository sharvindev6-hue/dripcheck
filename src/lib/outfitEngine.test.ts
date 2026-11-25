import { describe, expect, it } from 'vitest'
import { generateOutfit } from './outfitEngine'
import type { Item } from '@/types'

function mk(over: Partial<Item>): Item {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'user-1',
    image_url: 'https://example.com/item.jpg',
    name: 'Item',
    category: 'top',
    primary_color: 'black',
    secondary_color: null,
    formality: 'casual',
    warmth: 'mild',
    price: null,
    created_at: new Date().toISOString(),
    ...over,
  }
}

const baseWardrobe: Item[] = [
  mk({ category: 'top', name: 'Tee', primary_color: 'black' }),
  mk({ category: 'bottom', name: 'Jeans', primary_color: 'denim' }),
  mk({ category: 'shoes', name: 'Sneakers', primary_color: 'white' }),
]

describe('generateOutfit', () => {
  it('returns a full outfit when every required slot exists', () => {
    const outfit = generateOutfit(baseWardrobe, 18, 'casual')
    expect(outfit).not.toBeNull()
    expect(outfit!.top.category).toBe('top')
    expect(outfit!.bottom.category).toBe('bottom')
    expect(outfit!.shoes.category).toBe('shoes')
  })

  it('returns null when a required slot is empty', () => {
    const noShoes = baseWardrobe.filter(item => item.category !== 'shoes')
    expect(generateOutfit(noShoes, 18, 'casual')).toBeNull()
  })

  it('does not crash on a cold day with no outerwear', () => {
    const cold = baseWardrobe.map(item => ({ ...item, warmth: 'cold' as const }))
    const outfit = generateOutfit(cold, 2, 'casual')
    expect(outfit).not.toBeNull()
    expect(outfit!.outerwear).toBeUndefined()
  })

  it('returns null when nothing matches the weather band', () => {
    const cold = baseWardrobe.map(item => ({ ...item, warmth: 'cold' as const }))
    expect(generateOutfit(cold, 32, 'casual')).toBeNull()
  })

  it('never invents items outside the wardrobe', () => {
    const outfit = generateOutfit(baseWardrobe, 18, 'casual')
    expect(outfit).not.toBeNull()
    const ids = new Set(baseWardrobe.map(item => item.id))
    for (const piece of [outfit!.top, outfit!.bottom, outfit!.shoes, outfit!.outerwear]) {
      if (piece) expect(ids.has(piece.id)).toBe(true)
    }
  })
})
