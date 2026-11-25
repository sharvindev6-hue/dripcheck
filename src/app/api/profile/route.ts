import { NextRequest, NextResponse } from 'next/server'
import {
  badRequest,
  getAuth,
  logServerError,
  serverError,
  unauthorized,
} from '@/lib/api'
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('bad_json')
  }

  const parsed = profileUpdateSchema.safeParse(body)
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
