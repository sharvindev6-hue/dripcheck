# DripCheck

> A private digital closet that styles a complete outfit every morning.

DripCheck is a phone-first web app: photograph your clothes once, let AI tag them, and get a
complete look for the weather that only uses pieces you own. It was built for the **Beginner's
Paradise — FirstCommit hackathon 2026** and then hardened into a working P0 + P1 build.

The visual language is **Bottle Green + Brass**: warm bone surfaces, a deep bottle-green shell,
brass accents, Archivo display type and Instrument Sans body type. The exact contract lives in
[`DESIGN.md`](DESIGN.md).

## What it does

- **Today** — a mannequin look built from your wardrobe, with the weather, a plain-language
  explanation, a match score, wear logging, a weekly preview and a streak.
- **Closet** — search, category filters, garment flats or private photos, item details,
  cost-per-wear, laundry status and "build a look around this".
- **Add** — one piece with Gemini auto-tagging, or scan a whole outfit and confirm every extracted
  piece before saving. Photos are optional; the drawn garment flats always work.
- **Stylist chat** — "warmer", "dressier", "more casual", "swap shoes", "all black", "another",
  or an occasion. It restyles over a validated endpoint and never invents clothes.
- **Looks** — every logged outfit, with save/favourite and "try this look" back into Today.
- **You** — size, silhouette preference, weather city, lifetime stats and sign out.
- **Rules first, AI second** — the deterministic engine always produces a valid look. Featherless
  adds a stylist voice when configured; Gemini adds vision. Any failure falls back to rules.
- **Private by default** — per-user RLS, a private storage bucket, signed image URLs, server-side
  mutations, zod validation, rate limits and a CSP.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 14 App Router + TypeScript strict + React 18 |
| Styling | The design system's plain CSS tokens/shell/screens + a small app layer |
| Data / auth / storage | Supabase Postgres, Auth (email magic link), private Storage |
| Validation | zod on every mutation body |
| AI | Featherless (outfit JSON, optional), Gemini 1.5 Flash (tags + outfit scan, optional) |
| Weather | OpenWeather behind a server proxy (optional) |
| Tests | Vitest; CI runs lint, typecheck, tests and a build with dummy env |

## Quick start

### 1. Supabase

Create a project at [supabase.com](https://supabase.com), then in the SQL editor run:

```text
supabase/migrations/0001_recovery.sql
```

That single idempotent migration creates or upgrades:

- `users`, `items`, `outfits` with per-user RLS
- the design-system columns (`garment_type`, `color_hex`, `fit`, `status`, wear counters)
- `UNIQUE (user_id, date)` so one day has one outfit
- a trigger that rejects an outfit containing someone else's item or invalid slots
- the private `wardrobe-items` bucket with owner-scoped storage policies
- a backfill of legacy public object paths into `items.image_path`

Then enable **Authentication → Providers → Email** (magic link) and add
`http://localhost:3000/auth/callback` plus your production callback URL to the redirect allow list.
Google OAuth is **not** used.

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The AI and weather keys are
optional; without them the app stays fully usable in rules mode with manual weather fallback.

### 3. Run

```bash
npm install
npm run dev
# http://localhost:3000
```

Open the app, enter an email, follow the magic link, and add three pieces (top, bottom, shoes). The
stylist can then build a complete look.

## Environment variables

| Variable | Scope | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | yes | Anon key; RLS is the security boundary |
| `FEATHERLESS_API_KEY` | server | no | Enables the LLM stylist layer |
| `FEATHERLESS_MODEL` | server | no | Model id; defaults in the route |
| `GEMINI_API_KEY` | server | no | Enables auto-tagging and outfit scan |
| `OPENWEATHER_API_KEY` | server | no | Enables live weather |
| `SUPABASE_SERVICE_ROLE_KEY` | server | no | Demo seeder + legacy storage cleanup; never expose to the browser |
| `SUPABASE_URL` | server | seed only | Seeder URL |
| `DEMO_USER_EMAIL` | server | seed only | Demo account |
| `DEMO_SEED` | server | seed only | Must be `true` to run the seeder |

A fresh clone builds with no env vars. Pages that require Supabase validate lazily and the login
screen explains setup instead of crashing.

## Demo data

```bash
DEMO_SEED=true \
SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
DEMO_USER_EMAIL=you@example.com \
npx tsx scripts/seed-demo.ts
```

The seeder creates 16 pieces and 21 days of outfit history ending today, all marked worn, and
updates lifetime wear counters. Seeded photos are external Unsplash URLs; new uploads use the
private bucket.

## Architecture

```text
Browser (phone shell, client screens)
  │  reads: Supabase (RLS-scoped)
  │  writes: only through route handlers
  ▼
Next route handlers
  ├── /api/items[/id]      create / update / delete (+ storage cleanup)
  ├── /api/outfits[/id]    upsert by (user, date), slot validation, wear counters
  ├── /api/profile         size / silhouette / city
  ├── /api/stats           lifetime streak and cost-per-wear
  ├── /api/stylist         rules first → Featherless → validated fallback
  ├── /api/chat            intent-based restyle, validated ids
  ├── /api/vision          single-item Gemini tags
  ├── /api/extract         multi-item outfit scan
  ├── /api/weather         OpenWeather proxy
  └── /auth/callback       PKCE code exchange
        │
        ├── Supabase Postgres + RLS
        ├── Supabase private Storage + signed URLs
        └── optional AI / weather providers
```

### Security boundaries

- Middleware redirects signed-out page requests to `/login` and returns `401` for protected APIs.
- Every mutation checks the session, validates the body with zod, and derives the user id
  server-side. A client never supplies `user_id`.
- Outfit ids are checked against the caller's wardrobe **and** their categories before saving.
  The database repeats the check in a trigger.
- The wardrobe bucket is private. New objects live under `<user-id>/<file>`; storage policies are
  owner-scoped. Reads use short-lived signed URLs.
- AI/vision/weather routes are authenticated and rate-limited per user per minute and per day.
  The limiter is in-memory per instance; use a shared store if you deploy many instances.
- Non-GET API requests with a mismatched `Origin` are rejected.
- Security headers and a CSP are set in `next.config.mjs`; `X-Powered-By` is disabled.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (works without env) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests |
| `npm run verify:engine` | Focused rules-engine regression check |
| `npm run check` | lint + typecheck + tests |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, then a production build with dummy
Supabase values.

## Design

The source of truth is:

- `src/styles/tokens.css` — colours, type variables, motion
- `src/styles/shell.css` — reset, phone frame, screen containers
- `src/styles/screens.css` — Today / Closet / Looks / You / chat / sheets / camera
- `src/app/app.css` — small app-only layouts (login, add, empty states)
- `DESIGN.md` — the written contract

The phone shell is full-screen on mobile and a centred phone frame on desktop. There is no separate
desktop layout.

## Known limitations

- The repo does not contain a live Supabase project, AI keys or weather key, so the verified checks
  are lint, typecheck, unit tests and production builds. Live auth/storage/AI calls need your
  project's credentials.
- Python/PyTorch background removal is not part of this build; garment art is drawn from typed SVG
  flats, and optional photos are shown as uploaded. The app never claims a background was removed.
- Social feeds, reactions, Telegram/Discord delivery and scheduled notifications are P2 and are not
  implemented. Looks is a personal saved-look archive.
- Rate limiting is per server instance; a multi-instance deployment should swap in Redis or a
  managed limiter.
- HEIC decoding depends on the browser; the upload route and bucket accept it, but some browsers
  cannot preview HEIC locally.
- `npm audit` flags known Next.js 14 advisories. The app does not use Server Actions, the
  `next/image` optimizer, rewrites or a custom server, which removes several of the named paths,
  but a framework upgrade to the current major is the real fix and is deliberately left as a
  separate migration because it is a breaking change.
- Legacy public wardrobe objects must be readable through the item-owned storage policy added by
  the migration. Run the migration before making the bucket private in a production project.

## License

Private hackathon project.
