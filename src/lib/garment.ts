// Garment vocabulary + colour resolution.
//
// The DB stores a free-text colour name and a category. The design system draws
// garments from a small set of SVG "flats", so we need a deterministic mapping
// from wardrobe rows to a drawable garment. Anything unknown falls back to a
// neutral so the closet never renders a blank tile.

export type GarmentSlot = 'top' | 'bottom' | 'shoes' | 'outer'
export type GarmentType = 'tee' | 'hoodie' | 'sweater' | 'pants' | 'wide' | 'shoe' | 'jacket'
export type GarmentFit = 'tight' | 'slim' | 'regular' | 'relaxed' | 'baggy'

export interface DrawableGarment {
  id: string
  name: string
  slot: GarmentSlot
  type: GarmentType
  fit: GarmentFit
  color: string
}

export const CATEGORY_TO_SLOT: Record<string, GarmentSlot> = {
  top: 'top',
  bottom: 'bottom',
  shoes: 'shoes',
  outerwear: 'outer',
  outer: 'outer',
}

export const SLOT_LABEL: Record<GarmentSlot, string> = {
  outer: 'outer',
  top: 'top',
  bottom: 'bottom',
  shoes: 'shoes',
}

// Palette taken from the design's garment data, extended with common wardrobe
// colour words. Keys are lowercase; matching is substring-based.
const COLOR_HEX: Record<string, string> = {
  black: '#2E2E34',
  charcoal: '#51535B',
  grey: '#A8A6A1',
  gray: '#A8A6A1',
  white: '#F1EEE6',
  cream: '#E9D9B8',
  ivory: '#EFE9DA',
  beige: '#D8C9A8',
  sand: '#C9B58F',
  tan: '#B98350',
  brown: '#6B4A32',
  denim: '#7C9BC0',
  blue: '#5B7FA6',
  navy: '#3A4A63',
  olive: '#7A8160',
  green: '#4E6B4A',
  sage: '#9DB58C',
  teal: '#3F7A74',
  rust: '#C45E36',
  orange: '#C97B3E',
  red: '#B4453A',
  pink: '#C98A9A',
  purple: '#6B5A8A',
  yellow: '#D9B84A',
  gold: '#C9A24A',
}

/** Normalise #rgb, #rrggbb and #rrggbbaa to the six-digit form the DB stores. */
function sixDigitHex(value: string): string {
  let hex = value.trim().toLowerCase()
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    hex = '#' + hex.slice(1).split('').map(char => char + char).join('')
  }
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex
  if (/^#[0-9a-f]{8}$/.test(hex)) return hex.slice(0, 7)
  return ''
}

/** Only allow real hex colours through to SVG attributes. */
export function safeHex(value: string | null | undefined, fallback = '#A8A6A1'): string {
  const hex = typeof value === 'string' ? sixDigitHex(value) : ''
  return hex || fallback
}

export function colorHex(name: string | null | undefined): string {
  if (!name) return '#A8A6A1'
  const direct = sixDigitHex(name)
  if (direct) return direct
  const lower = name.trim().toLowerCase()
  const match = Object.keys(COLOR_HEX).find(key => lower.includes(key))
  return match ? COLOR_HEX[match] : '#A8A6A1'
}

export function inferGarmentType(name: string, category: string): GarmentType {
  const n = name.toLowerCase()
  if (category === 'shoes') return 'shoe'
  if (category === 'outerwear' || category === 'outer') return 'jacket'
  if (category === 'bottom') {
    return /wide|trouser|cargo|baggy|parachute|palazzo/.test(n) ? 'wide' : 'pants'
  }
  if (/hoodie|hooded/.test(n)) return 'hoodie'
  if (/sweat|knit|sweater|cardigan|pullover/.test(n)) return 'sweater'
  return 'tee'
}

export function inferFit(name: string, type: GarmentType): GarmentFit {
  const n = name.toLowerCase()
  if (/oversized|baggy|loose|parachute/.test(n)) return 'baggy'
  if (/slim|skinny|fitted|tight/.test(n)) return 'slim'
  if (/relaxed|roomy|boxy/.test(n)) return 'relaxed'
  if (type === 'jacket') return 'relaxed'
  return 'regular'
}

export function isGarmentType(value: unknown): value is GarmentType {
  return (
    value === 'tee' ||
    value === 'hoodie' ||
    value === 'sweater' ||
    value === 'pants' ||
    value === 'wide' ||
    value === 'shoe' ||
    value === 'jacket'
  )
}

export function isGarmentFit(value: unknown): value is GarmentFit {
  return (
    value === 'tight' ||
    value === 'slim' ||
    value === 'regular' ||
    value === 'relaxed' ||
    value === 'baggy'
  )
}

export interface DrawableSource {
  id: string
  name: string
  category: string
  primary_color: string
  garment_type?: string | null
  color_hex?: string | null
  fit?: string | null
}

/** Map a wardrobe row onto the design system's drawable vocabulary. */
export function toDrawable(item: DrawableSource): DrawableGarment {
  const slot = CATEGORY_TO_SLOT[item.category] ?? 'top'
  const type = isGarmentType(item.garment_type)
    ? item.garment_type
    : inferGarmentType(item.name, item.category)
  const fit = isGarmentFit(item.fit) ? item.fit : inferFit(item.name, type)
  const color = item.color_hex ? safeHex(item.color_hex, colorHex(item.primary_color)) : colorHex(item.primary_color)

  return {
    id: item.id,
    name: item.name,
    slot,
    type,
    fit,
    color,
  }
}
