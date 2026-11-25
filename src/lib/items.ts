import type { Item, Outfit } from '@/types'
import { colorHex, inferFit, inferGarmentType, isGarmentFit, isGarmentType } from './garment'
import { getTodayLocalDateString } from './date'

type Row = Record<string, unknown>

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

/**
 * Normalise a row that may predate the recovery migration. Postgres defaults
 * cover new rows, but older demo data and cached payloads can be missing the
 * design-system columns.
 */
export function normalizeItem(row: Row): Item {
  const name = str(row.name, 'Clothing item')
  const category = row.category === 'bottom' || row.category === 'shoes' || row.category === 'outerwear'
    ? row.category
    : 'top'
  const primaryColor = str(row.primary_color, 'black')

  const garmentType = isGarmentType(row.garment_type)
    ? row.garment_type
    : inferGarmentType(name, category)
  const fit = isGarmentFit(row.fit) ? row.fit : inferFit(name, garmentType)
  const hex = typeof row.color_hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(row.color_hex)
    ? row.color_hex
    : colorHex(primaryColor)

  return {
    id: String(row.id ?? ''),
    user_id: String(row.user_id ?? ''),
    image_url: typeof row.image_url === 'string' ? row.image_url : null,
    image_path: typeof row.image_path === 'string' ? row.image_path : null,
    name,
    category,
    primary_color: primaryColor,
    secondary_color: typeof row.secondary_color === 'string' ? row.secondary_color : null,
    formality:
      row.formality === 'smart_casual' || row.formality === 'formal' ? row.formality : 'casual',
    warmth: row.warmth === 'hot' || row.warmth === 'cold' ? row.warmth : 'mild',
    price: typeof row.price === 'number' ? row.price : row.price ? Number(row.price) : null,
    garment_type: garmentType,
    color_hex: hex,
    fit,
    status: row.status === 'dirty' ? 'dirty' : 'clean',
    times_worn: typeof row.times_worn === 'number' ? row.times_worn : 0,
    last_worn: typeof row.last_worn === 'string' ? row.last_worn : null,
    created_at: str(row.created_at, new Date().toISOString()),
    updated_at: str(row.updated_at, str(row.created_at, new Date().toISOString())),
  }
}

export function normalizeOutfit(row: Row): Outfit {
  const ids = Array.isArray(row.item_ids)
    ? row.item_ids.filter((id): id is string => typeof id === 'string')
    : []

  return {
    id: String(row.id ?? ''),
    user_id: String(row.user_id ?? ''),
    date: str(row.date, getTodayLocalDateString()),
    occasion: str(row.occasion, 'casual'),
    weather_temp: typeof row.weather_temp === 'number' ? row.weather_temp : null,
    item_ids: ids,
    explanation_text: typeof row.explanation_text === 'string' ? row.explanation_text : null,
    is_favorite: row.is_favorite === true,
    was_worn: row.was_worn === true,
    generated_by: row.generated_by === 'ai' ? 'ai' : 'rules',
    created_at: str(row.created_at, new Date().toISOString()),
    updated_at: str(row.updated_at, str(row.created_at, new Date().toISOString())),
  }
}
