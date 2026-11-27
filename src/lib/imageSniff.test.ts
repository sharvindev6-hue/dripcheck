import { describe, expect, it } from 'vitest'
import { sniffImageType } from './imageSniff'

function bytes(values: number[]): Uint8Array {
  return new Uint8Array(values)
}

function asciiBytes(text: string): number[] {
  return Array.from(text).map(char => char.charCodeAt(0))
}

describe('sniffImageType', () => {
  it('detects JPEG', () => {
    expect(sniffImageType(bytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))).toBe('image/jpeg')
  })

  it('detects PNG', () => {
    expect(sniffImageType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      'image/png'
    )
  })

  it('detects WebP', () => {
    expect(
      sniffImageType(bytes([...asciiBytes('RIFF'), 0, 0, 0, 0, ...asciiBytes('WEBP')]))
    ).toBe('image/webp')
  })

  it('detects HEIC brands', () => {
    expect(
      sniffImageType(bytes([0, 0, 0, 24, ...asciiBytes('ftyp'), ...asciiBytes('heic')]))
    ).toBe('image/heic')
  })

  it('rejects text, HTML and empty payloads', () => {
    expect(sniffImageType(new TextEncoder().encode('<html></html>'))).toBeNull()
    expect(sniffImageType(new TextEncoder().encode('hello'))).toBeNull()
    expect(sniffImageType(new Uint8Array())).toBeNull()
  })
})
