import { describe, expect, it } from 'vitest'
import { colorsMatch, explainOutfit, generateOutfit } from './outfitEngine'
import type { Item } from '@/types'

function mk(over: Partial<Item>): Item {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'user-1',
    image_url: 'https://example.com/item.jpg',
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

  it('never dead-ends when the exact warmth band is missing', () => {
    const cold = baseWardrobe.map(item => ({ ...item, warmth: 'cold' as const }))
    // The old engine filtered by exact warmth and returned null here.
    expect(generateOutfit(cold, 32, 'casual')).not.toBeNull()
  })

  it('excludes dirty items from the look', () => {
    const wardrobe = baseWardrobe.map(item => ({ ...item }))
    const dirtyTop = mk({ category: 'top', name: 'Dirty tee', status: 'dirty' })
    const outfit = generateOutfit([...wardrobe, dirtyTop], 18, 'casual')
    expect(outfit).not.toBeNull()
    expect(outfit!.top.id).not.toBe(dirtyTop.id)
  })

  it('never invents items outside the wardrobe', () => {
    const outfit = generateOutfit(baseWardrobe, 18, 'casual')
    expect(outfit).not.toBeNull()
    const ids = new Set(baseWardrobe.map(item => item.id))
    for (const piece of [outfit!.top, outfit!.bottom, outfit!.shoes, outfit!.outerwear]) {
      if (piece) expect(ids.has(piece.id)).toBe(true)
    }
  })

  it('prefers the item the user asked to build around', () => {
    const wardrobe = [
      ...baseWardrobe,
      mk({ category: 'bottom', name: 'Cargos', primary_color: 'olive' }),
    ]
    const seed = wardrobe[3]
    const outfit = generateOutfit(wardrobe, 18, 'casual', { seedItemId: seed.id })
    expect(outfit).not.toBeNull()
    expect(outfit!.bottom.id).toBe(seed.id)
  })
})

describe('colour compatibility', () => {
  it('lets neutrals pair with anything', () => {
    expect(colorsMatch('black', 'orange')).toBe(true)
    expect(colorsMatch('white', 'purple')).toBe(true)
  })

  it('does not claim two unrelated hues match', () => {
    expect(colorsMatch('red', 'green')).toBe(false)
  })
})

describe('explainOutfit', () => {
  it('only claims neutrals when both pieces are neutral', () => {
    const combo = {
      top: mk({ category: 'top', name: 'Red tee', primary_color: 'red' }),
      bottom: mk({ category: 'bottom', name: 'Jeans', primary_color: 'denim' }),
      shoes: mk({ category: 'shoes', name: 'Sneakers', primary_color: 'white' }),
      score: 10,
    }
    const text = explainOutfit(combo, 18, 'casual')
    expect(text).not.toContain('both neutral')
  })

  it('uses a plural verb for plural shoe names', () => {
    const combo = {
      top: mk({ category: 'top', name: 'Grey tee', primary_color: 'grey' }),
      bottom: mk({ category: 'bottom', name: 'Jeans', primary_color: 'denim' }),
      shoes: mk({ category: 'shoes', name: 'Tan sandals', primary_color: 'tan' }),
      score: 10,
    }
    expect(explainOutfit(combo, 18, 'casual')).toContain('Tan sandals finish the casual look.')
  })

  it('says a coat is missing when it is cold and there is no layer', () => {
    const combo = {
      top: mk({ category: 'top', name: 'Hoodie', primary_color: 'grey' }),
      bottom: mk({ category: 'bottom', name: 'Jeans', primary_color: 'denim' }),
      shoes: mk({ category: 'shoes', name: 'Boots', primary_color: 'black' }),
      score: 5,
    }
    const text = explainOutfit(combo, 2, 'casual')
    expect(text).toContain('no outerwear')
  })
})
