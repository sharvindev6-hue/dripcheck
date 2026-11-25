// Small fixed-window rate limiter.
//
// Serverless instances each keep their own map, so this is a first line of
// defence rather than a global quota. It is deliberately dependency-free: a
// single process cannot be made to burn an AI key faster than one window.
// The per-user daily quota is enforced by counting the same key over 24h.

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const MAX_TRACKED_KEYS = 5_000

function prune(now: number) {
  if (buckets.size < MAX_TRACKED_KEYS) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

/** Count one hit against `key`. Returns false once the window is exhausted. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  prune(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return {
      ok: true,
      remaining: Math.max(0, limit - 1),
      resetAt,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    }
  }

  existing.count += 1
  const ok = existing.count <= limit
  return {
    ok,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}

/** Two windows at once, e.g. 20/minute plus 200/day. */
export function rateLimitPair(
  userId: string,
  route: string,
  perMinute: number,
  perDay: number
): RateLimitResult {
  const minute = rateLimit(`${route}:m:${userId}`, perMinute, 60_000)
  if (!minute.ok) return minute
  return rateLimit(`${route}:d:${userId}`, perDay, 24 * 60 * 60 * 1000)
}
