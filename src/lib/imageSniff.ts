// Magic-byte image detection.
//
// A browser `File.type` and a filename extension are both client-controlled.
// Before an upload is forwarded to an AI provider, the bytes themselves decide
// whether it is an image we accept. This mirrors the bucket's MIME allowlist.

export type SniffedImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic'

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = ''
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(bytes[start + i] ?? 0)
  return out
}

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'])

/** Returns the detected image MIME type, or null when the bytes are not one. */
export function sniffImageType(bytes: Uint8Array): SniffedImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }

  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return 'image/webp'
  }

  if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4).toLowerCase()
    if (HEIC_BRANDS.has(brand)) return 'image/heic'
  }

  return null
}
