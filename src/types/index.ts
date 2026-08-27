export interface Item {
  id: string
  user_id: string
  image_url: string
  name: string
  category: 'top' | 'bottom' | 'shoes' | 'outerwear'
  primary_color: string
  secondary_color: string | null
  formality: 'casual' | 'smart_casual' | 'formal'
  warmth: 'hot' | 'mild' | 'cold'
  price: number | null
  created_at: string
}

export interface Outfit {
  id: string
  user_id: string
  date: string
  occasion: string
  weather_temp: number | null
  item_ids: string[]
  explanation_text: string | null
  is_favorite: boolean
  was_worn: boolean
  generated_by: 'ai' | 'rules'
  created_at: string
}

export interface User {
  id: string
  email: string
  created_at: string
}
