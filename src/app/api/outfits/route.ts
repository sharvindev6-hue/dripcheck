import { NextRequest, NextResponse } from 'next/server'
import {
  badRequest,
  getAuth,
  logServerError,
  serverError,
  unauthorized,
  type ServerSupabase,
} from '@/lib/api'
import { outfitCreateSchema } from '@/lib/schemas'
import { normalizeItem, normalizeOutfit } from '@/lib/items'
import { orderOutfitIds } from '@/lib/outfitSlots'
import { rateLimitPair } from '@/lib/rate-limit'
import type { Item } from '@/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await getAuth()
  if (!auth) return unauthorized()

  const limit = rateLimitPair(auth.user.id, 'outfits:save', 60, 500)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('bad_json')
  }

  const parsed = outfitCreateSchema.safeParse(body)
  if (!parsed.success) return badRequest('invalid_outfit')
  const input = parsed.data

  const { data: rows, error: itemsError } = await auth.supabase
    .from('items')
    .select('*')
    .in('id', input.item_ids)
    .eq('user_id', auth.user.id)

  if (itemsError) {
    logServerError('outfits:items', itemsError)
    return serverError('could_not_save')
  }

  const items = ((rows ?? []) as Record<string, unknown>[]).map(normalizeItem)
  const ordered = orderOutfitIds(items, input.item_ids)
  if (!ordered) {
    // This is the slot/category guard: a top cannot be saved in the bottom slot.
    return badRequest('invalid_slots')
  }

  const { data: previous } = await auth.supabase
    .from('outfits')
    .select('was_worn, item_ids')
    .eq('user_id', auth.user.id)
    .eq('date', input.date)
    .maybeSingle()

  const { data: saved, error } = await auth.supabase
    .from('outfits')
    .upsert(
      {
        user_id: auth.user.id,
        date: input.date,
        occasion: input.occasion,
        weather_temp: input.weather_temp ?? null,
        item_ids: ordered,
        explanation_text: input.explanation_text ?? null,
        generated_by: input.generated_by ?? 'rules',
        was_worn: input.was_worn ?? false,
      },
      { onConflict: 'user_id,date' }
    )
    .select('*')
    .single()

  if (error) {
    logServerError('outfits:upsert', error)
    return serverError('could_not_save')
  }

  // Keep lifetime wear counters exact when a worn day is replaced:
  // new pieces gain one wear, removed pieces lose one. Same look = no change.
  const previousIds: string[] = Array.isArray(previous?.item_ids)
    ? previous.item_ids.filter((id: unknown): id is string => typeof id === 'string')
    : []
  const nextIds = new Set(ordered)

  if (input.was_worn) {
    if (!previous?.was_worn) {
      await bumpWearCounters(auth.supabase, auth.user.id, items, input.date)
    } else {
      const added = items.filter(item => !previousIds.includes(item.id))
      if (added.length > 0) {
        await bumpWearCounters(auth.supabase, auth.user.id, added, input.date)
      }
      const removed = previousIds.filter(id => !nextIds.has(id))
      if (removed.length > 0) {
        await decrementWearCounters(auth.supabase, auth.user.id, removed)
      }
    }
  } else if (previous?.was_worn) {
    await decrementWearCounters(auth.supabase, auth.user.id, previousIds)
  }

  return NextResponse.json({ outfit: normalizeOutfit(saved as Record<string, unknown>) }, { status: 201 })
}

async function bumpWearCounters(
  supabase: ServerSupabase,
  userId: string,
  items: Item[],
  date: string
) {
  await Promise.all(
    items.map(async item => {
      const { error } = await supabase
        .from('items')
        .update({ times_worn: (item.times_worn ?? 0) + 1, last_worn: date })
        .eq('id', item.id)
        .eq('user_id', userId)
      if (error) logServerError('outfits:wear-counter', error)
    })
  )
}

async function decrementWearCounters(
  supabase: ServerSupabase,
  userId: string,
  ids: string[]
) {
  if (ids.length === 0) return
  const { data: rows, error } = await supabase
    .from('items')
    .select('id, times_worn')
    .in('id', ids)
    .eq('user_id', userId)

  if (error) {
    logServerError('outfits:wear-counter-read', error)
    return
  }

  await Promise.all(
    ((rows ?? []) as { id: string; times_worn?: number }[]).map(async row => {
      const { error: updateError } = await supabase
        .from('items')
        .update({ times_worn: Math.max(0, (row.times_worn ?? 0) - 1) })
        .eq('id', row.id)
        .eq('user_id', userId)
      if (updateError) logServerError('outfits:wear-counter-down', updateError)
    })
  )
}
