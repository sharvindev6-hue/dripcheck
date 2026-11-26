import { NextRequest, NextResponse } from 'next/server'
import { getAuth, logServerError, serverError, unauthorized } from '@/lib/api'
import { buildStats } from '@/lib/stats'
import { normalizeItem, normalizeOutfit } from '@/lib/items'
import { getTodayLocalDateString } from '@/lib/date'
import { dateSchema } from '@/lib/schemas'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await getAuth()
  if (!auth) return unauthorized()

  // The streak and week are calendar concepts in the user's timezone. A server
  // running in UTC would otherwise roll the day over hours before the user does.
  const requestedToday = request.nextUrl.searchParams.get('today')
  const parsedToday = requestedToday ? dateSchema.safeParse(requestedToday) : null
  const today = parsedToday?.success ? parsedToday.data : getTodayLocalDateString()

  const [itemsResult, outfitsResult] = await Promise.all([
    auth.supabase.from('items').select('*').eq('user_id', auth.user.id),
    auth.supabase
      .from('outfits')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('date', { ascending: true }),
  ])

  if (itemsResult.error || outfitsResult.error) {
    logServerError('stats', itemsResult.error ?? outfitsResult.error)
    return serverError('could_not_load')
  }

  const items = ((itemsResult.data ?? []) as Record<string, unknown>[]).map(normalizeItem)
  const outfits = ((outfitsResult.data ?? []) as Record<string, unknown>[]).map(normalizeOutfit)

  return NextResponse.json({ stats: buildStats(items, outfits, today) })
}
