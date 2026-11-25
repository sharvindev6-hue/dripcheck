/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production'

// Supabase may be a custom domain. Build the CSP from the configured origin so
// signed image URLs and the auth client keep working, without guessing.
let supabaseOrigin = ''
try {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  }
} catch {
  supabaseOrigin = ''
}

const supabaseSources = [
  "'self'",
  'https://*.supabase.co',
  'wss://*.supabase.co',
  ...(supabaseOrigin ? [supabaseOrigin] : []),
]

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com" +
    (supabaseOrigin ? ` ${supabaseOrigin}` : ''),
  "font-src 'self' data:",
  `connect-src ${supabaseSources.join(' ')}`,
  "manifest-src 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=()',
  },
  ...(isDev
    ? []
    : [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  images: {
    // Legacy public photos (seed data) plus Supabase signed URLs.
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
}

export default nextConfig
