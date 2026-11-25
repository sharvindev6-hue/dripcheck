// Focused regression check for the rules engine.
// Run: npx tsx scripts/verify-engine.ts
import { generateOutfit } from '../src/lib/outfitEngine'
import type { Item } from '../src/types'

function make(over: Partial<Item>): Item {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u1',
    image_url: 'https://example.com/x.jpg',
    image_path: null,
    name: 'Item',
    category: 'top',
    primary_color: 'black',
    secondary_color: null,
    formality: 'casual',
    warmth: 'cold',
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

const items: Item[] = [
  make({ category: 'top', name: 'Hoodie', warmth: 'cold', primary_color: 'navy' }),
  make({ category: 'top', name: 'Sweater', warmth: 'cold', primary_color: 'grey' }),
  make({ category: 'bottom', name: 'Jeans', warmth: 'cold', primary_color: 'denim' }),
  make({ category: 'bottom', name: 'Cargos', warmth: 'cold', primary_color: 'black' }),
  make({ category: 'shoes', name: 'Boots', warmth: 'cold', primary_color: 'black' }),
  make({ category: 'shoes', name: 'Sneakers', warmth: 'cold', primary_color: 'white' }),
  // Deliberately zero outerwear.
]

for (let i = 0; i < 50; i += 1) {
  const outfit = generateOutfit(items, 5, 'casual')
  if (!outfit || !outfit.top || !outfit.bottom || !outfit.shoes) {
    console.error('FAIL: expected a valid cold-weather outfit with no outerwear')
    process.exit(1)
  }
}

// The old engine hard-filtered on the exact warmth band and returned null.
for (let i = 0; i < 20; i += 1) {
  const outfit = generateOutfit(items, 32, 'casual')
  if (!outfit) {
    console.error('FAIL: expected a fallback outfit when the exact warmth band is missing')
    process.exit(1)
  }
}

console.log('PASS: tiered warmth, cold weather, zero outerwear (B11)')
