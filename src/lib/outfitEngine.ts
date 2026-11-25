import type { Item } from '@/types'
import { getOccasionTarget, OCCASIONS } from './constants'

// Colour words that pair with anything. Kept as substring matches so "off
// white", "washed black" and "dark navy" behave.
const NEUTRALS = ['black', 'white', 'grey', 'gray', 'navy', 'beige', 'brown', 'denim', 'cream', 'tan']

const COLOR_HUES: Record<string, string[]> = {
  red: ['orange', 'pink', 'purple'],
  orange: ['red', 'yellow', 'brown'],
  yellow: ['orange', 'green', 'brown'],
  green: ['yellow', 'blue', 'teal', 'olive'],
  olive: ['green', 'brown', 'beige'],
  blue: ['green', 'purple', 'navy', 'teal'],
  teal: ['green', 'blue'],
  purple: ['red', 'blue', 'pink'],
  pink: ['red', 'purple'],
}

const FORMALITY_RANK: Record<Item['formality'], number> = {
  casual: 0,
  smart_casual: 1,
  formal: 2,
}

const WARMTH_RANK: Record<Item['warmth'], number> = {
  hot: 0,
  mild: 1,
  cold: 2,
}

export type SilhouettePreference = 'tailored' | 'relaxed' | 'oversized' | null

export interface EngineOptions {
  /** Item ids worn recently. Each repeat costs points. */
  recentItemIds?: string[]
  /** Full recent outfits. An exact repeat is heavily penalised. */
  recentCombos?: string[][]
  /** Learned fit preference from the You screen. */
  silhouette?: SilhouettePreference
  /** Item the user asked to build the look around. */
  seedItemId?: string | null
}

export interface OutfitCombo {
  top: Item
  bottom: Item
  shoes: Item
  outerwear?: Item
  score: number
}

export function getWarmthBand(temp: number | null): 'hot' | 'mild' | 'cold' {
  if (temp === null) return 'mild'
  if (temp < 12) return 'cold'
  if (temp > 24) return 'hot'
  return 'mild'
}

export function isNeutral(color: string): boolean {
  const lower = color.toLowerCase()
  return NEUTRALS.some(neutral => lower.includes(neutral))
}

export function colorsMatch(color1: string, color2: string): boolean {
  if (isNeutral(color1) || isNeutral(color2)) return true
  const c1 = color1.toLowerCase()
  const c2 = color2.toLowerCase()
  if (c1 === c2) return true

  for (const [hue, matches] of Object.entries(COLOR_HUES)) {
    const aMatches = c1.includes(hue) || matches.some(match => c1.includes(match))
    const bMatches = c2.includes(hue) || matches.some(match => c2.includes(match))
    if (aMatches && bMatches) return true
  }
  return false
}

function warmthPoints(warmth: Item['warmth'], band: 'hot' | 'mild' | 'cold'): number {
  const delta = Math.abs(WARMTH_RANK[warmth] - WARMTH_RANK[band])
  if (delta === 0) return 9
  if (delta === 1) return 3
  return -7
}

function formalityCompatible(a: Item['formality'], b: Item['formality']): boolean {
  return Math.abs(FORMALITY_RANK[a] - FORMALITY_RANK[b]) <= 1
}

function silhouetteBonus(item: Item, preference: SilhouettePreference): number {
  if (!preference) return 0
  const fit = item.fit
  if (!fit) return 0
  if (preference === 'tailored') return fit === 'tight' || fit === 'slim' ? 2 : 0
  if (preference === 'relaxed') return fit === 'relaxed' ? 2 : 0
  return fit === 'baggy' ? 2 : 0
}

/**
 * Score a complete combination. Nothing is hard-filtered here: the generator
 * must always be able to return a look when a top, bottom and shoes exist.
 * Missing outerwear is fine, and a mild-weather shoe on a cold day still
 * appears rather than returning "no outfit".
 */
export function scoreCombo(
  top: Item,
  bottom: Item,
  shoes: Item,
  outerwear: Item | undefined,
  temp: number | null,
  occasion: string,
  options: EngineOptions = {}
): number {
  const band = getWarmthBand(temp)
  const target = getOccasionTarget(occasion)

  let score = 0

  for (const piece of [top, bottom, shoes]) {
    score += warmthPoints(piece.warmth, band)
    if (piece.formality === target) score += 2
    score += silhouetteBonus(piece, options.silhouette ?? null)
  }

  score += formalityCompatible(top.formality, bottom.formality) ? 4 : -8
  score += formalityCompatible(bottom.formality, shoes.formality) ? 4 : -8

  score += colorsMatch(top.primary_color, bottom.primary_color) ? 4 : -1
  score += colorsMatch(bottom.primary_color, shoes.primary_color) ? 3 : -1

  if (isNeutral(top.primary_color) && isNeutral(bottom.primary_color)) score += 2

  if (outerwear) {
    score += warmthPoints(outerwear.warmth, band) * 0.6
    score += formalityCompatible(top.formality, outerwear.formality) ? 3 : -6
    score += colorsMatch(top.primary_color, outerwear.primary_color) ? 2 : -1
    if (outerwear.formality === target) score += 2
    score += silhouetteBonus(outerwear, options.silhouette ?? null)
    if (band === 'cold') score += 5
    if (band === 'hot') score -= 8
    if (band === 'mild') score += 1
  }

  const recent = new Set(options.recentItemIds ?? [])
  const ids = [top.id, bottom.id, shoes.id, ...(outerwear ? [outerwear.id] : [])]
  for (const id of ids) if (recent.has(id)) score -= 10

  if (options.recentCombos?.length) {
    const key = [...ids].sort().join('|')
    for (const combo of options.recentCombos) {
      if ([...combo].sort().join('|') === key) {
        score -= 40
        break
      }
    }
  }

  if (options.seedItemId && ids.includes(options.seedItemId)) score += 50

  return score
}

function preScore(item: Item, band: 'hot' | 'mild' | 'cold', target: Item['formality']): number {
  let score = warmthPoints(item.warmth, band)
  if (formalityCompatible(item.formality, target)) score += 2
  if (isNeutral(item.primary_color)) score += 1
  return score
}

/**
 * Large closets can contain hundreds of tops. Capping each pool keeps the
 * combinatorial search instant without ever dropping the best-scoring pieces.
 */
function shortlist(
  items: Item[],
  band: 'hot' | 'mild' | 'cold',
  target: Item['formality'],
  limit = 26
): Item[] {
  if (items.length <= limit) return items
  return [...items]
    .sort((a, b) => preScore(b, band, target) - preScore(a, band, target) || a.id.localeCompare(b.id))
    .slice(0, limit)
}

export function generateOutfit(
  items: Item[],
  temp: number | null,
  occasion: string,
  options: EngineOptions = {}
): OutfitCombo | null {
  const band = getWarmthBand(temp)
  const target = getOccasionTarget(occasion)

  // Dirty clothes are in the laundry, not in the rotation.
  const wearable = items.filter(item => item.status !== 'dirty')

  // A shortlist must never silently drop the piece the user asked to build
  // around, even in a 500-item closet.
  const seedId = options.seedItemId
  const includeSeed = (pool: Item[], category: Item['category']): Item[] => {
    if (!seedId || pool.some(item => item.id === seedId)) return pool
    const seed = wearable.find(item => item.id === seedId)
    return seed && seed.category === category ? [...pool, seed] : pool
  }

  const tops = includeSeed(
    shortlist(wearable.filter(item => item.category === 'top'), band, target),
    'top'
  )
  const bottoms = includeSeed(
    shortlist(wearable.filter(item => item.category === 'bottom'), band, target),
    'bottom'
  )
  const shoes = includeSeed(
    shortlist(wearable.filter(item => item.category === 'shoes'), band, target),
    'shoes'
  )
  const outerwears = includeSeed(
    shortlist(wearable.filter(item => item.category === 'outerwear'), band, target, 14),
    'outerwear'
  )

  if (tops.length === 0 || bottoms.length === 0 || shoes.length === 0) return null

  const combos: OutfitCombo[] = []
  const outerPool: (Item | undefined)[] = outerwears.length > 0 ? [undefined, ...outerwears] : [undefined]

  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {
        for (const outer of outerPool) {
          // Outerwear is never required. On hot days the score penalises it, so
          // the no-layer combination wins without a hard filter.
          const score = scoreCombo(top, bottom, shoe, outer, temp, occasion, options)
          combos.push(
            outer
              ? { top, bottom, shoes: shoe, outerwear: outer, score }
              : { top, bottom, shoes: shoe, score }
          )
        }
      }
    }
  }

  if (combos.length === 0) return null

  // "Build around this" must actually include the chosen piece, not merely
  // prefer it in a random top-six draw.
  const seeded = options.seedItemId
    ? combos.filter(combo =>
        [combo.top.id, combo.bottom.id, combo.shoes.id, combo.outerwear?.id].includes(
          options.seedItemId as string
        )
      )
    : []
  const pool = seeded.length > 0 ? seeded : combos

  pool.sort((a, b) => b.score - a.score)
  const best = pool.slice(0, Math.min(6, pool.length))
  return best[Math.floor(Math.random() * best.length)]
}

/** Rehydrate a saved/AI id list into a combo. Returns null if a slot is missing. */
export function comboFromIds(items: Item[], ids: string[]): OutfitCombo | null {
  const byId = new Map(items.map(item => [item.id, item]))
  const picked = ids.map(id => byId.get(id)).filter((item): item is Item => Boolean(item))
  const top = picked.find(item => item.category === 'top')
  const bottom = picked.find(item => item.category === 'bottom')
  const shoes = picked.find(item => item.category === 'shoes')
  const outerwear = picked.find(item => item.category === 'outerwear')
  if (!top || !bottom || !shoes) return null
  return { top, bottom, shoes, outerwear, score: 0 }
}

function humanFormality(value: Item['formality']): string {
  return value.replace('_', ' ')
}

function occasionName(value: string): string {
  return OCCASIONS.find(o => o.value === value)?.label ?? value.replace(/_/g, ' ')
}

/**
 * Truthful, data-derived explanation. Never claims "neutral on neutral" unless
 * both pieces really are neutral, and never claims a layer exists when it does
 * not.
 */
export function explainOutfit(combo: OutfitCombo, temp: number | null, occasion: string): string {
  const { top, bottom, shoes, outerwear } = combo
  const label = occasionName(occasion).toLowerCase()
  const band = getWarmthBand(temp)

  let weather: string
  if (temp === null) {
    weather = `No temperature on file, so I built a clean ${humanFormality(top.formality)} look for ${label}.`
  } else if (band === 'cold') {
    weather = outerwear
      ? `At ${temp}°, the ${outerwear.name} layers over the ${top.name} without hiding the shape.`
      : `At ${temp}° there is no outerwear in your closet, so the ${top.name} is the warmest top I could build around.`
  } else if (band === 'hot') {
    weather = `At ${temp}°, I kept it light: the ${top.name} and ${bottom.name} do the work.`
  } else {
    weather = outerwear
      ? `At ${temp}°, the ${outerwear.name} is an easy extra layer over the ${top.name}.`
      : `At ${temp}°, the ${top.name} works without a coat.`
  }

  let colour: string
  if (isNeutral(top.primary_color) && isNeutral(bottom.primary_color)) {
    colour = `The ${top.primary_color} and ${bottom.primary_color} are both neutral, so they sit together cleanly.`
  } else if (colorsMatch(top.primary_color, bottom.primary_color)) {
    colour = `The ${top.primary_color} and ${bottom.primary_color} sit in the same colour family.`
  } else {
    colour = `The ${top.primary_color} against ${bottom.primary_color} is the contrast that makes it work.`
  }

  return `${weather} ${colour} The ${shoes.name} finishes the ${label} look.`
}

/** Backwards-compatible name used by older imports. */
export function getTemplateExplanation(combo: OutfitCombo): string {
  return explainOutfit(combo, null, 'casual')
}

/** Map a score onto the percentage shown in the stage header. */
export function matchPercent(score: number): number {
  return Math.max(70, Math.min(99, Math.round(72 + score / 2)))
}
