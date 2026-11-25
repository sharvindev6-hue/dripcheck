import type { Item } from '@/types'

/**
 * Turn an id list into a canonical `[top, bottom, shoes, outer?]` order.
 *
 * This is the server-side guard the old AI path lacked: an id is only accepted
 * when it exists in the user's own wardrobe AND its category matches the slot.
 * A top can never be saved as the bottom.
 */
export function orderOutfitIds(items: Item[], ids: string[]): string[] | null {
  if (ids.length < 3 || ids.length > 4) return null
  if (new Set(ids).size !== ids.length) return null

  const byId = new Map(items.map(item => [item.id, item]))
  const picked: Item[] = []
  for (const id of ids) {
    const item = byId.get(id)
    if (!item) return null
    picked.push(item)
  }

  const tops = picked.filter(item => item.category === 'top')
  const bottoms = picked.filter(item => item.category === 'bottom')
  const shoes = picked.filter(item => item.category === 'shoes')
  const outers = picked.filter(item => item.category === 'outerwear')

  if (tops.length !== 1 || bottoms.length !== 1 || shoes.length !== 1) return null
  if (outers.length > 1) return null
  if (outers.length === 0 && picked.length !== 3) return null
  if (outers.length === 1 && picked.length !== 4) return null

  const ordered = [tops[0].id, bottoms[0].id, shoes[0].id]
  if (outers.length === 1) ordered.push(outers[0].id)
  return ordered
}

/** Items referenced by an outfit, in canonical order. */
export function piecesFor(items: Item[], ids: string[]): Item[] {
  const byId = new Map(items.map(item => [item.id, item]))
  return ids.map(id => byId.get(id)).filter((item): item is Item => Boolean(item))
}
