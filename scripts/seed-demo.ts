/* eslint-disable no-console */
// Demo seeder for DripCheck.
//
// Requirements:
//   * run supabase/migrations/0001_recovery.sql first (tables, RLS, bucket)
//   * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_USER_EMAIL
//   * DEMO_SEED=true
//
// Run: npx tsx scripts/seed-demo.ts
// Idempotent: wipes the demo user's items/outfits before inserting.

import { createClient } from '@supabase/supabase-js'
import { addDaysLocal, getTodayLocalDateString } from '../src/lib/date'
import { colorHex, inferFit, inferGarmentType } from '../src/lib/garment'

async function main() {
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEMO_EMAIL = process.env.DEMO_USER_EMAIL
const DEMO_SEED = process.env.DEMO_SEED

if (DEMO_SEED !== 'true') {
  console.log('[seed-demo] DEMO_SEED is not "true" — skipping.')
  console.log(`
[seed-demo] To run:
  1. Apply supabase/migrations/0001_recovery.sql in the Supabase SQL editor.
  2. Set server-only env:
       SUPABASE_URL=https://YOUR_PROJECT.supabase.co
       SUPABASE_SERVICE_ROLE_KEY=eyJ...
       DEMO_USER_EMAIL=you@example.com
       DEMO_SEED=true
  3. npx tsx scripts/seed-demo.ts
`)
  process.exit(0)
}

if (!SUPABASE_URL || !SERVICE_ROLE || !DEMO_EMAIL) {
  console.error('[seed-demo] Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DEMO_USER_EMAIL')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
})

const { data: users, error: userError } = await supabase.auth.admin.listUsers()
if (userError) {
  console.error(userError)
  process.exit(1)
}

let demoUser = users.users.find(user => user.email === DEMO_EMAIL)
if (!demoUser) {
  const password = Array.from(crypto.getRandomValues(new Uint8Array(18)))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password,
    email_confirm: true,
  })
  if (createError || !created?.user) {
    console.error(`[seed-demo] Could not create demo user: ${createError?.message ?? 'unknown'}`)
    process.exit(1)
  }
  demoUser = created.user
  console.log(`[seed-demo] Created demo user ${DEMO_EMAIL}.`)
} else {
  console.log(`[seed-demo] Reusing demo user ${DEMO_EMAIL}.`)
}

const USER_ID = demoUser.id

// The auth trigger normally creates this row; upsert keeps the seeder usable
// on a project where the trigger was added after the account existed.
const { error: profileError } = await supabase
  .from('users')
  .upsert({ id: USER_ID, email: DEMO_EMAIL }, { onConflict: 'id' })
if (profileError) {
  console.error(profileError)
  process.exit(1)
}

await supabase.from('outfits').delete().eq('user_id', USER_ID)
await supabase.from('items').delete().eq('user_id', USER_ID)

const ITEMS = [
  { name: 'White Cotton Tee', category: 'top', primary_color: 'white', formality: 'casual', warmth: 'hot', price: 18, image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=70' },
  { name: 'Navy Oxford Shirt', category: 'top', primary_color: 'navy', formality: 'smart_casual', warmth: 'mild', price: 48, image_url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&q=70' },
  { name: 'Black Crew Sweater', category: 'top', primary_color: 'black', formality: 'casual', warmth: 'cold', price: 65, image_url: 'https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=400&q=70' },
  { name: 'Charcoal Blazer', category: 'outerwear', primary_color: 'grey', formality: 'formal', warmth: 'mild', price: 140, image_url: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=400&q=70' },
  { name: 'Olive Field Jacket', category: 'outerwear', primary_color: 'olive', formality: 'casual', warmth: 'cold', price: 95, image_url: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=400&q=70' },
  { name: 'Beige Trench Coat', category: 'outerwear', primary_color: 'beige', formality: 'smart_casual', warmth: 'cold', price: 180, image_url: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400&q=70' },
  { name: 'Indigo Skinny Jeans', category: 'bottom', primary_color: 'denim', formality: 'casual', warmth: 'mild', price: 55, image_url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&q=70' },
  { name: 'Khaki Chinos', category: 'bottom', primary_color: 'khaki', formality: 'smart_casual', warmth: 'mild', price: 60, image_url: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&q=70' },
  { name: 'Black Trousers', category: 'bottom', primary_color: 'black', formality: 'formal', warmth: 'mild', price: 70, image_url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400&q=70' },
  { name: 'White Sneakers', category: 'shoes', primary_color: 'white', formality: 'casual', warmth: 'mild', price: 85, image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=70' },
  { name: 'Brown Leather Loafers', category: 'shoes', primary_color: 'brown', formality: 'smart_casual', warmth: 'mild', price: 120, image_url: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=400&q=70' },
  { name: 'Black Chelsea Boots', category: 'shoes', primary_color: 'black', formality: 'smart_casual', warmth: 'cold', price: 150, image_url: 'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?w=400&q=70' },
  { name: 'Red Graphic Tee', category: 'top', primary_color: 'red', formality: 'casual', warmth: 'hot', price: 25, image_url: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=400&q=70' },
  { name: 'Grey Hoodie', category: 'top', primary_color: 'grey', formality: 'casual', warmth: 'cold', price: 45, image_url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&q=70' },
  { name: 'Black Leggings', category: 'bottom', primary_color: 'black', formality: 'casual', warmth: 'mild', price: 30, image_url: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&q=70' },
  { name: 'Tan Sandals', category: 'shoes', primary_color: 'tan', formality: 'casual', warmth: 'hot', price: 40, image_url: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=400&q=70' },
] as const

const itemRows = ITEMS.map(input => {
  const garmentType = inferGarmentType(input.name, input.category)
  return {
    user_id: USER_ID,
    name: input.name,
    category: input.category,
    primary_color: input.primary_color,
    secondary_color: null,
    formality: input.formality,
    warmth: input.warmth,
    price: input.price,
    image_url: input.image_url,
    image_path: null,
    garment_type: garmentType,
    color_hex: colorHex(input.primary_color),
    fit: inferFit(input.name, garmentType),
    status: 'clean',
    times_worn: 0,
    last_worn: null,
  }
})

const { data: inserted, error: insertError } = await supabase
  .from('items')
  .insert(itemRows)
  .select('id, category')

if (insertError || !inserted) {
  console.error(insertError)
  process.exit(1)
}
console.log(`[seed-demo] Inserted ${inserted.length} items.`)

const byCategory = (category: 'top' | 'bottom' | 'shoes' | 'outerwear') =>
  inserted.filter(row => row.category === category).map(row => row.id)

const today = getTodayLocalDateString()

// Indices below are positions inside each category-filtered array:
// tops: 0 white tee, 1 navy oxford, 2 black sweater, 3 red tee, 4 grey hoodie
// bottoms: 0 jeans, 1 chinos, 2 black trousers, 3 leggings
// shoes: 0 sneakers, 1 loafers, 2 boots, 3 sandals
// outerwear: 0 blazer, 1 field jacket, 2 trench
const OUTFITS = [
  { i: 1, occasion: 'casual', temp: 22, ids: () => [byCategory('top')[2], byCategory('bottom')[0], byCategory('shoes')[0]] },
  { i: 2, occasion: 'school', temp: 18, ids: () => [byCategory('top')[0], byCategory('bottom')[1], byCategory('shoes')[0]] },
  { i: 3, occasion: 'date_night', temp: 17, ids: () => [byCategory('top')[1], byCategory('bottom')[0], byCategory('shoes')[1], byCategory('outerwear')[0]] },
  { i: 4, occasion: 'casual', temp: 8, ids: () => [byCategory('top')[4], byCategory('bottom')[0], byCategory('shoes')[2], byCategory('outerwear')[1]] },
  { i: 5, occasion: 'interview', temp: 20, ids: () => [byCategory('top')[1], byCategory('bottom')[2], byCategory('shoes')[1], byCategory('outerwear')[0]] },
  { i: 6, occasion: 'casual', temp: 27, ids: () => [byCategory('top')[3], byCategory('bottom')[3], byCategory('shoes')[3]] },
  { i: 7, occasion: 'casual', temp: 10, ids: () => [byCategory('top')[2], byCategory('bottom')[0], byCategory('shoes')[2], byCategory('outerwear')[2]] },
  { i: 8, occasion: 'school', temp: 19, ids: () => [byCategory('top')[0], byCategory('bottom')[1], byCategory('shoes')[0]] },
  { i: 9, occasion: 'date_night', temp: 21, ids: () => [byCategory('top')[1], byCategory('bottom')[2], byCategory('shoes')[1]] },
  { i: 10, occasion: 'casual', temp: 24, ids: () => [byCategory('top')[3], byCategory('bottom')[0], byCategory('shoes')[0]] },
  { i: 11, occasion: 'school', temp: 16, ids: () => [byCategory('top')[0], byCategory('bottom')[0], byCategory('shoes')[0]] },
  { i: 12, occasion: 'interview', temp: 22, ids: () => [byCategory('top')[1], byCategory('bottom')[2], byCategory('shoes')[1]] },
  { i: 13, occasion: 'casual', temp: 6, ids: () => [byCategory('top')[4], byCategory('bottom')[3], byCategory('shoes')[2], byCategory('outerwear')[1]] },
  { i: 14, occasion: 'casual', temp: 26, ids: () => [byCategory('top')[3], byCategory('bottom')[3], byCategory('shoes')[3]] },
  { i: 15, occasion: 'school', temp: 18, ids: () => [byCategory('top')[0], byCategory('bottom')[1], byCategory('shoes')[0]] },
  { i: 16, occasion: 'date_night', temp: 20, ids: () => [byCategory('top')[1], byCategory('bottom')[0], byCategory('shoes')[1], byCategory('outerwear')[0]] },
  { i: 17, occasion: 'casual', temp: 12, ids: () => [byCategory('top')[2], byCategory('bottom')[0], byCategory('shoes')[2], byCategory('outerwear')[2]] },
  { i: 18, occasion: 'casual', temp: 25, ids: () => [byCategory('top')[0], byCategory('bottom')[0], byCategory('shoes')[0]] },
  { i: 19, occasion: 'school', temp: 17, ids: () => [byCategory('top')[0], byCategory('bottom')[1], byCategory('shoes')[0]] },
  { i: 20, occasion: 'formal', temp: 19, ids: () => [byCategory('top')[1], byCategory('bottom')[2], byCategory('shoes')[1]] },
  { i: 21, occasion: 'casual', temp: 9, ids: () => [byCategory('top')[4], byCategory('bottom')[0], byCategory('shoes')[2], byCategory('outerwear')[1]] },
] as const

const outfitRows = OUTFITS.map(entry => ({
  user_id: USER_ID,
  date: addDaysLocal(today, entry.i - 21),
  occasion: entry.occasion,
  weather_temp: entry.temp,
  item_ids: entry.ids(),
  explanation_text: 'Seeded look from the demo script.',
  is_favorite: entry.i === 4 || entry.i === 12,
  // Every seeded day, including today, is worn so the streak and
  // cost-per-wear stats are correct on first open.
  was_worn: true,
  generated_by: 'rules' as const,
}))

const { error: outfitError } = await supabase.from('outfits').insert(outfitRows)
if (outfitError) {
  console.error(outfitError)
  process.exit(1)
}
console.log(`[seed-demo] Inserted ${outfitRows.length} outfit history rows.`)

const wearCounts = new Map<string, { count: number; last: string }>()
for (const row of outfitRows) {
  if (!row.was_worn) continue
  for (const id of row.item_ids) {
    const current = wearCounts.get(id) ?? { count: 0, last: row.date }
    wearCounts.set(id, {
      count: current.count + 1,
      last: row.date > current.last ? row.date : current.last,
    })
  }
}

await Promise.all(
  Array.from(wearCounts.entries()).map(([id, stats]) =>
    supabase
      .from('items')
      .update({ times_worn: stats.count, last_worn: stats.last })
      .eq('id', id)
      .eq('user_id', USER_ID)
  )
)

console.log(`[seed-demo] Updated wear counters for ${wearCounts.size} items.`)
console.log('[seed-demo] Done.')
}

void main().catch(error => {
  console.error(error)
  process.exit(1)
})
