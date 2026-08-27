# DripCheck — Milli, your AI stylist

> Digitize your wardrobe. Get a Milli-styled outfit every morning.

DripCheck is a solo-built web app for the **Beginner's Paradise — FirstCommit hackathon 2026**. It turns the pile of clothes in your closet into a personal stylist. Upload photos of your pieces, tag them once, and Milli (our Gen-Z AI stylist) builds a fresh lookbook outfit for you every day — adjusted for weather, occasion, and what you wore recently.

## The problem

Most students wear 20% of their wardrobe 80% of the time. The rest rots in a drawer because choosing an outfit is decision fatigue. DripCheck removes that friction: open the app, get a complete look in under 5 seconds, save the ones you love.

## What it does

- **Digital wardrobe** — snap photos of every piece, tag it once (color, formality, warmth, price). Stored in Supabase Storage + Postgres with row-level security so only you can see your data.
- **Milli, the AI stylist** — the headline feature. Server route calls Featherless.ai with a strict JSON contract; if the key is missing or the LLM misbehaves, the deterministic rules engine silently takes over. Same UI, same Outfit of the Day, two source paths.
- **Smart filtering** — outfit generation respects warmth bands (cold < 12°C / mild 12-24°C / hot > 24°C), formality compatibility, color theory (neutrals pair with anything; otherwise analogous hues), and yesterday's items to keep things fresh.
- **Vision auto-tagging** *(optional)* — upload a photo, Gemini Vision pre-fills the tag form with a name, category, color, formality, and warmth band. You always confirm before save.
- **Auto weather** *(optional)* — one server-side OpenWeather call, cached in `sessionStorage` for 30 minutes so the free tier doesn't rate-limit you. Manual temperature input still works on the same page.
- **Streak + cost-per-wear** — small dashboard at `/` shows how many days in a row you've logged an outfit and what each piece is costing you per wear.
- **Editorial UI** — warm paper palette, Fraunces serif headlines, sage and blush accents, custom SVG brand mark and Milli avatar. Built with Tailwind, no UI library.

## Screenshots

<!-- TODO: drop in 4 visuals: 1) dashboard, 2) closet, 3) outfit lookbook, 4) upload modal with AI pills -->
| Dashboard | Closet | Outfit of the Day | Upload Modal |
|---|---|---|---|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |

## Quick start (5 min)

1. **Supabase**
   - Create a free project at supabase.com.
   - SQL editor → paste `supabase_schema.sql` and run.
   - SQL editor → paste `supabase_migration_stylist.sql` and run (adds the `generated_by` column).
   - Storage → create a public bucket called `wardrobe-items`.
   - Auth → enable Email magic-link sign-in.
   - Auth → Providers → Google → enable Google OAuth and add your Google Client ID and Client Secret.
   - Auth → URL Configuration → add `http://localhost:3000/auth/callback` and your production `/auth/callback` URL to the redirect allow list.
2. **Env**
   ```bash
   cp .env.example .env.local
   # fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
   # (the AI keys are optional — the app fully works in "rules mode")
   ```
3. **Install + run**
   ```bash
   npm install
   npm run dev
   # open http://localhost:3000
   ```
4. **First login** — choose Google at `/login`, or enter an email for a magic link. After authentication, you'll land on the dashboard.

### Google OAuth configuration

In Google Cloud Console, create a Web application OAuth client and add this authorized redirect URI:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

In Supabase, paste the Google Client ID and Client Secret under Authentication → Providers → Google. The app callback URL is `/auth/callback`; Supabase must redirect back to that URL after it exchanges the provider response.
5. **(Optional) demo seed** — to populate a wardrobe for screenshots:
   ```bash
   DEMO_SEED=true \
   SUPABASE_URL=https://xxx.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=... \
   DEMO_USER_EMAIL=you@student.edu \
   npx tsx scripts/seed-demo.ts
   ```

## Architecture

```
Browser ─► Next.js App Router (RSC + client)
                │
                ├── /api/weather  ─► OpenWeatherMap (server-side key)
                ├── /api/vision   ─► Gemini 1.5 Flash     (multipart upload)
                └── /api/stylist  ─► Featherless.ai       (strict JSON contract)
                                       │
                                       └─ on any failure ─► outfitEngine.ts
                                                              (deterministic rules,
                                                               same OutfitDisplay)
                │
                ▼
         Supabase (Postgres + Auth + Storage)   ← RLS isolates per-user data
```

The rules engine is the source of truth. AI layers on top for the stylist voice, the vision auto-tag, and the live weather. Every AI path has a graceful offline fallback so the app never silently breaks.

## Tech stack

| Layer        | Choice                                          | Why                                                    |
|--------------|-------------------------------------------------|--------------------------------------------------------|
| Framework    | Next.js 14 (App Router) + TypeScript            | RSC for fast auth-aware pages, one repo for FE + BFF  |
| Database     | Supabase Postgres + Row Level Security          | Auth + DB + Storage in one; SQL-level data isolation  |
| Auth         | Supabase magic-link                             | Zero-password, no OAuth dance for hackathon demo       |
| Styling      | Tailwind CSS + custom CSS variables             | Editorial palette without a design-system dep         |
| AI — stylist | Featherless.ai (OpenAI-compatible)              | Cheap + strict JSON contracts                          |
| AI — vision  | Google Gemini 1.5 Flash                         | Free tier, base64 inline images, JSON mode            |
| AI — weather | OpenWeatherMap                                  | Free tier, one fetch, server-cached                   |
| Fonts        | Fraunces (serif) + Plus Jakarta Sans (sans)     | Editorial display + clean body                         |

## Known limitations

- The Supabase storage bucket is **public** by design (so `<Image>` can render clothing photos without signed-URL roundtrips). Don't upload anything sensitive.
- The Gemini free tier rotates keys frequently — if the vision route starts returning 401, regenerate `GEMINI_API_KEY` in Google AI Studio and re-paste into `.env.local`.
- Demo seed uses Unsplash CDN URLs that are public-but-could-rotate; if a photo breaks, replace it in `scripts/seed-demo.ts`.
- Cost-per-wear is a simple sum-of-prices ÷ wears; it doesn't yet weight by category.

## Learn more

See `LEARNING_LOG.md` for a per-phase journal of what I built, what broke, and what I learned while shipping DripCheck.
