// Account privacy endpoints.
//
// GET    /api/account  → a JSON export of the signed-in user's data
// DELETE /api/account  → permanently delete the account, rows and photos
//
// Both derive the user from the session. The export never includes another
// user's rows; deletion removes storage objects before the auth row so the
// database cascade cannot leave orphaned private photos behind.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  badRequest,
  getAuth,
  logServerError,
  payloadTooLarge,
  serverError,
  tooMany,
  unauthorized,
} from '@/lib/api'
import { readJsonBody } from '@/lib/body'
import { rateLimitPair } from '@/lib/rate-limit'
import { normalizeItem, normalizeOutfit } from '@/lib/items'
import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const BUCKET = 'wardrobe-items'
const PAGE = 100
const MAX_PAGES = 200
const SIGNED_URL_TTL_SECONDS = 60 * 60

const deleteSchema = z.object({ confirm: z.literal('DELETE') }).strict()

export async function GET() {
  const auth = await getAuth()
  if (!auth) return unauthorized()

  const limit = rateLimitPair(auth.user.id, 'account:export', 5, 20)
  if (!limit.ok) return tooMany(limit)

  const [profileResult, itemsResult, outfitsResult] = await Promise.all([
    auth.supabase.from('users').select('*').eq('id', auth.user.id).maybeSingle(),
    auth.supabase.from('items').select('*').eq('user_id', auth.user.id),
    auth.supabase
      .from('outfits')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('date', { ascending: true }),
  ])

  const failure = profileResult.error ?? itemsResult.error ?? outfitsResult.error
  if (failure) {
    logServerError('account:export', failure)
    return serverError('could_not_export')
  }

  const items = ((itemsResult.data ?? []) as Record<string, unknown>[]).map(normalizeItem)
  const outfits = ((outfitsResult.data ?? []) as Record<string, unknown>[]).map(normalizeOutfit)

  // Photos are private, so the export carries short-lived signed links rather
  // than a permanent public URL.
  const paths = Array.from(
    new Set(items.map(item => item.image_path).filter((path): path is string => Boolean(path)))
  )
  const itemByPath = new Map<string, string>()
  for (const item of items) {
    if (item.image_path && !itemByPath.has(item.image_path)) itemByPath.set(item.image_path, item.id)
  }

  const photos: { item_id: string; path: string; signed_url: string | null }[] = []
  for (let index = 0; index < paths.length; index += PAGE) {
    const batch = paths.slice(index, index + PAGE)
    const { data, error } = await auth.supabase.storage
      .from(BUCKET)
      .createSignedUrls(batch, SIGNED_URL_TTL_SECONDS)
    if (error) {
      logServerError('account:export-sign', error)
      continue
    }
    for (const row of data ?? []) {
      const path = row.path
      if (!path) continue
      photos.push({
        item_id: itemByPath.get(path) ?? '',
        path,
        signed_url: row.signedUrl ?? null,
      })
    }
  }

  const payload = {
    exported_at: new Date().toISOString(),
    profile: profileResult.data ?? null,
    items,
    outfits,
    photos,
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="dripcheck-export.json"',
      'Cache-Control': 'no-store',
    },
  })
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuth()
  if (!auth) return unauthorized()

  const limit = rateLimitPair(auth.user.id, 'account:delete', 3, 10)
  if (!limit.ok) return tooMany(limit)

  const body = await readJsonBody(req, 1024)
  if (!body.ok) {
    return body.reason === 'too_large' ? payloadTooLarge() : badRequest('bad_json')
  }

  const parsed = deleteSchema.safeParse(body.value)
  if (!parsed.success) return badRequest('confirm_required')

  // Deleting the auth user needs the service role. Without it the app stays
  // usable, but account deletion is unavailable rather than half-done.
  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'delete_unavailable' }, { status: 503 })
  }

  // Legacy objects can sit at the bucket root; their paths are recorded on the
  // user's own item rows. Everything else lives under `<uid>/`.
  const { data: itemRows, error: itemError } = await auth.supabase
    .from('items')
    .select('image_path')
    .eq('user_id', auth.user.id)
  if (itemError) {
    logServerError('account:delete-read', itemError)
    return serverError('could_not_delete')
  }

  const legacyPaths = ((itemRows ?? []) as { image_path?: string | null }[])
    .map(row => row.image_path)
    .filter((path): path is string => Boolean(path))

  const folderPaths: string[] = []
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list(auth.user.id, { limit: PAGE, offset: page * PAGE })
    if (error) {
      logServerError('account:delete-list', error)
      return serverError('could_not_delete')
    }
    const objects = data ?? []
    if (objects.length === 0) break
    for (const object of objects) folderPaths.push(`${auth.user.id}/${object.name}`)
    if (objects.length < PAGE) break
  }

  const paths = Array.from(new Set([...folderPaths, ...legacyPaths]))
  for (let index = 0; index < paths.length; index += PAGE) {
    const { error } = await admin.storage.from(BUCKET).remove(paths.slice(index, index + PAGE))
    if (error) logServerError('account:delete-storage', error)
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(auth.user.id)
  if (deleteError) {
    logServerError('account:delete-auth', deleteError)
    return serverError('could_not_delete')
  }

  const { error: signOutError } = await auth.supabase.auth.signOut()
  if (signOutError) logServerError('account:signout', signOutError)

  // Id only: never log the email or any wardrobe content.
  console.info(`[dripcheck:account:deleted] ${auth.user.id}`)

  return NextResponse.json({ ok: true })
}
