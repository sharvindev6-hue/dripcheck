import { NextRequest, NextResponse } from 'next/server'
import {
  badRequest,
  getAuth,
  logServerError,
  notFound,
  payloadTooLarge,
  serverError,
  unauthorized,
} from '@/lib/api'
import { itemUpdateSchema, uuidSchema } from '@/lib/schemas'
import { normalizeItem } from '@/lib/items'
import { readJsonBody } from '@/lib/body'
import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

interface Context {
  params: { id: string }
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const auth = await getAuth()
  if (!auth) return unauthorized()

  if (!uuidSchema.safeParse(params.id).success) return badRequest('bad_id')

  const body = await readJsonBody(req, 32 * 1024)
  if (!body.ok) {
    return body.reason === 'too_large' ? payloadTooLarge() : badRequest('bad_json')
  }

  const parsed = itemUpdateSchema.safeParse(body.value)
  if (!parsed.success) return badRequest('invalid_item')

  const { data, error } = await auth.supabase
    .from('items')
    .update(parsed.data)
    .eq('id', params.id)
    .eq('user_id', auth.user.id)
    .select('*')
    .maybeSingle()

  if (error) {
    logServerError('items:update', error)
    return serverError('could_not_update')
  }
  if (!data) return notFound('item_not_found')

  return NextResponse.json({ item: normalizeItem(data as Record<string, unknown>) })
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const auth = await getAuth()
  if (!auth) return unauthorized()

  if (!uuidSchema.safeParse(params.id).success) return badRequest('bad_id')

  const { data: row, error: readError } = await auth.supabase
    .from('items')
    .select('id, image_path')
    .eq('id', params.id)
    .eq('user_id', auth.user.id)
    .maybeSingle()

  if (readError) {
    logServerError('items:delete-read', readError)
    return serverError('could_not_delete')
  }
  if (!row) return notFound('item_not_found')

  const { error } = await auth.supabase
    .from('items')
    .delete()
    .eq('id', params.id)
    .eq('user_id', auth.user.id)

  if (error) {
    logServerError('items:delete', error)
    return serverError('could_not_delete')
  }

  // Remove the private object too. A failed cleanup must not resurrect the row.
  // The admin client can remove legacy root objects whose storage policy
  // depended on this item row; without a service key, owner-folder objects
  // still delete through the user-scoped client.
  if (row.image_path) {
    const storage = createAdminClient() ?? auth.supabase
    const { error: storageError } = await storage.storage
      .from('wardrobe-items')
      .remove([row.image_path])
    if (storageError) logServerError('items:delete-object', storageError)
  }

  return NextResponse.json({ ok: true })
}
