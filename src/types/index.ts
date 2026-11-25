import type { GarmentFit, GarmentType } from '@/lib/garment'

export type ItemCategory = 'top' | 'bottom' | 'shoes' | 'outerwear'
export type Formality = 'casual' | 'smart_casual' | 'formal'
export type Warmth = 'hot' | 'mild' | 'cold'
export type ItemStatus = 'clean' | 'dirty'

export interface Item {
  id: string
  user_id: string
  /** Legacy public URL. New uploads use `image_path` + signed URLs. */
  image_url: string | null
  image_path: string | null
  name: string
  category: ItemCategory
  primary_color: string
  secondary_color: string | null
  formality: Formality
  warmth: Warmth
  price: number | null
  garment_type: GarmentType | null
  color_hex: string | null
  fit: GarmentFit | null
  status: ItemStatus
  times_worn: number
  last_worn: string | null
  created_at: string
  updated_at: string
}

export interface Outfit {
  id: string
  user_id: string
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  occasion: string
  weather_temp: number | null
  item_ids: string[]
  explanation_text: string | null
  is_favorite: boolean
  was_worn: boolean
  generated_by: 'ai' | 'rules'
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | null
  silhouette: 'tailored' | 'relaxed' | 'oversized' | null
  city: string | null
  timezone: string | null
  send_hour: number | null
  created_at: string
  updated_at: string
}

/** Shape returned by GET /api/stats. */
export interface Stats {
  pieces: number
  looks: number
  streak: number
  total_spend: number
  total_wears: number
  cost_per_wear: number | null
  week: Array<{ date: string; was_worn: boolean; outfit_name: string | null }>
}
