import { describe, expect, it } from 'vitest'
import { orderOutfitIds } from './outfitSlots'
import type { Item } from '@/types'

function item(id: string, category: Item['category']): Item {
  return {
    id,
    user_id: 'u1',
    image_url: null,
    image_path: null,
    name: id,
    category,
    primary_color: 'black',
    secondary_color: null,
    formality: 'casual',
    warmth: 'mild',
    price: null,
    garment_type: null,
    color_hex: null,
    fit: null,
    status: 'clean',
    times_worn: 0,
    last_worn: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

const top = item('top-1', 'top')
const bottom = item('bottom-1', 'bottom')
const shoes = item('shoes-1', 'shoes')
const outer = item('outer-1', 'outerwear')
const items = [top, bottom, shoes, outer]

describe('orderOutfitIds', () => {
  it('orders a three-piece look', () => {
    expect(orderOutfitIds(items, [shoes.id, top.id, bottom.id])).toEqual([
      top.id,
      bottom.id,
      shoes.id,
    ])
  })

  it('appends an optional outer layer', () => {
    expect(orderOutfitIds(items, [outer.id, bottom.id, top.id, shoes.id])).toEqual([
      top.id,
      bottom.id,
      shoes.id,
      outer.id,
    ])
  })

  it('rejects a top in the bottom slot', () => {
    expect(orderOutfitIds(items, [top.id, top.id, shoes.id])).toBeNull()
  })

  it('rejects duplicate ids', () => {
    expect(orderOutfitIds(items, [top.id, bottom.id, bottom.id])).toBeNull()
  })

  it('rejects unknown ids and wrong counts', () => {
    expect(orderOutfitIds(items, [top.id, bottom.id, 'missing'])).toBeNull()
    expect(orderOutfitIds(items, [top.id, bottom.id])).toBeNull()
  })
})
