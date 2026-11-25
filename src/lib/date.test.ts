import { describe, expect, it } from 'vitest'
import { addDaysLocal, getTodayLocalDateString } from './date'

describe('getTodayLocalDateString', () => {
  it('formats local components, not UTC', () => {
    // 23:30 local on Jan 15. In a negative-offset timezone this is already
    // Jan 16 in UTC — the helper must still say Jan 15.
    expect(getTodayLocalDateString(new Date(2026, 0, 15, 23, 30))).toBe('2026-01-15')
  })

  it('zero-pads month and day', () => {
    expect(getTodayLocalDateString(new Date(2026, 2, 4, 9, 0))).toBe('2026-03-04')
  })
})

describe('addDaysLocal', () => {
  it('crosses a month boundary', () => {
    expect(addDaysLocal('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('crosses a year boundary backwards', () => {
    expect(addDaysLocal('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('handles a leap day', () => {
    expect(addDaysLocal('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDaysLocal('2024-03-01', -1)).toBe('2024-02-29')
  })

  it('is its own inverse', () => {
    expect(addDaysLocal(addDaysLocal('2026-07-04', 17), -17)).toBe('2026-07-04')
  })
})
