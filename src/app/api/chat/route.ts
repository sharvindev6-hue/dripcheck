import { NextRequest, NextResponse } from 'next/server'
import {
  badRequest,
  getAuth,
  logServerError,
  serverError,
  tooMany,
  unauthorized,
} from '@/lib/api'
import { chatRequestSchema } from '@/lib/schemas'
import { normalizeItem } from '@/lib/items'
import { rateLimitPair } from '@/lib/rate-limit'
import {
  comboFromIds,
  explainOutfit,
  generateOutfit,
  getWarmthBand,
  matchPercent,
  scoreCombo,
  type OutfitCombo,
} from '@/lib/outfitEngine'
import { getOccasionTarget } from '@/lib/constants'
import type { Item } from '@/types'

export const dynamic = 'force-dynamic'

const FORMALITY_ORDER: Item['formality'][] = ['casual', 'smart_casual', 'formal']
const WARMTH_VALUE: Record<Item['warmth'], number> = { hot: 0, mild: 1, cold: 2 }

type Slot = 'top' | 'bottom' | 'shoes' | 'outerwear'

function occasionFromMessage(message: string): string | null {
  const text = message.toLowerCase()
  if (/interview|office|work|meeting|job/.test(text)) return 'interview'
  if (/date|dinner|romantic/.test(text)) return 'date_night'
  if (/party|wedding|gala|formal|event/.test(text)) return 'formal'
  if (/school|class|lecture|campus/.test(text)) return 'school'
  if (/gym|workout|training|run/.test(text)) return 'casual'
  if (/casual|weekend|errand|chill|relax/.test(text)) return 'casual'
  return null
}

function comboScore(combo: OutfitCombo, temp: number | null, occasion: string): number {
  return scoreCombo(combo.top, combo.bottom, combo.shoes, combo.outerwear, temp, occasion, {
    recentItemIds: [],
  })
}

function withSlot(combo: OutfitCombo, slot: Slot, item: Item): OutfitCombo {
  if (slot === 'outerwear') return { ...combo, outerwear: item }
  return { ...combo, [slot]: item }
}

function pickForSlot(
  candidates: Item[],
  combo: OutfitCombo,
  slot: Slot,
  target: Item['formality'],
  anchorColor: string,
  band: 'hot' | 'mild' | 'cold',
  avoid: Set<string>
): Item | null {
  const current = combo[slot]
  const pool = candidates.filter(item => item.category === slot && item.status !== 'dirty' && item.id !== current?.id)
  if (pool.length === 0) return null

  const scored = pool.map(item => {
    let score = 0
    const formalityDelta = Math.abs(FORMALITY_ORDER.indexOf(item.formality) - FORMALITY_ORDER.indexOf(target))
    score += formalityDelta === 0 ? 4 : formalityDelta === 1 ? 1 : -4
    const warmthDelta = Math.abs(WARMTH_VALUE[item.warmth] - WARMTH_VALUE[band])
    score += warmthDelta === 0 ? 3 : warmthDelta === 1 ? 1 : -2
    if (item.primary_color.toLowerCase().includes(anchorColor.toLowerCase())) score += 2
    if (avoid.has(item.id)) score -= 6
    return { item, score }
  })

  scored.sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
  return scored[0]?.item ?? null
}

export async function POST(req: NextRequest) {
  const auth = await getAuth()
  if (!auth) return unauthorized()

  const limit = rateLimitPair(auth.user.id, 'chat', 30, 300)
  if (!limit.ok) return tooMany(limit)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('bad_json')
  }

  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) return badRequest('invalid_message')
  const input = parsed.data

  const { data: rows, error } = await auth.supabase
    .from('items')
    .select('*')
    .eq('user_id', auth.user.id)

  if (error) {
    logServerError('chat:items', error)
    return serverError('could_not_load')
  }

  const items = ((rows ?? []) as Record<string, unknown>[]).map(normalizeItem)
  if (items.length < 3) {
    return NextResponse.json({ error: 'not_enough_items' }, { status: 422 })
  }

  const temp = input.temp ?? null
  const occasion = input.occasion ?? 'casual'
  const band = getWarmthBand(temp)
  const target = getOccasionTarget(occasion)
  const currentIds = input.item_ids ?? []

  const initial =
    comboFromIds(items, currentIds) ??
    generateOutfit(items, temp, occasion, { seedItemId: null })
  if (!initial) {
    return NextResponse.json({ error: 'no_outfit_possible' }, { status: 422 })
  }
  let combo: OutfitCombo = initial

  const used = new Set(currentIds)
  const text = input.message.toLowerCase()
  let reply = ''
  let nextOccasion = occasion

  const respond = (message: string, next: OutfitCombo, nextOcc: string = occasion) => {
    const ordered = [
      next.top.id,
      next.bottom.id,
      next.shoes.id,
      ...(next.outerwear ? [next.outerwear.id] : []),
    ]
    return NextResponse.json({
      reply: message,
      item_ids: ordered,
      explanation: explainOutfit(next, temp, nextOcc),
      match: matchPercent(comboScore(next, temp, nextOcc)),
      occasion: nextOcc,
    })
  }

  if (/warm|cold|freez|chill|layer/.test(text)) {
    const outers = items.filter(item => item.category === 'outerwear')
    const outer = pickForSlot(outers, combo, 'outerwear', target, combo.top.primary_color, band, used)
    if (outer) {
      combo = withSlot(combo, 'outerwear', outer)
      reply = `Added the ${outer.name}. It layers over the ${combo.top.name} for extra warmth.`
      return respond(reply, combo)
    }

    const tops = items.filter(item => item.category === 'top')
    const warmer = tops
      .filter(item => item.id !== combo.top.id && WARMTH_VALUE[item.warmth] > WARMTH_VALUE[combo.top.warmth])
      .sort((a, b) => WARMTH_VALUE[b.warmth] - WARMTH_VALUE[a.warmth])[0]
    if (warmer) {
      combo = withSlot(combo, 'top', warmer)
      reply = `Swapped in the ${warmer.name}. It is the warmest top you have that still works here.`
      return respond(reply, combo)
    }

    return respond(
      'You are already in the warmest pieces you own for this look. Add a heavier layer to your closet and I can go warmer.',
      combo
    )
  }

  if (/dress|formal|smart|date|dinner|nice|sharp|interview/.test(text)) {
    const currentRank = FORMALITY_ORDER.indexOf(combo.top.formality)
    const nextTarget = FORMALITY_ORDER[Math.min(FORMALITY_ORDER.length - 1, currentRank + 1)]
    const changes: string[] = []

    for (const slot of ['top', 'bottom', 'shoes', 'outerwear'] as Slot[]) {
      if (slot === 'outerwear' && !combo.outerwear) continue
      const picked = pickForSlot(items, combo, slot, nextTarget, combo.top.primary_color, band, used)
      if (picked) {
        combo = withSlot(combo, slot, picked)
        changes.push(picked.name)
      }
    }

    if (changes.length === 0) {
      return respond('Your closet does not have a dressier option for this look yet.', combo)
    }
    return respond(`Dressed it up with ${changes.join(', ')}. Sharper, same shape.`, combo)
  }

  if (/casual|relax|comfy|lazy|simple|easy/.test(text)) {
    const currentRank = FORMALITY_ORDER.indexOf(combo.top.formality)
    const nextTarget = FORMALITY_ORDER[Math.max(0, currentRank - 1)]
    const changes: string[] = []

    for (const slot of ['top', 'bottom', 'shoes'] as Slot[]) {
      const picked = pickForSlot(items, combo, slot, nextTarget, combo.top.primary_color, band, used)
      if (picked) {
        combo = withSlot(combo, slot, picked)
        changes.push(picked.name)
      }
    }

    if (changes.length === 0) return respond('This is already as casual as your closet goes.', combo)
    return respond(`Made it easier: ${changes.join(', ')}.`, combo)
  }

  if (/shoe|sneaker|loafer|boot/.test(text)) {
    const shoe = pickForSlot(items, combo, 'shoes', target, combo.top.primary_color, band, used)
    if (!shoe) return respond('You only have one pair of shoes in the closet right now.', combo)
    combo = withSlot(combo, 'shoes', shoe)
    return respond(`Swapped the shoes for the ${shoe.name}.`, combo)
  }

  if (/black|dark/.test(text)) {
    const isBlack = (item: Item) => /black|charcoal/.test(item.primary_color.toLowerCase())
    const changes: string[] = []
    for (const slot of ['top', 'bottom', 'shoes'] as Slot[]) {
      const options = items.filter(
        item =>
          item.category === slot &&
          item.status !== 'dirty' &&
          isBlack(item) &&
          item.id !== combo[slot]?.id
      )
      if (options.length > 0) {
        combo = withSlot(combo, slot, options[0])
        changes.push(options[0].name)
      }
    }
    if (changes.length === 0) return respond('No black pieces in your closet yet.', combo)
    return respond(`Went dark: ${changes.join(', ')}.`, combo)
  }

  if (/another|different|else|new|swap|change|surprise/.test(text)) {
    const next = generateOutfit(items, temp, occasion, { recentItemIds: Array.from(used) })
    if (!next) return respond('I could not build another complete look from your closet.', combo)
    return respond('Here is a different direction.', next)
  }

  const askedOccasion = occasionFromMessage(text)
  if (askedOccasion) {
    nextOccasion = askedOccasion
    const next = generateOutfit(items, temp, nextOccasion, { recentItemIds: Array.from(used) })
    if (next) {
      return respond(`Built this for ${askedOccasion.replace(/_/g, ' ')}.`, next, nextOccasion)
    }
  }

  const fallback = generateOutfit(items, temp, occasion, { recentItemIds: Array.from(used) })
  if (!fallback) return respond('Tell me the vibe — warmer, dressier, more casual — and I will restyle you.', combo)
  return respond(explainOutfit(fallback, temp, occasion), fallback)
}
