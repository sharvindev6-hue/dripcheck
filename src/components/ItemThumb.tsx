'use client'

import ItemArt from './ItemArt'
import type { Item } from '@/types'

interface ItemThumbProps {
  item: Item
  src?: string | null
}

/**
 * Wardrobe visual: a real photo when the user supplied one, otherwise the
 * design system's garment flat. Plain <img> because signed Supabase URLs are
 * short-lived and not worth the Next image optimizer cache.
 */
export default function ItemThumb({ item, src }: ItemThumbProps) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={item.name} className="thumb" loading="lazy" decoding="async" />
  }
  return <ItemArt item={item} />
}
