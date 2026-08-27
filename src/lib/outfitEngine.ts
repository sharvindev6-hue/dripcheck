import { Item } from '@/types'
import { getOccasionTarget } from './constants'

// Neutral colors that pair with anything
const NEUTRALS = ['black', 'white', 'grey', 'navy', 'beige', 'brown', 'denim']

// Color relationships for non-neutral pairing
const COLOR_HUES: Record<string, string[]> = {
  red: ['orange', 'pink', 'purple'],
  orange: ['red', 'yellow', 'brown'],
  yellow: ['orange', 'green', 'brown'],
  green: ['yellow', 'blue', 'teal'],
  blue: ['green', 'purple', 'navy'],
  purple: ['red', 'blue', 'pink'],
  pink: ['red', 'purple'],
  teal: ['green', 'blue'],
}

function getWarmthBand(temp: number | null): 'hot' | 'mild' | 'cold' {
  if (temp === null) return 'mild'
  if (temp < 12) return 'cold'
  if (temp > 24) return 'hot'
  return 'mild'
}

function isNeutral(color: string): boolean {
  const lower = color.toLowerCase()
  return NEUTRALS.some(n => lower.includes(n))
}

function colorsMatch(color1: string, color2: string): boolean {
  // If either is neutral, they match
  if (isNeutral(color1) || isNeutral(color2)) return true
  
  const c1 = color1.toLowerCase()
  const c2 = color2.toLowerCase()
  
  // Check if analogous or same hue family
  for (const [hue, matches] of Object.entries(COLOR_HUES)) {
    if ((c1.includes(hue) || c1 === hue) && (c2.includes(hue) || matches.some(m => c2.includes(m)))) {
      return true
    }
    if ((c2.includes(hue) || c2 === hue) && (c1.includes(hue) || matches.some(m => c1.includes(m)))) {
      return true
    }
  }
  
  return false
}

function formalityScore(f1: string, f2: string): number {
  const levels = { casual: 0, smart_casual: 1, formal: 2 }
  const diff = Math.abs(levels[f1 as keyof typeof levels] - levels[f2 as keyof typeof levels])
  return diff <= 1 ? 1 : 0
}

interface OutfitCombo {
  top: Item
  bottom: Item
  shoes: Item
  outerwear?: Item
  score: number
}

export function generateOutfit(
  items: Item[],
  temp: number | null,
  occasion: string,
  yesterdayItems?: string[]
): OutfitCombo | null {
  const warmthBand = getWarmthBand(temp)
  
  // Filter by warmth
  const filtered = items.filter(item => item.warmth === warmthBand)
  
  const tops = filtered.filter(i => i.category === 'top')
  const bottoms = filtered.filter(i => i.category === 'bottom')
  const shoes = filtered.filter(i => i.category === 'shoes')
  const outerwears = filtered.filter(i => i.category === 'outerwear')
  
  if (tops.length === 0 || bottoms.length === 0 || shoes.length === 0) {
    return null
  }

  // When it's cold we try to add a layer, but a missing jacket must never crash the
  // generator — fall back to [undefined] so the combo loop always has at least one pass.
  const outerPool: (Item | undefined)[] =
    warmthBand === 'cold' && outerwears.length > 0 ? outerwears : [undefined]

  const combos: OutfitCombo[] = []

  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {
        // Check formality compatibility
        const formScore = formalityScore(top.formality, bottom.formality) *
                         formalityScore(bottom.formality, shoe.formality)

        if (formScore === 0) continue

        // Check color matching
        if (!colorsMatch(top.primary_color, bottom.primary_color)) continue
        if (!colorsMatch(bottom.primary_color, shoe.primary_color)) continue

        for (const outer of outerPool) {
          // Only attach a layer that actually fits the look (formality + color)
          if (outer) {
            if (formalityScore(top.formality, outer.formality) === 0) continue
            if (!colorsMatch(top.primary_color, outer.primary_color)) continue
          }

          // Calculate score
          let score = formScore * 10

          // Bonus for neutral combinations
          if (isNeutral(top.primary_color) && isNeutral(bottom.primary_color)) {
            score += 5
          }

          // Small bonus for a proper layer on a cold day
          if (outer) score += 3

          // Occasion-fit bonus: items that already match the target formality
          // for today's occasion score higher. The compatibility check above
          // already excludes formal clashes, so this is just a tie-breaker.
          const target = getOccasionTarget(occasion)
          if (top.formality === target) score += 2
          if (bottom.formality === target) score += 2

          // Penalize repeating yesterday's outfit
          if (yesterdayItems && yesterdayItems.includes(top.id) && yesterdayItems.includes(bottom.id)) {
            score -= 20
          }

          combos.push(outer
            ? { top, bottom, shoes: shoe, outerwear: outer, score }
            : { top, bottom, shoes: shoe, score })
        }
      }
    }
  }

  if (combos.length === 0) return null

  // Sort by score and pick randomly from top 5
  combos.sort((a, b) => b.score - a.score)
  const topCombos = combos.slice(0, Math.min(5, combos.length))
  return topCombos[Math.floor(Math.random() * topCombos.length)]
}

export function getTemplateExplanation(outfit: { top: Item; bottom: Item; shoes: Item; outerwear?: Item }): string {
  const templates = [
    `${outfit.top.primary_color} ${outfit.top.name} paired with ${outfit.bottom.primary_color} ${outfit.bottom.name} — neutral on neutral always hits.`,
    `Clean look: ${outfit.top.name} + ${outfit.bottom.name}. The ${outfit.shoes.primary_color} ${outfit.shoes.name} ties it together.`,
    `${outfit.top.formality.replace('_', ' ')} vibes with this ${outfit.top.name} and ${outfit.bottom.name} combo. Perfect for today.`,
  ]
  
  if (outfit.outerwear) {
    templates.push(`Layered up with the ${outfit.outerwear.name} for extra warmth without sacrificing style.`)
  }
  
  return templates[Math.floor(Math.random() * templates.length)]
}
