// Server-side weather proxy. The OpenWeather key NEVER leaves the server.
// Client posts { city } (default 'Toronto') and gets { temp, condition, city, source }.

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// OpenWeather free tier usually answers in <1s. 8s is generous but bounded so
// the UI can fall back to manual temp input instead of waiting forever.
const OPENWEATHER_TIMEOUT_MS = 8_000

interface OpenWeatherResponse {
  main?: { temp?: number }
  weather?: { description?: string; main?: string }[]
  name?: string
}

export async function POST(req: NextRequest) {
  let body: { city?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ temp: null, error: 'bad_json' }, { status: 400 })
  }

  const city = (body.city || 'Toronto').trim()
  const apiKey = process.env.OPENWEATHER_API_KEY

  if (!apiKey) {
    // Soft-fail: client can keep using manual temp input
    return NextResponse.json({ temp: null, error: 'no_key' }, { status: 503 })
  }

  // AbortController kills the socket if OpenWeather hangs. AbortError is
  // surfaced as a distinct error code so the client can show a useful toast.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OPENWEATHER_TIMEOUT_MS)
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
    const r = await fetch(url, { cache: 'no-store', signal: controller.signal })
    if (!r.ok) {
      return NextResponse.json({ temp: null, error: `upstream_${r.status}` }, { status: 502 })
    }
    const data: OpenWeatherResponse = await r.json()
    const temp = typeof data.main?.temp === 'number' ? Math.round(data.main.temp) : null
    const condition = data.weather?.[0]?.description || data.weather?.[0]?.main || ''
    return NextResponse.json({ temp, condition, city: data.name || city, source: 'openweather' })
  } catch (err) {
    const code = err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'network'
    return NextResponse.json({ temp: null, error: code }, { status: code === 'timeout' ? 504 : 502 })
  } finally {
    clearTimeout(timer)
  }
}
