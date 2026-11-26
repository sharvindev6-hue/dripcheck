import type { NextRequest } from 'next/server'

// Host header values are client-controlled. Only accept a plain hostname or a
// bracketed IPv6 literal, with an optional port, so a header like
// `evil.com/path` or `a@b` can never end up inside a redirect URL.
const HOST_PATTERN =
  /^(?:\[[0-9a-f:.]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::\d{1,5})?$/i

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null
  // Proxies may append hops; the first value is the one the browser used.
  const first = value.split(',')[0]?.trim()
  return first || null
}

function safeHost(value: string | null): string | null {
  const host = firstHeaderValue(value)
  if (!host || host.length > 255) return null
  return HOST_PATTERN.test(host) ? host.toLowerCase() : null
}

function safeProto(value: string | null, request: NextRequest): 'http' | 'https' {
  const proto = firstHeaderValue(value)?.toLowerCase()
  if (proto === 'http' || proto === 'https') return proto

  // `request.nextUrl.protocol` reflects the scheme this process actually
  // received. It keeps localhost and LAN dev on http while a real deployment
  // behind TLS stays on https, without trusting a forwarded header.
  const fallback = request.nextUrl.protocol.replace(':', '').toLowerCase()
  return fallback === 'https' ? 'https' : 'http'
}

/**
 * `request.url` reports the bind address (0.0.0.0) when Next runs with
 * `-H 0.0.0.0`, which is not reachable from the browser. Prefer the Host
 * header and honour the forwarded host/proto used by a reverse proxy, but
 * validate both before building a URL.
 */
export function requestOrigin(request: NextRequest): string {
  const host =
    safeHost(request.headers.get('x-forwarded-host')) ??
    safeHost(request.headers.get('host'))

  if (!host) return request.nextUrl.origin

  return `${safeProto(request.headers.get('x-forwarded-proto'), request)}://${host}`
}
