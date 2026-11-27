import { NextRequest, NextResponse } from 'next/server'
import {
  badRequest,
  getAuth,
  logServerError,
  payloadTooLarge,
  serverError,
  unauthorized,
} from '@/lib/api'
import { readJsonBody } from '@/lib/body'
import { profileUpdateSchema } from '@/lib/schemas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await getAuth()
  if (!auth) return unauthorized()

  const { data, error } = await auth.supabase
    .from('users')
    .select('*')
    .eq('id', auth.user.id)
    .maybeSingle()

  if (error) {
    logServerError('profile:get', error)
    return serverError('could_not_load')
  }

  return NextResponse.json({ profile: data ?? null })
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuth()
  if (!auth) return unauthorized()

  const body = await readJsonBody(req, 8 * 1024)
  if (!body.ok) {
    return body.reason === 'too_large' ? payloadTooLarge() : badRequest('bad_json')
  }

  const parsed = profileUpdateSchema.safeParse(body.value)
  if (!parsed.success) return badRequest('invalid_profile')

  const { data, error } = await auth.supabase
    .from('users')
    .upsert(
      {
        id: auth.user.id,
        email: auth.user.email ?? '',
        ...parsed.data,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single()

  if (error) {
    logServerError('profile:update', error)
    return serverError('could_not_save')
  }

  return NextResponse.json({ profile: data })
}
