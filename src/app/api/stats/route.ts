import { NextResponse } from 'next/server'
import { getAuth, logServerError, serverError, unauthorized } from '@/lib/api'
import { buildStats } from '@/lib/stats'
import { normalizeItem, normalizeOutfit } from '@/lib/items'
import { getTodayLocalDateString } from '@/lib/date'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await getAuth()
  if (!auth) return unauthorized()

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

  return NextResponse.json({ stats: buildStats(items, outfits, getTodayLocalDateString()) })
}
