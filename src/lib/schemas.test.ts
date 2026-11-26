import { describe, expect, it } from 'vitest'
import { dateSchema } from './schemas'

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
