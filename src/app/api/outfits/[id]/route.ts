import { NextRequest, NextResponse } from 'next/server'
import {
  badRequest,
  getAuth,
  logServerError,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api'
import { normalizeItem, normalizeOutfit } from '@/lib/items'
import { outfitUpdateSchema, uuidSchema } from '@/lib/schemas'

export const dynamic = 'force-dynamic'

interface Context {
  params: { id: string }
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const auth = await getAuth()
  if (!auth) return unauthorized()
  if (!uuidSchema.safeParse(params.id).success) return badRequest('bad_id')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('bad_json')
  }

  const parsed = outfitUpdateSchema.safeParse(body)
  if (!parsed.success) return badRequest('invalid_outfit')

  const { data: existing, error: readError } = await auth.supabase
    .from('outfits')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', auth.user.id)
    .maybeSingle()

  if (readError) {
    logServerError('outfits:update-read', readError)
    return serverError('could_not_update')
  }
  if (!existing) return notFound('outfit_not_found')

  const patch: Record<string, unknown> = {}
  if (typeof parsed.data.is_favorite === 'boolean') patch.is_favorite = parsed.data.is_favorite
  if (typeof parsed.data.was_worn === 'boolean') patch.was_worn = parsed.data.was_worn

  const { data: saved, error } = await auth.supabase
    .from('outfits')
    .update(patch)
    .eq('id', params.id)
    .eq('user_id', auth.user.id)
    .select('*')
    .single()

  if (error) {
    logServerError('outfits:update', error)
    return serverError('could_not_update')
  }

  const ids: string[] = Array.isArray(existing.item_ids) ? existing.item_ids : []
  const markingWorn = parsed.data.was_worn === true && existing.was_worn !== true
  const unmarkingWorn = parsed.data.was_worn === false && existing.was_worn === true

  if (markingWorn || unmarkingWorn) {
    const { data: rows } = await auth.supabase
      .from('items')
      .select('*')
      .in('id', ids)
      .eq('user_id', auth.user.id)

    await Promise.all(
      ((rows ?? []) as Record<string, unknown>[]).map(async raw => {
        const item = normalizeItem(raw)
        const nextCount = markingWorn
          ? (item.times_worn ?? 0) + 1
          : Math.max(0, (item.times_worn ?? 0) - 1)
        const { error: counterError } = await auth.supabase
          .from('items')
          .update({
            times_worn: nextCount,
            ...(markingWorn ? { last_worn: existing.date } : {}),
          })
          .eq('id', item.id)
          .eq('user_id', auth.user.id)
        if (counterError) logServerError('outfits:update-counter', counterError)
      })
    )
  }

  return NextResponse.json({ outfit: normalizeOutfit(saved as Record<string, unknown>) })
}
