// Server-side stylist endpoint. The client only sends { occasion, temp?, note? } —
// ALL other context (items, recent outfits) is fetched here. Without FEATHERLESS_API_KEY
// the route silently falls through to the rules engine, so the app never goes dark.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { generateOutfit, getTemplateExplanation } from '@/lib/outfitEngine'
import type { Item } from '@/types'

export const dynamic = 'force-dynamic'

// 12s is plenty for a small chat completion on Featherless; longer than that means
// the network is wedged and the user should get a rules-engine fallback instead
// of staring at a spinner.
const FEATHERLESS_TIMEOUT_MS = 12_000

const SYSTEM_PROMPT = `You are Milli, DripCheck\'s personal AI stylist. Warm, confident, Gen-Z voice, max 2 sentences. You ONLY pick from provided items — never invent garments. Reply ONLY with raw JSON, no markdown fences: {"top_id":"","bottom_id":"","shoes_id":"","outer_id":null,"explanation":""}`

const FEATHERLESS_URL = 'https://api.featherless.ai/v1/chat/completions'

interface StylistRequestBody {
  occasion?: string
  temp?: number | null
  note?: string
}

interface AiResponse {
  top_id?: string
  bottom_id?: string
  shoes_id?: string
  outer_id?: string | null
  explanation?: string
}

function clampExplanation(s: string | undefined): string {
  if (!s) return ''
  const trimmed = s.trim()
  return trimmed.length <= 240 ? trimmed : trimmed.slice(0, 237) + '…'
}

function stripJsonFences(s: string): string {
  // Some models wrap JSON in ```json fences despite instructions.
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
}

function tryParseJson(s: string): AiResponse | null {
  try {
    const obj = JSON.parse(s)
    return typeof obj === 'object' && obj ? (obj as AiResponse) : null
  } catch {
    // Some models return a trailing comma or extra prose — try a forgiving slice.
    const m = s.match(/\{[\s\S]*\}/)
    if (m) {
      try { return JSON.parse(m[0]) as AiResponse } catch { return null }
    }
    return null
  }
}

function validate(out: AiResponse | null, items: Item[]): { ok: true; ids: string[]; explanation: string } | { ok: false; reason: string } {
  if (!out) return { ok: false, reason: 'unparseable' }
  const ids = new Set(items.map(i => i.id))
  if (!out.top_id || !ids.has(out.top_id))         return { ok: false, reason: 'bad_top_id' }
  if (!out.bottom_id || !ids.has(out.bottom_id))   return { ok: false, reason: 'bad_bottom_id' }
  if (!out.shoes_id || !ids.has(out.shoes_id))     return { ok: false, reason: 'bad_shoes_id' }
  if (out.outer_id && !ids.has(out.outer_id))       return { ok: false, reason: 'bad_outer_id' }
  return { ok: true, ids: [out.top_id, out.bottom_id, out.shoes_id, ...(out.outer_id ? [out.outer_id] : [])], explanation: clampExplanation(out.explanation) }
}

async function callFeatherless(messages: { role: 'system' | 'user'; content: string }[]): Promise<string> {
  const apiKey = process.env.FEATHERLESS_API_KEY
  const model  = process.env.FEATHERLESS_MODEL || 'featherless-ai/Qwen2.5-7B-Instruct'
  // AbortController kills the socket if Featherless hangs. Caller treats the
  // AbortError like any other failure and falls through to the rules engine,
  // so a slow network never breaks the user experience.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FEATHERLESS_TIMEOUT_MS)
  try {
    const r = await fetch(FEATHERLESS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 300 }),
      signal: controller.signal,
    })
    if (!r.ok) throw new Error(`featherless_${r.status}`)
    const data = await r.json()
    return data?.choices?.[0]?.message?.content ?? ''
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(req: NextRequest) {
  let body: StylistRequestBody = {}
  try { body = (await req.json()) as StylistRequestBody } catch { /* allow empty */ }
  const occasion = (body.occasion || 'casual').toString()
  const temp     = typeof body.temp === 'number' ? body.temp : null
  const note     = (body.note || '').toString().slice(0, 280)

  // 1. Auth is optional while the app is publicly accessible. Anonymous users
  // receive an empty wardrobe response instead of being redirected to login.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'not_enough_items' }, { status: 422 })
  }

  // 2. Items
  const { data: items } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', user.id)
  if (!items || items.length < 3) {
    return NextResponse.json({ error: 'not_enough_items' }, { status: 422 })
  }

  // 3. Recent combinations (deduped item_ids from last 5 outfits)
  const { data: recent } = await supabase
    .from('outfits')
    .select('item_ids')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)
  const recentItemIds: string[] = Array.from(new Set((recent ?? []).flatMap(o => o.item_ids ?? [])))

  // 4. Rules path (always available, used as the fallback)
  const rulesCombo = generateOutfit(items as Item[], temp, occasion, recentItemIds)
  if (!rulesCombo) {
    return NextResponse.json({ error: 'no_outfit_possible' }, { status: 422 })
  }
  const rulesResult = {
    source: 'rules' as const,
    item_ids: [rulesCombo.top.id, rulesCombo.bottom.id, rulesCombo.shoes.id, ...(rulesCombo.outerwear ? [rulesCombo.outerwear.id] : [])],
    explanation: getTemplateExplanation(rulesCombo),
  }

  // 5. AI path
  if (!process.env.FEATHERLESS_API_KEY) {
    return NextResponse.json(rulesResult)
  }

  const userPayload = JSON.stringify({
    items: items.map(i => ({
      id: i.id, name: i.name, category: i.category,
      primary_color: i.primary_color, formality: i.formality, warmth: i.warmth,
    })),
    temperature: temp,
    occasion,
    note,
    recent_combinations: recentItemIds,
  })

  try {
    const first  = await callFeatherless([{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPayload }])
    const parsed = tryParseJson(stripJsonFences(first))
    const v1     = validate(parsed, items as Item[])
    if (v1.ok) {
      return NextResponse.json({ source: 'ai', item_ids: v1.ids, explanation: v1.explanation })
    }
    // One retry with explicit correction
    const second = await callFeatherless([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPayload },
      { role: 'user', content: 'Your previous reply was invalid. Return ONLY valid JSON matching the schema, no markdown, no commentary.' },
    ])
    const v2 = validate(tryParseJson(stripJsonFences(second)), items as Item[])
    if (v2.ok) {
      return NextResponse.json({ source: 'ai', item_ids: v2.ids, explanation: v2.explanation })
    }
  } catch {
    // fall through to rules — includes AbortError (timeout), network, parse
  }
  return NextResponse.json(rulesResult)
}
