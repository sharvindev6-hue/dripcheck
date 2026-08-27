/* eslint-disable no-console */
// Demo seeder for DripCheck.
//
// Run:    npx tsx scripts/seed-demo.ts
// Needs:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_USER_EMAIL
// Skip:   if DEMO_SEED is not 'true' (idempotent guard)
//
// Inserts ~16 realistic wardrobe items + 3 weeks of outfit history
// for a single demo user. Safe to re-run — duplicates are removed first.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEMO_EMAIL   = process.env.DEMO_USER_EMAIL
const DEMO_SEED    = process.env.DEMO_SEED

if (DEMO_SEED !== 'true') {
  console.log('[seed-demo] DEMO_SEED is not "true" — skipping. Set DEMO_SEED=true to run.')
  console.log(`
[seed-demo] To run end-to-end:
  1. Apply schema in Supabase SQL editor (in this order):
     a. supabase_schema.sql          — items, outfits tables, RLS, wardrobe-items bucket
     b. supabase_migration_stylist.sql — adds outfits.generated_by
  2. Set env (server-side ONLY — service role bypasses RLS):
       SUPABASE_URL=https://YOUR_PROJECT.supabase.co
       SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
       DEMO_USER_EMAIL=you@example.com
       DEMO_SEED=true
  3. From the repo root:
       npx tsx scripts/seed-demo.ts
`)
  process.exit(0)
}
if (!SUPABASE_URL || !SERVICE_ROLE || !DEMO_EMAIL) {
  console.error('[seed-demo] Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DEMO_USER_EMAIL')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

// 1. Find the demo user id, or create one. Using admin.createUser so the
// seeder works on a fresh project — no need to sign in once via the magic
// link before running. email_confirm: true bypasses Supabase's verification
// email since this account only ever exists in a demo database.
const { data: users, error: userErr } = await supabase.auth.admin.listUsers()
if (userErr) { console.error(userErr); process.exit(1) }
let demoUser = users.users.find(u => u.email === DEMO_EMAIL)
if (!demoUser) {
  // Random password — we never log in to this account directly; the seeder
  // writes data via the service role key. Throw it away afterwards.
  const demoPassword = Array.from(crypto.getRandomValues(new Uint8Array(18)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: demoPassword,
    email_confirm: true,
  })
  if (createErr || !created?.user) {
    console.error(`[seed-demo] Failed to create demo user: ${createErr?.message ?? 'unknown error'}`)
    process.exit(1)
  }
  demoUser = created.user
  console.log(`[seed-demo] Created demo auth user ${DEMO_EMAIL} (id=${demoUser.id}).`)
} else {
  console.log(`[seed-demo] Reusing existing demo user ${DEMO_EMAIL} (id=${demoUser.id}).`)
}
const USER_ID = demoUser.id

// 2. Wipe existing items/outfits for idempotency
await supabase.from('outfits').delete().eq('user_id', USER_ID)
await supabase.from('items').delete().eq('user_id', USER_ID)

// 3. Insert demo items. Public Unsplash CDN URLs only.
const ITEMS = [
  { name: 'White Cotton Tee',          category: 'top',        primary_color: 'white', formality: 'casual',       warmth: 'hot',  price: 18,  image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=70' },
  { name: 'Navy Oxford Shirt',         category: 'top',        primary_color: 'navy',  formality: 'smart_casual', warmth: 'mild', price: 48,  image_url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&q=70' },
  { name: 'Black Crew Sweater',        category: 'top',        primary_color: 'black', formality: 'casual',       warmth: 'cold', price: 65,  image_url: 'https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=400&q=70' },
  { name: 'Charcoal Blazer',           category: 'outerwear',  primary_color: 'grey',  formality: 'formal',       warmth: 'mild', price: 140, image_url: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=400&q=70' },
  { name: 'Olive Field Jacket',        category: 'outerwear',  primary_color: 'olive', formality: 'casual',       warmth: 'cold', price: 95,  image_url: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=400&q=70' },
  { name: 'Beige Trench Coat',         category: 'outerwear',  primary_color: 'beige', formality: 'smart_casual', warmth: 'cold', price: 180, image_url: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400&q=70' },
  { name: 'Indigo Skinny Jeans',       category: 'bottom',     primary_color: 'denim', formality: 'casual',       warmth: 'mild', price: 55,  image_url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&q=70' },
  { name: 'Khaki Chinos',              category: 'bottom',     primary_color: 'khaki', formality: 'smart_casual', warmth: 'mild', price: 60,  image_url: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&q=70' },
  { name: 'Black Trousers',            category: 'bottom',     primary_color: 'black', formality: 'formal',       warmth: 'mild', price: 70,  image_url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400&q=70' },
  { name: 'White Sneakers',            category: 'shoes',      primary_color: 'white', formality: 'casual',       warmth: 'mild', price: 85,  image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=70' },
  { name: 'Brown Leather Loafers',     category: 'shoes',      primary_color: 'brown', formality: 'smart_casual', warmth: 'mild', price: 120, image_url: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=400&q=70' },
  { name: 'Black Chelsea Boots',       category: 'shoes',      primary_color: 'black', formality: 'smart_casual', warmth: 'cold', price: 150, image_url: 'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?w=400&q=70' },
  { name: 'Red Graphic Tee',           category: 'top',        primary_color: 'red',   formality: 'casual',       warmth: 'hot',  price: 25,  image_url: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=400&q=70' },
  { name: 'Grey Hoodie',               category: 'top',        primary_color: 'grey',  formality: 'casual',       warmth: 'cold', price: 45,  image_url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&q=70' },
  { name: 'Black Leggings',            category: 'bottom',     primary_color: 'black', formality: 'casual',       warmth: 'mild', price: 30,  image_url: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&q=70' },
  { name: 'Tan Sandals',               category: 'shoes',      primary_color: 'tan',   formality: 'casual',       warmth: 'hot',  price: 40,  image_url: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=400&q=70' },
] as const

const itemRows = ITEMS.map(i => ({ user_id: USER_ID, ...i, secondary_color: null }))
const { data: inserted, error: insErr } = await supabase.from('items').insert(itemRows).select('id, category')
if (insErr) { console.error(insErr); process.exit(1) }
console.log(`[seed-demo] Inserted ${inserted.length} items.`)

const byCat = (cat: 'top' | 'bottom' | 'shoes' | 'outerwear') =>
  inserted!.filter(i => i.category === cat).map(i => i.id)

const today = new Date()
const OUTFITS = [
  { i: 1,  occasion: 'casual',     temp: 22, ids: () => [byCat('top')[2], byCat('bottom')[6], byCat('shoes')[9]] },
  { i: 2,  occasion: 'school',     temp: 18, ids: () => [byCat('top')[0], byCat('bottom')[7], byCat('shoes')[9]] },
  { i: 3,  occasion: 'date_night', temp: 17, ids: () => [byCat('top')[1], byCat('bottom')[6], byCat('shoes')[10], byCat('outerwear')[3]] },
  { i: 4,  occasion: 'casual',     temp: 8,  ids: () => [byCat('top')[13], byCat('bottom')[6], byCat('shoes')[11], byCat('outerwear')[4]] },
  { i: 5,  occasion: 'interview',  temp: 20, ids: () => [byCat('top')[1], byCat('bottom')[8], byCat('shoes')[10], byCat('outerwear')[3]] },
  { i: 6,  occasion: 'casual',     temp: 27, ids: () => [byCat('top')[12], byCat('bottom')[14], byCat('shoes')[15]] },
  { i: 7,  occasion: 'casual',     temp: 10, ids: () => [byCat('top')[2], byCat('bottom')[6], byCat('shoes')[11], byCat('outerwear')[5]] },
  { i: 8,  occasion: 'school',     temp: 19, ids: () => [byCat('top')[0], byCat('bottom')[7], byCat('shoes')[9]] },
  { i: 9,  occasion: 'date_night', temp: 21, ids: () => [byCat('top')[1], byCat('bottom')[8], byCat('shoes')[10]] },
  { i: 10, occasion: 'casual',     temp: 24, ids: () => [byCat('top')[12], byCat('bottom')[6], byCat('shoes')[9]] },
  { i: 11, occasion: 'school',     temp: 16, ids: () => [byCat('top')[0], byCat('bottom')[6], byCat('shoes')[9]] },
  { i: 12, occasion: 'interview',  temp: 22, ids: () => [byCat('top')[1], byCat('bottom')[8], byCat('shoes')[10]] },
  { i: 13, occasion: 'casual',     temp: 6,  ids: () => [byCat('top')[13], byCat('bottom')[14], byCat('shoes')[11], byCat('outerwear')[4]] },
  { i: 14, occasion: 'casual',     temp: 26, ids: () => [byCat('top')[12], byCat('bottom')[14], byCat('shoes')[15]] },
  { i: 15, occasion: 'school',     temp: 18, ids: () => [byCat('top')[0], byCat('bottom')[7], byCat('shoes')[9]] },
  { i: 16, occasion: 'date_night', temp: 20, ids: () => [byCat('top')[1], byCat('bottom')[6], byCat('shoes')[10], byCat('outerwear')[3]] },
  { i: 17, occasion: 'casual',     temp: 12, ids: () => [byCat('top')[2], byCat('bottom')[6], byCat('shoes')[11], byCat('outerwear')[5]] },
  { i: 18, occasion: 'casual',     temp: 25, ids: () => [byCat('top')[0], byCat('bottom')[6], byCat('shoes')[9]] },
  { i: 19, occasion: 'school',     temp: 17, ids: () => [byCat('top')[0], byCat('bottom')[7], byCat('shoes')[9]] },
  { i: 20, occasion: 'formal',     temp: 19, ids: () => [byCat('top')[1], byCat('bottom')[8], byCat('shoes')[10]] },
  { i: 21, occasion: 'casual',     temp: 9,  ids: () => [byCat('top')[13], byCat('bottom')[6], byCat('shoes')[11], byCat('outerwear')[4]] },
] as const

const outfitRows = OUTFITS.map(o => {
  const d = new Date(today)
  d.setDate(d.getDate() - (21 - o.i))
  return {
    user_id: USER_ID,
    date: d.toISOString().split('T')[0],
    occasion: o.occasion,
    weather_temp: o.temp,
    item_ids: o.ids(),
    explanation_text: 'Seeded look from the demo script.',
    is_favorite: o.i === 4 || o.i === 12,
    was_worn: o.i < 21,
    generated_by: 'rules' as const,
  }
})
const { error: outErr } = await supabase.from('outfits').insert(outfitRows)
if (outErr) { console.error(outErr); process.exit(1) }
console.log(`[seed-demo] Inserted ${outfitRows.length} outfit history rows.`)
console.log('[seed-demo] Done.')
