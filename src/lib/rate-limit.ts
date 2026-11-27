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
// Start clearing expired windows well before the cap so a quiet process does
// not keep stale keys around for a full day.
const PRUNE_AT = 1_000

function prune(now: number) {
  if (buckets.size >= PRUNE_AT) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
  }

  // Hard bound. Map iteration is insertion order, so evicting the oldest key
  // keeps a burst of distinct users/keys from growing memory without limit.
  while (buckets.size >= MAX_TRACKED_KEYS) {
    const oldest = buckets.keys().next().value
    if (oldest === undefined) break
    buckets.delete(oldest)
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

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Read a window without counting a hit. `ok` means one more request would
 * still fit inside the limit.
 */
function inspect(key: string, limit: number, windowMs: number, now: number): RateLimitResult {
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    return {
      ok: true,
      remaining: limit,
      resetAt: now + windowMs,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    }
  }

  return {
    ok: existing.count < limit,
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
  const now = Date.now()
  prune(now)

  const minuteKey = `${route}:m:${userId}`
  const dayKey = `${route}:d:${userId}`

  // Inspect both windows before counting a hit. A request rejected by one
  // window must not burn quota in the other.
  const day = inspect(dayKey, perDay, DAY_MS, now)
  if (!day.ok) return day

  const minute = inspect(minuteKey, perMinute, MINUTE_MS, now)
  if (!minute.ok) return minute

  rateLimit(minuteKey, perMinute, MINUTE_MS)
  const counted = rateLimit(dayKey, perDay, DAY_MS)
  return counted.ok ? counted : minute
}
