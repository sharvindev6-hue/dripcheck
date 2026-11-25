// Server-side stylist endpoint. The client sends only the occasion, temperature
// and an optional note. Everything else — the wardrobe, recent looks, profile
// preference — is read here. Any AI failure falls back to the rules engine, so
// the user always gets a complete look.

import { NextRequest, NextResponse } from 'next/server'
import {
  badRequest,
  getAuth,
  logServerError,
  serverError,
  tooMany,
  unauthorized,
} from '@/lib/api'
import { rateLimitPair } from '@/lib/rate-limit'
import { stylistRequestSchema } from '@/lib/schemas'
import { normalizeItem } from '@/lib/items'
import { getServerEnv } from '@/lib/env'
import {
  comboFromIds,
  explainOutfit,
  generateOutfit,
  matchPercent,
  scoreCombo,
  type EngineOptions,
  type SilhouettePreference,
} from '@/lib/outfitEngine'
import { orderOutfitIds } from '@/lib/outfitSlots'
import type { Item } from '@/types'

export const dynamic = 'force-dynamic'

const FEATHERLESS_TIMEOUT_MS = 12_000
const FEATHERLESS_URL = 'https://api.featherless.ai/v1/chat/completions'

const SYSTEM_PROMPT = `You are the DripCheck stylist. Warm, confident, concise — max 2 sentences. You MUST pick only from the provided wardrobe items. Never invent garments. Slots are strict: top_id must be a top, bottom_id a bottom, shoes_id shoes, outer_id an outer layer or null. Prefer clean items that suit the temperature and occasion. Reply with raw JSON only, no markdown: {"top_id":"","bottom_id":"","shoes_id":"","outer_id":null,"explanation":""}`

interface AiResponse {
  top_id?: string
  bottom_id?: string
  shoes_id?: string
  outer_id?: string | null
  explanation?: string
}

function clampExplanation(value: string | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  return trimmed.length <= 240 ? trimmed : `${trimmed.slice(0, 237)}…`
}

function parseAiJson(raw: string): AiResponse | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    return parsed && typeof parsed === 'object' ? (parsed as AiResponse) : null
  } catch {
    const object = cleaned.match(/\{[\s\S]*\}/)
    if (!object) return null
    try {
      return JSON.parse(object[0]) as AiResponse
    } catch {
      return null
    }
  }
}

function validateAi(
  result: AiResponse | null,
  items: Item[]
): { ok: true; ordered: string[]; explanation: string } | { ok: false; reason: string } {
  if (!result) return { ok: false, reason: 'unparseable' }
  const ids = [result.top_id, result.bottom_id, result.shoes_id].filter(
    (id): id is string => typeof id === 'string'
  )
  if (ids.length !== 3) return { ok: false, reason: 'missing_slots' }
  if (result.outer_id) ids.push(result.outer_id)

  // Category + ownership guard. A top can never occupy the bottom slot.
  const ordered = orderOutfitIds(items, ids)
  if (!ordered) return { ok: false, reason: 'bad_slots' }

  const byId = new Map(items.map(item => [item.id, item]))
  if (ordered.some(id => byId.get(id)?.status === 'dirty')) {
    return { ok: false, reason: 'dirty_item' }
  }

  return { ok: true, ordered, explanation: clampExplanation(result.explanation) }
}

async function callFeatherless(messages: { role: 'system' | 'user'; content: string }[]) {
  const env = getServerEnv()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FEATHERLESS_TIMEOUT_MS)
  try {
    const response = await fetch(FEATHERLESS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.FEATHERLESS_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.FEATHERLESS_MODEL || 'featherless-ai/Qwen2.5-7B-Instruct',
        messages,
        temperature: 0.4,
        max_tokens: 300,
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`featherless_${response.status}`)
    const data = await response.json()
    return (data?.choices?.[0]?.message?.content ?? '') as string
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuth()
  if (!auth) return unauthorized()

  const limit = rateLimitPair(auth.user.id, 'stylist', 30, 300)
  if (!limit.ok) return tooMany(limit)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const parsed = stylistRequestSchema.safeParse(body)
  if (!parsed.success) return badRequest('invalid_request')
  const input = parsed.data

  const occasion = input.occasion ?? 'casual'
  const temp = input.temp ?? null
  const note = input.note ?? ''

  const [itemsResult, recentResult, profileResult] = await Promise.all([
    auth.supabase.from('items').select('*').eq('user_id', auth.user.id),
    auth.supabase
      .from('outfits')
      .select('item_ids')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    auth.supabase.from('users').select('silhouette').eq('id', auth.user.id).maybeSingle(),
  ])

  if (itemsResult.error) {
    logServerError('stylist:items', itemsResult.error)
    return serverError('could_not_load')
  }

  const items = ((itemsResult.data ?? []) as Record<string, unknown>[]).map(normalizeItem)
  if (items.length < 3) {
    return NextResponse.json({ error: 'not_enough_items' }, { status: 422 })
  }

  const recentCombos = ((recentResult.data ?? []) as { item_ids?: string[] }[])
    .map(row => row.item_ids ?? [])
    .filter(ids => ids.length > 0)
  const recentItemIds = Array.from(new Set(recentCombos.flat()))
  const silhouette = (profileResult.data?.silhouette ?? null) as SilhouettePreference

  const options: EngineOptions = { recentItemIds, recentCombos, silhouette }

  const rulesCombo = generateOutfit(items, temp, occasion, options)
  if (!rulesCombo) {
    return NextResponse.json({ error: 'no_outfit_possible' }, { status: 422 })
  }

  const rulesOrdered = [
    rulesCombo.top.id,
    rulesCombo.bottom.id,
    rulesCombo.shoes.id,
    ...(rulesCombo.outerwear ? [rulesCombo.outerwear.id] : []),
  ]

  const rulesResponse = {
    source: 'rules' as const,
    item_ids: rulesOrdered,
    explanation: explainOutfit(rulesCombo, temp, occasion),
    match: matchPercent(rulesCombo.score),
    occasion,
  }

  const apiKey = getServerEnv().FEATHERLESS_API_KEY
  if (!apiKey) return NextResponse.json(rulesResponse)

  const payload = JSON.stringify({
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      primary_color: item.primary_color,
      formality: item.formality,
      warmth: item.warmth,
      status: item.status,
      fit: item.fit,
    })),
    temperature: temp,
    occasion,
    note,
    recent_combinations: recentCombos,
  })

  try {
    const first = await callFeatherless([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: payload },
    ])
    const checked = validateAi(parseAiJson(first), items)
    if (checked.ok) {
      const combo = comboFromIds(items, checked.ordered)
      if (combo) {
        return NextResponse.json({
          source: 'ai',
          item_ids: checked.ordered,
          explanation: checked.explanation || explainOutfit(combo, temp, occasion),
          match: matchPercent(scoreCombo(combo.top, combo.bottom, combo.shoes, combo.outerwear, temp, occasion, options)),
          occasion,
        })
      }
    }

    const second = await callFeatherless([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: payload },
      {
        role: 'user',
        content:
          'Your previous reply was invalid. Return ONLY valid JSON matching the schema. IDs must match the provided wardrobe and their categories must match the slot.',
      },
    ])
    const retried = validateAi(parseAiJson(second), items)
    if (retried.ok) {
      const combo = comboFromIds(items, retried.ordered)
      if (combo) {
        return NextResponse.json({
          source: 'ai',
          item_ids: retried.ordered,
          explanation: retried.explanation || explainOutfit(combo, temp, occasion),
          match: matchPercent(scoreCombo(combo.top, combo.bottom, combo.shoes, combo.outerwear, temp, occasion, options)),
          occasion,
        })
      }
    }
  } catch (error) {
    logServerError('stylist:ai', error)
  }

  return NextResponse.json(rulesResponse)
}
