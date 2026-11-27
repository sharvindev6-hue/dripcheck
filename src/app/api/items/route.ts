import { NextRequest, NextResponse } from 'next/server'
import {
  badRequest,
  forbidden,
  getAuth,
  logServerError,
  payloadTooLarge,
  serverError,
  unauthorized,
} from '@/lib/api'
import { itemCreateSchema } from '@/lib/schemas'
import { normalizeItem } from '@/lib/items'
import { readJsonBody } from '@/lib/body'
import { colorHex, inferFit, inferGarmentType } from '@/lib/garment'
import { rateLimitPair } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await getAuth()
  if (!auth) return unauthorized()

  const limit = rateLimitPair(auth.user.id, 'items:create', 60, 500)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    )
  }

  const body = await readJsonBody(req, 32 * 1024)
  if (!body.ok) {
    return body.reason === 'too_large' ? payloadTooLarge() : badRequest('bad_json')
  }

  const parsed = itemCreateSchema.safeParse(body.value)
  if (!parsed.success) return badRequest('invalid_item')
  const input = parsed.data

  if (input.image_path && !input.image_path.startsWith(`${auth.user.id}/`)) {
    return forbidden('bad_image_path')
  }

  const garmentType = input.garment_type ?? inferGarmentType(input.name, input.category)
  const fit = input.fit ?? inferFit(input.name, garmentType)
  const hex = input.color_hex ?? colorHex(input.primary_color)

  const { data, error } = await auth.supabase
    .from('items')
    .insert({
      user_id: auth.user.id,
      name: input.name,
      category: input.category,
      primary_color: input.primary_color,
      secondary_color: input.secondary_color ?? null,
      formality: input.formality,
      warmth: input.warmth,
      price: input.price ?? null,
      image_path: input.image_path ?? null,
      image_url: null,
      garment_type: garmentType,
      color_hex: hex,
      fit,
      status: input.status ?? 'clean',
    })
    .select('*')
    .single()

  if (error) {
    logServerError('items:create', error)
    return serverError('could_not_save')
  }

  return NextResponse.json({ item: normalizeItem(data as Record<string, unknown>) }, { status: 201 })
}
