// Server-side weather proxy. The OpenWeather key never leaves the server.
// Auth + rate limiting keep an anonymous caller from burning the quota.

import { NextRequest, NextResponse } from 'next/server'
import {
  badRequest,
  getAuth,
  logServerError,
  payloadTooLarge,
  tooMany,
  unauthorized,
} from '@/lib/api'
import { readJsonBody } from '@/lib/body'
import { rateLimitPair } from '@/lib/rate-limit'
import { weatherRequestSchema } from '@/lib/schemas'
import { getServerEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

const OPENWEATHER_TIMEOUT_MS = 8_000

interface OpenWeatherResponse {
  main?: { temp?: number }
  weather?: { description?: string; main?: string }[]
  name?: string
}

export async function POST(req: NextRequest) {
  const auth = await getAuth()
  if (!auth) return unauthorized()

  const limit = rateLimitPair(auth.user.id, 'weather', 30, 300)
  if (!limit.ok) return tooMany(limit)

  const body = await readJsonBody(req, 4 * 1024)
  if (!body.ok) {
    return body.reason === 'too_large' ? payloadTooLarge() : badRequest('bad_json')
  }

  const parsed = weatherRequestSchema.safeParse(body.value)
  if (!parsed.success) return badRequest('invalid_city')

  const city = parsed.data.city ?? 'Toronto'
  const apiKey = getServerEnv().OPENWEATHER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ temp: null, error: 'no_key' }, { status: 503 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OPENWEATHER_TIMEOUT_MS)
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
    if (!response.ok) {
      return NextResponse.json(
        { temp: null, error: `upstream_${response.status}` },
        { status: 502 }
      )
    }

    const data: OpenWeatherResponse = await response.json()
    const temp = typeof data.main?.temp === 'number' ? Math.round(data.main.temp) : null
    const condition = data.weather?.[0]?.description || data.weather?.[0]?.main || ''
    return NextResponse.json({ temp, condition, city: data.name || city, source: 'openweather' })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError'
    logServerError('weather', error)
    return NextResponse.json(
      { temp: null, error: timedOut ? 'timeout' : 'network' },
      { status: timedOut ? 504 : 502 }
    )
  } finally {
    clearTimeout(timer)
  }
}
