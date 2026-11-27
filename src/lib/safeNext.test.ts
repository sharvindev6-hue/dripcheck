import { describe, expect, it } from 'vitest'
import { safeNextPath } from './safeNext'

describe('safeNextPath', () => {
  it('keeps local absolute paths', () => {
    expect(safeNextPath('/')).toBe('/')
    expect(safeNextPath('/closet')).toBe('/closet')
    expect(safeNextPath('/looks?tab=saved')).toBe('/looks?tab=saved')
  })

  it('falls back to the home path for missing values', () => {
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath(undefined)).toBe('/')
    expect(safeNextPath('')).toBe('/')
  })

  it('rejects off-site and protocol-relative redirects', () => {
    expect(safeNextPath('https://evil.example')).toBe('/')
    expect(safeNextPath('//evil.example')).toBe('/')
    expect(safeNextPath('/\\evil.example')).toBe('/')
    expect(safeNextPath('/\tevil')).toBe('/')
    expect(safeNextPath('/\u0000evil')).toBe('/')
    expect(safeNextPath('javascript:alert(1)')).toBe('/')
    expect(safeNextPath('closet')).toBe('/')
  })
})
