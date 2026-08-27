// Throwaway regression check for Bug 1.1 — run with `npx tsx scripts/verify-engine.ts`
import { generateOutfit } from '../src/lib/outfitEngine'
import type { Item } from '../src/types'

const mk = (over: Partial<Item>): Item => ({
  id: Math.random().toString(36).slice(2),
  user_id: 'u1',
  image_url: 'https://example.com/x.jpg',
  name: 'Item',
  category: 'top',
  primary_color: 'black',
  secondary_color: null,
  formality: 'casual',
  warmth: 'cold',
  price: null,
  created_at: new Date().toISOString(),
  ...over,
})

const items: Item[] = [
  mk({ category: 'top', name: 'Hoodie', warmth: 'cold', primary_color: 'navy' }),
  mk({ category: 'top', name: 'Sweater', warmth: 'cold', primary_color: 'grey' }),
  mk({ category: 'bottom', name: 'Jeans', warmth: 'cold', primary_color: 'denim' }),
  mk({ category: 'bottom', name: 'Cargos', warmth: 'cold', primary_color: 'black' }),
  mk({ category: 'shoes', name: 'Boots', warmth: 'cold', primary_color: 'black' }),
  mk({ category: 'shoes', name: 'Sneakers', warmth: 'cold', primary_color: 'white' }),
  // NOTE: deliberately zero outerwear items
]

for (let i = 0; i < 50; i++) {
  const outfit = generateOutfit(items, 5, 'casual')
  if (!outfit) {
    console.error('FAIL: expected a valid outfit at temp=5 with no jackets, got null')
    process.exit(1)
  }
  if (!outfit.top || !outfit.bottom || !outfit.shoes) {
    console.error('FAIL: outfit missing required pieces')
    process.exit(1)
  }
}

// Also confirm it still works in mild weather without outerwear
for (let i = 0; i < 10; i++) {
  const outfit = generateOutfit(items.map((i) => ({ ...i, warmth: 'mild' })), 20, 'casual')
  if (!outfit) {
    console.error('FAIL: expected valid mild-weather outfit')
    process.exit(1)
  }
}

console.log('PASS: cold-weather + zero outerwear never crashes (Bug 1.1)')
