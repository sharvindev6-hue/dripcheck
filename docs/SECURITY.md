# Security & privacy

This document describes what DripCheck protects, how, and what is still open. It is
written against the code in `security/hardening-privacy`, not an aspiration.

DripCheck stores personal wardrobe data and private photos. The security goal is:

- one signed-in user can only ever read or change their own rows and photos;
- a page from another origin cannot make the browser perform a mutation;
- untrusted input cannot exhaust memory, spoof an image type, or redirect a login;
- a user can take their data out and delete their account completely.

## Threat model

In scope:

- a logged-in user trying to reach another user's data;
- a malicious third-party site driving a signed-in user's browser (CSRF);
- crafted request bodies, filenames, redirects and image uploads;
- leaked client bundle / client-visible keys;
- abuse of AI and weather spend.

Out of scope for this pass:

- a compromised Supabase project or service-role key (that is full control);
- a compromised host or reverse proxy;
- supply-chain compromise beyond `npm audit` visibility;
- legal/compliance certification (GDPR/CCPA paperwork).

## Controls

### Transport and response headers

Set in `next.config.mjs` for every path (`poweredByHeader: false`):

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (production only) |

HSTS is omitted in development so local HTTP keeps working.

### Content Security Policy

CSP is built per request in `src/middleware.ts` because it carries a fresh nonce:

- `default-src 'self'`, `base-uri 'self'`, `frame-ancestors 'none'`, `object-src 'none'`,
  `form-action 'self'`.
- `script-src 'self' 'nonce-<random>' 'strict-dynamic'`; `'unsafe-eval'` is added only in
  development.
- `style-src 'self' 'unsafe-inline'` (the app ships hand-written CSS; no third-party styles).
- `img-src` allows `self`, `data:`, `blob:`, `https://*.supabase.co`, `images.unsplash.com`
  (seed data) and the configured Supabase origin.
- `connect-src` allows `self`, `https://*.supabase.co`, `wss://*.supabase.co` and the
  configured Supabase origin.
- `font-src 'self' data:`, `manifest-src 'self'`.

The middleware strips any inbound `content-security-policy` header before setting its own, so
a caller cannot inject a malformed nonce (the CVE-2026-44581 class). `src/app/layout.tsx` sets
`export const dynamic = 'force-dynamic'` so every rendered script tag receives the nonce; a
statically rendered page would not.

### Authentication and session

- Magic-link only. `src/app/auth/callback/route.ts` exchanges the PKCE code / OTP for a
  cookie-backed session.
- The `type` query param is checked against an allowlist (`magiclink`, `email`, `signup`,
  `recovery`, `invite`, `email_change`) before `verifyOtp`.
- `src/middleware.ts` refreshes the session on every request and is the single place cookies
  are written outside route handlers.
- Public surface is an explicit allowlist: `/login`, `/auth/callback`, `/api/auth/*`,
  `/api/health`. Everything else requires a user. Unauthenticated API calls get `401`; pages
  redirect to `/login?next=<safe path>`.
- Post-login redirects go through `src/lib/safeNext.ts`, which allows only a same-origin
  absolute path. Protocol-relative (`//evil`), backslash-normalised (`/\evil`) and
  control-character paths fall back to `/`.
- The one-click demo login requires **both** `NODE_ENV !== 'production'` and
  `ENABLE_DEMO_LOGIN=true` (`src/lib/demo.ts`). Otherwise the button is hidden and
  `/api/auth/demo` returns `404`.

### Cross-site request guard (CSRF)

Every mutating `/api` request (`POST`, `PUT`, `PATCH`, `DELETE`) is rejected with
`403 {"error":"bad_origin"}` when:

- `Sec-Fetch-Site: cross-site`, or
- `Origin: null` (sandboxed/opaque document), or
- a present `Origin` does not match the request origin.

Same-origin fetches from the app pass; requests without either header (non-browser clients)
are still subject to session auth. This is defence in depth on top of `SameSite` cookies.

### Input validation and body limits

- Every mutation body is parsed with zod; item, outfit and profile schemas are `.strict()`.
- `src/lib/body.ts` replaces `req.json()` with a bounded reader. It rejects on declared
  `content-length` and again while streaming, so a chunked body cannot bypass the cap. Oversize
  returns `413 payload_too_large`; malformed JSON returns `400 bad_json`. An empty body is `{}`.
- Caps: 1 KB account delete, 4 KB weather, 8 KB profile/chat/outfit-update/stylist, 32 KB
  items/outfits create.
- `image_path` is constrained to `<uuid-folder>/<filename>` with no `.`/`..` filename, and the
  route still checks the folder equals the signed-in user id.

### Upload validation

- `src/lib/imageSniff.ts` detects JPEG, PNG, WebP and HEIC by magic bytes.
- `readUpload` in `src/lib/vision.ts` reads the upload once, rejects empty files, caps at
  **4 MB** (`413 too_big`), and forwards the **sniffed** MIME — never the client-declared
  `File.type` or extension. Non-images get `415 bad_mime`.
- The private bucket also has a MIME allowlist and a file-size limit.

### Data isolation

- Postgres RLS is enabled on `users`, `items` and `outfits`; every policy is scoped to
  `auth.uid() = user_id` (or `= id` for `users`).
- The `wardrobe-items` bucket is private. Storage policies allow read/insert/update/delete only
  under the owner's `<uid>/` folder (or for legacy root objects referenced by the owner's rows).
- The browser reads through the anon key under RLS; writes go through route handlers, and photos
  are served with short-lived signed URLs.
- Service-role access is confined to server-only modules that `import 'server-only'`
  (`supabase-server.ts`, `ai.ts`, `cutout.ts`, `vision.ts`, `demo.ts`).

### Rate limiting and abuse

`src/lib/rate-limit.ts` is a dependency-free fixed-window limiter with two windows per route
(minute + day). It inspects both before counting, so a rejected request does not burn quota.

| Route | Per minute | Per day |
|---|---|---|
| items create | 60 | 500 |
| outfits save | 60 | 500 |
| vision | 20 | 150 |
| extract | 12 | 120 |
| cutout | 20 | 300 |
| stylist | 30 | 300 |
| chat | 30 | 300 |
| weather | 30 | 300 |
| account export | 5 | 20 |
| account delete | 3 | 10 |

The map prunes expired windows at 1,000 keys and hard-caps at 5,000 keys, evicting the oldest,
so distinct keys cannot grow memory without bound.

### Error handling and logging

- Route handlers return stable error codes (`unauthorized`, `bad_json`, `bad_origin`,
  `payload_too_large`, `not_found`, `could_not_export`, `could_not_delete`, …), not stack traces.
- `logServerError(scope, error)` logs the detail server-side with a `[dripcheck:<scope>]` tag.
- Account deletion logs only the user id, never email or wardrobe content.

### Secrets

- `.env.local` is git-ignored; `.env.example` documents names only.
- No live credentials are in the repository or its history. The `eyJhbGciOi…` string in
  `scripts/seed-demo.ts` is a placeholder, not a key.
- Server-only env is validated in `src/lib/env.ts`; the public Supabase pair is the only
  browser-visible config.

### Privacy features

`src/app/api/account/route.ts`:

- `GET /api/account` — JSON export of the caller's profile, items, outfits and photos (1-hour
  signed URLs). `Content-Disposition: attachment`, `Cache-Control: no-store`. Rate limited.
- `DELETE /api/account` — requires body `{"confirm":"DELETE"}`. Deletes storage objects first
  (owner folder plus legacy root paths recorded on the user's rows), then the auth user via the
  service role, then signs out. Returns `503 delete_unavailable` if the service role is not
  configured, rather than deleting half an account.

The You screen exposes both under **Privacy & data**, with a type-`DELETE` confirmation step and
an AI disclosure ("that one photo is sent to our vision provider to suggest tags; background
removal runs locally").

### CI

`.github/workflows/ci.yml` runs lint, typecheck, unit tests and a production build. It also runs
`npm audit --omit=dev --audit-level=high` as an **informational** step (it does not fail the
build) so dependency advisories stay visible.

## Verification

Performed locally on the production build (`next start -p 3100`):

| Check | Result |
|---|---|
| `npm run check` (lint + typecheck + tests) | clean, 58 tests pass |
| `npm run build` | passes; all routes render dynamically |
| CSP present on `/login` | yes |
| Script tags carrying the nonce | 18/18, matches header |
| `POST /api/items` with `Sec-Fetch-Site: cross-site` | `403 bad_origin` |
| `POST /api/items` with `Origin: null` | `403 bad_origin` |
| `POST /api/items` same-origin, no session | `401 unauthorized` |
| `POST /api/items` no origin headers, no session | `401 unauthorized` |

Unit coverage added for `safeNext`, `body`, `imageSniff` and the tightened `image_path` schema.

## Open risks

These are known and deliberately deferred, not oversights.

1. **Direct browser writes are still allowed by RLS.** A signed-in user can call Supabase
   directly to insert/update their own `items`, `outfits` and `users` rows, bypassing the route
   handlers (and their body caps and zod clamps). The data is still theirs, so this is not a
   cross-user leak, but it widens the trusted surface. Tightening to server-only writes is a
   schema change.
2. **Client-direct photo uploads skip the magic-byte sniff.** `src/app/add/page.tsx` uploads to
   Storage with the anon key. The bucket enforces a MIME allowlist and size limit, but the
   declared content type is client-controlled. The server-side sniff only covers the AI routes.
3. **Next.js 14.2.35 advisories.** `npm audit` reports a critical Next advisory plus a high in
   `postcss` (pulled in by Next). The app does not use Server Actions, the `next/image`
   optimizer, rewrites or a custom server, which removes several named paths, but the real fix
   is a major upgrade to Next 16 — a separate migration. `sharp` was bumped to `^0.35.5` to
   clear its high advisory.
4. **Provider error detail.** AI/weather failures return provider-shaped codes
   (`gemini_429`, `nvidia_…`, `timeout`) rather than a fully generic message. These are not
   secrets, but they do reveal which upstream failed.
5. **Rate limiting is per instance.** Serverless or multi-instance deployments need a shared
   store (Redis/Upstash) for a true global quota. Today each instance enforces its own window.
6. **No CSP report endpoint.** Violations are not collected. Adding `report-to`/`report-uri`
   is a follow-up once a sink exists.
7. **Account deletion ordering.** Storage is removed before the auth row. If the auth delete
   then fails, photos are gone but the account remains. This is the safer direction (no orphaned
   private photos) and is logged; a retry completes the delete.
8. **AI photo egress is unchanged.** When a user taps AI tagging, that one photo is sent to
   NVIDIA/Gemini. This is disclosed in the You screen. A consent/opt-in gate and an
   on-device-only mode are future work, not part of this pass.

## Operating notes

- Never set `ENABLE_DEMO_LOGIN=true` in a deployed environment.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only; it bypasses RLS and can delete users.
- Rotate AI keys if a deployment is suspected compromised; rate limits cap spend but do not
  replace rotation.
