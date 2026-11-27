import { describe, expect, it } from 'vitest'
import { dateSchema, itemCreateSchema } from './schemas'

const baseItem = {
  name: 'Black tee',
  category: 'top',
  primary_color: 'black',
  formality: 'casual',
  warmth: 'mild',
} as const

function withImagePath(image_path: string) {
  return itemCreateSchema.safeParse({ ...baseItem, image_path })
}

describe('dateSchema', () => {
  it('accepts real calendar dates', () => {
    expect(dateSchema.safeParse('2026-11-25').success).toBe(true)
    expect(dateSchema.safeParse('2024-02-29').success).toBe(true)
  })

  it('rejects impossible dates that match the shape', () => {
    expect(dateSchema.safeParse('2025-02-29').success).toBe(false)
    expect(dateSchema.safeParse('2025-02-31').success).toBe(false)
    expect(dateSchema.safeParse('2025-04-31').success).toBe(false)
    expect(dateSchema.safeParse('2025-13-01').success).toBe(false)
    expect(dateSchema.safeParse('2025-00-10').success).toBe(false)
  })

  it('rejects malformed strings', () => {
    expect(dateSchema.safeParse('25-01-01').success).toBe(false)
    expect(dateSchema.safeParse('2025-1-1').success).toBe(false)
    expect(dateSchema.safeParse('2025-01-01T00:00:00Z').success).toBe(false)
  })
})

describe('itemCreateSchema image_path', () => {
  it('accepts a user-scoped object path', () => {
    expect(withImagePath('3f0a6f4e-1c2b-4a5d-8e9f-0123456789ab/photo.png').success).toBe(true)
  })

  it('rejects traversal and absolute paths', () => {
    expect(withImagePath('../photo.png').success).toBe(false)
    expect(withImagePath('user/../photo.png').success).toBe(false)
    expect(withImagePath('user/..').success).toBe(false)
    expect(withImagePath('/photo.png').success).toBe(false)
    expect(withImagePath('user\\photo.png').success).toBe(false)
    expect(withImagePath('user/sub/photo.png').success).toBe(false)
  })
})
