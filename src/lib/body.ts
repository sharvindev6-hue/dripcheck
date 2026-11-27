// Bounded JSON reader for route handlers.
//
// `req.json()` buffers an arbitrary body. Every mutation here has a small,
// known shape, so a hard byte cap is cheap protection against memory pressure
// and oversized-payload abuse. An empty body is treated as `{}` so optional
// schemas (for example the stylist request) keep working; zod still decides
// whether `{}` is valid for the route.

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'too_large' | 'bad_json' }

export const DEFAULT_MAX_JSON_BYTES = 64 * 1024

function joinChunks(chunks: Uint8Array[], total: number): Uint8Array {
  if (chunks.length === 1) return chunks[0]
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

export async function readJsonBody(
  request: Request,
  maxBytes: number = DEFAULT_MAX_JSON_BYTES
): Promise<JsonBodyResult> {
  // A declared length lets us reject before reading a single chunk. Chunked
  // requests omit it, so the streaming cap below is still required.
  const declared = Number(request.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, reason: 'too_large' }
  }

  if (!request.body) return { ok: true, value: {} }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, reason: 'too_large' }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, reason: 'bad_json' }
  }

  if (total === 0) return { ok: true, value: {} }

  try {
    const text = new TextDecoder().decode(joinChunks(chunks, total))
    if (!text.trim()) return { ok: true, value: {} }
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, reason: 'bad_json' }
  }
}
