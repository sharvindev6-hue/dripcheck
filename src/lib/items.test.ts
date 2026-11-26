import { describe, expect, it } from 'vitest'
import { normalizeItem } from './items'

const base = {
  id: 'item-1',
  user_id: 'user-1',
  name: 'Tee',
  category: 'top',
  primary_color: 'black',
  formality: 'casual',
  warmth: 'mild',
}

describe('normalizeItem price', () => {
  it('keeps zero as a real price', () => {
    expect(normalizeItem({ ...base, price: 0 }).price).toBe(0)
    expect(normalizeItem({ ...base, price: '0' }).price).toBe(0)
    expect(normalizeItem({ ...base, price: '0.00' }).price).toBe(0)
  })

  it('parses the numeric strings PostgREST returns', () => {
    expect(normalizeItem({ ...base, price: '49.99' }).price).toBe(49.99)
  })

  it('turns invalid or negative values into null instead of NaN', () => {
    expect(normalizeItem({ ...base, price: 'abc' }).price).toBeNull()
    expect(normalizeItem({ ...base, price: -5 }).price).toBeNull()
    expect(normalizeItem({ ...base, price: null }).price).toBeNull()
    expect(normalizeItem({ ...base, price: '' }).price).toBeNull()
  })
})

describe('normalizeItem defaults', () => {
  it('fills the design-system columns for legacy rows', () => {
    const item = normalizeItem(base)
    expect(item.category).toBe('top')
    expect(item.garment_type).toBe('tee')
    expect(item.fit).toBe('regular')
    expect(item.color_hex).toBe('#2E2E34')
    expect(item.status).toBe('clean')
  })
})
