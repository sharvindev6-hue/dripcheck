# DripCheck — Recovery, Security & Design-System Plan

Status: **implemented (P0 + P1)** — see `README.md` and `DESIGN.md` for the shipped contract
Repo: `C:\Users\Public\repos\dripcheck` (clone of `sharvindev6-hue/dripcheck`, branch `main`)
Design source: `C:\Users\chat2\Downloads\dripcheck-app (1).zip` — **Bottle Green + Brass**

> **Important:** there are two similarly named ZIPs in Downloads.
> `dripcheck-app (1).zip` (newest) is the Bottle Green + Brass design system.
> `dripcheck-app.zip` is a different app/spec with a conflicting visual direction
> (black/white + lime, and a warm-paper/Fraunces spec). This plan uses **only**
> the Bottle Green + Brass system. The old palettes will be deleted, not mixed.

---

## 0. Current state (verified)

| Area | State |
|---|---|
| `npm ci` | passes |
| `npm run lint` | passes |
| `npm run build` with dummy Supabase env | passes |
| `npm run build` with no env | **fails** — Supabase browser client is created at module scope during prerender |
| `scripts/verify-engine.ts` | passes |
| Live Supabase / AI run | not tested — repo has no `.env.local` |
| Visual system | **broken** — three palettes, most classes missing from compiled CSS |
| Tests / CI | none (one throwaway engine script) |
| Git | 3 commits, clean tree |

### Verified visual breakage

`tailwind.config.ts` defines the dark-luxe palette only. The compiled CSS contains
**no** `bg-cream`, `border-ink`, `shadow-chunk`, `bg-pink`, `bg-cyan`, `bg-paper`,
`bg-blush`, or `text-ink`. Closet, outfit, navbar, item card, upload modal, toast,
and dashboard therefore render largely unstyled. Login is the only page close to
a configured palette — and even that does not match the design ZIP.

### Bug ledger (to fix and regression-test)

| ID | Severity | Bug | Fix |
|---|---|---|---|
| B1 | High | Three design systems, missing Tailwind tokens | One token set + component layer (Phase 1) |
| B2 | High | Logged-out `/` spins forever | Auth guard + redirect / empty state |
| B3 | High | Save twice creates duplicate daily outfits; `.maybeSingle()` then errors and today's look disappears | `UNIQUE(user_id,date)` + upsert + error handling |
| B4 | High | Storage uploads likely fail: public bucket, no `storage.objects` INSERT policy | Private bucket + user-scoped storage RLS |
| B5 | High | Direct client inserts/deletes bypass server validation | Move mutations to server routes + zod |
| B6 | Medium | Streak iterates oldest→newest and breaks on oldest unworn day; almost always 0 | Walk backward from today; full history |
| B7 | Medium | Cost-per-wear = all item prices ÷ 14-day outfit count; not per item, not lifetime | Per-item lifetime view/RPC |
| B8 | Medium | Dashboard only loads 14 days of history | Separate full-history stat query |
| B9 | Medium | `new Date('YYYY-MM-DD').getDate()` is UTC; wrong day west of UTC | Local date parser |
| B10 | Medium | AI validation only checks IDs exist, not slot/category/warmth | Server-side slot + ownership validation |
| B11 | Medium | Rules engine requires exact warmth match; no cold shoes = no outfit | Tiered warmth fallback; only null when truly impossible |
| B12 | Medium | Build fails without env | Lazy Supabase client + env validation |
| B13 | Low | Dead `yesterdayItems` query in outfit page | Remove |
| B14 | Low | Deleting an item leaves the storage object | Delete object with row |
| B15 | Low | Seed script uses UTC dates; today marked not worn | Local dates; correct current day |
| B16 | Low | Explanation can claim "neutral on neutral" for any outfit | Truthful template selection |
| B17 | Low | `handle_new_user` trigger not idempotent | `ON CONFLICT DO NOTHING` |
| B18 | Low | README documents Google OAuth, but login is magic-link only | Rewrite setup/auth docs |
| B19 | Low | No error/loading boundaries; silent Supabase errors | Add states + logging |

### Security ledger

| ID | Risk | Fix |
|---|---|---|
| S1 | Public wardrobe bucket exposes photos | Private bucket + signed URLs + storage RLS |
| S2 | No route protection | Middleware + server-side `getUser()` |
| S3 | Client-side mutations trust client fields | Server routes, zod, ownership checks |
| S4 | AI routes unauthenticated/unthrottled | Auth + per-user/IP rate limit + daily quota |
| S5 | Unvalidated request bodies | zod schemas, length limits, generic errors |
| S6 | No security headers/CSP | Headers in `next.config.mjs` |
| S7 | Auth callback uses `getSession` only | Route handler with `exchangeCodeForSession` |
| S8 | Potential open redirect in `next` param | Allow only local paths starting `/` |
| S9 | Secrets/keys exposure | Server-only env, validate at boot, never `NEXT_PUBLIC_` |
| S10 | File upload MIME/size spoofing | Bucket MIME/size limits + server checks |
| S11 | Orphaned public objects | Delete storage object on item delete |
| S12 | No dependency/security checks | `npm audit`, CI, pinned lockfile |
| S13 | Error details leak to clients | Generic JSON errors; server logs only |
| S14 | No CSRF/origin consideration | SameSite cookies + Origin check on mutations |
| S15 | Public AI endpoints can burn keys | Rate limit, timeouts, max body, auth |

---

## 1. Goals and non-goals

### Goals
1. One visual language: Bottle Green + Brass, exact tokens, Archivo + Instrument Sans.
2. Every existing feature works end to end with real Supabase data.
3. Secure by default: RLS, private media, server validation, auth guards, rate limits.
4. No data-integrity bugs: one outfit per day, correct stats, correct dates.
5. Tested, reproducible, deployable.
6. Design-parity where the design ZIP covers features; new screens use the same language.

### Non-goals (unless separately approved)
- Payments / premium tier.
- Native mobile app.
- Full friends graph, public social feed, reactions (P2).
- Telegram/Discord delivery + cron (P2).
- Body scanning or body commentary.
- Replacing the current AI providers (keep Featherless + Gemini).

---

## 2. Design system contract (exact)

Source: `dripcheck-app (1).zip` (`css/tokens.css`, `shell.css`, `screens.css`).

### Light tokens
| Token | Value | Use |
|---|---|---|
| `--bg` | `#EFE8D8` | Warm bone page background |
| `--s1` | `#F7F2E6` | Raised surface / inputs |
| `--s2` | `#DFD6C2` | Secondary surface / tracks |
| `--ph` | `#E4DCCC` | Stage/art placeholder top |
| `--ph2` | `#D6CDBB` | Stage/art placeholder bottom |
| `--ink` | `#10241C` | Primary text |
| `--mu` | `#5B5F52` | Muted text |
| `--rule` | `rgba(16,36,28,.16)` | Hairlines / inset rules |
| `--ac` | `#C9A24A` | Brass accent / CTA |
| `--hi` | `#E2C46A` | Brass highlight on green |
| `--onac` | `#10241C` | Text on brass |
| `--bk` | `#0F3D2E` | Bottle green brand / tab bar |
| `--ok` | `#2E7D4F` | Success |

### Dark tokens
`--bg #0C1511`, `--s1 #14211B`, `--s2 #1F2F27`, `--ink #EFE8D8`,
`--mu #A2A793`, `--rule rgba(239,232,216,.16)`, `--ac #E2C46A`,
`--hi #E2C46A`, `--onac #10241C`, `--ok #5CC080`.
Stage ink is `#17150F`; stage muted is `#4d4739` / `#5c5546`.

### Typography
- Display: **Archivo**, weight 800, `font-stretch: 68–72%`, uppercase, tight leading
  (`.88–.92`), large scale (34/58/64/72px).
- Body: **Instrument Sans**, 400–700, 15–17px, tabular numerals.
- Self-host both variable fonts in `public/fonts` with `next/font/local`.
  Fallback if the width axis cannot be loaded: use the Google CSS API with the
  exact `wdth,wght` range; do not substitute another display face.

### Shape / depth / motion
- Radii: inputs 10–14px, cards/art 14–16px, sheets 20px, pills 999px, phone 54px.
- Borders: 1px `--rule`; strong `box-shadow: inset 0 0 0 1.5px var(--ink)`.
- Shadows: minimal; only phone frame lift and soft CTA elevation. No glow.
- Motion: `cubic-bezier(.22,1,.36,1)`, 0.2–0.8s, screen rise, sheet/slide,
  reveal-on-scroll, count-up. Respect `prefers-reduced-motion`.

### Hard rules
- **No colors outside these tokens.** No old cream/pink/cyan/yellow/lime palette.
- **No gradients** except the permitted stage/art placeholder wash and phone frame.
- **No emoji in chrome.** Icons are monoline SVG.
- **No extra fonts.**
- Touch targets ≥ 44px; focus-visible ring in ink/brass.
- Save the design contract in `DESIGN.md` and reference it in PR checks.

---

## 3. Target architecture

```
Browser (App Router, mobile-first, phone frame on desktop)
  ├── server components for first paint where practical
  ├── client components for interaction
  └── route handlers for every mutation (auth, zod, rate limit, ownership)
        ├── Supabase Postgres (RLS) + private Storage (signed URLs)
        ├── Featherless (stylist, validated JSON, rules fallback)
        └── Gemini (vision extraction, stateless, confirmed before write)
```

- **Auth:** Supabase magic link only. `middleware` protects app routes;
  `/auth/callback` is a route handler that exchanges the PKCE code.
- **Writes:** all inserts/updates/deletes go through server routes. The browser
  never supplies `user_id`; the server derives it from the session.
- **Reads:** RLS-scoped Supabase reads, preferably server components for the
  initial page; client refetch only for interaction.
- **Media:** private bucket, user-scoped paths (`<uid>/<uuid>.<ext>`), signed
  URLs (short TTL). Upload via a validated route or signed upload URL.
- **AI:** rules engine first, LLM second, server-side validation, deterministic
  fallback. No AI write access.

---

## 4. Phases

### Phase 0 — Safety net & baseline (0.5 day)
- Branch `recovery/design-system`; tag current `main` baseline.
- Add `src/lib/env.ts` (zod) with public/server split; fail fast with clear errors.
- Make Supabase browser client lazy (no module-scope `createClient()`); remove
  prerender crash without env.
- Add `npm run typecheck`, `npm run test`, `npm run test:e2e`, `npm run check`.
- Add Vitest + initial tests for engine, dates, stats, validators.
- Add `error.tsx`, `not-found.tsx`, `loading.tsx`.
- Add GitHub Actions: lint, typecheck, test, build (dummy env).
- Acceptance: fresh clone `npm ci && npm run build` succeeds with no env;
  lint/typecheck/test green; CI green.

### Phase 1 — Design foundation (1 day)
- Replace `globals.css` + `tailwind.config.ts` with the exact tokens above.
- Add dark-mode tokens (system + optional toggle).
- Self-host Archivo + Instrument Sans; remove Fraunces/Jakarta.
- Build primitives:
  `Button`, `Pill`, `Segmented`, `Row`, `Switch`, `Sheet`, `Toast`, `Tabs`,
  `Stat`, `Field`, `EmptyState`, `Skeleton`, `ErrorState`, `PhoneFrame`,
  `Screen`, `Header`, `ItemArt`, `Avatar`.
- Port global rules: focus, selection, scrollbar, safe-area, reduced motion.
- Delete every old palette class and old font reference.
- Visual QA at 390×844 and 1280×900, light + dark, compared to the prototype.
- Acceptance: no old tokens remain; every route uses only the new system;
  design screenshots match the prototype's hierarchy, type, color, spacing.

### Phase 2 — Data, auth & security (1.5 days)
- Add idempotent SQL migration(s) and a `supabase/migrations/` folder.
- Schema changes:
  - `items`: `subtype`, `color_hex`, `fit`, `status ('clean'|'dirty')`,
    `times_worn`, `last_worn`, `image_path`, `garment_type`.
  - `outfits`: `UNIQUE(user_id,date)`, `updated_at`, status enum if needed.
  - `outfit_items(outfit_id,item_id,slot)` join table; migrate existing
    `item_ids`; RLS; category/slot consistency enforced.
  - `users`: size, silhouette, city, timezone, send_hour (only if profile
    features are approved).
  - `handle_new_user()` idempotent; updated_at triggers; indexes.
- Private storage bucket + policies:
  read/insert/update/delete scoped to `auth.uid()/...`; MIME allowlist
  (jpeg/png/webp/heic) and size limit; migration script for existing objects.
- Auth: `middleware` redirects; `getUser()` helper; `/auth/callback/route.ts`
  with `exchangeCodeForSession`; safe `next` validation; sign-out route.
- API hardening:
  - zod schemas for every body; max lengths; enum clamps.
  - auth requirement on stylist/vision/mutations.
  - per-user/IP token bucket + daily quota for AI routes.
  - Origin check on mutations; generic errors; server logs.
  - security headers + CSP in `next.config.mjs`.
- Move item/outfit/profile writes into routes; remove direct client writes.
- Acceptance: anonymous users are redirected; cross-user reads/writes fail under
  RLS; uploads are private; API rejects bad/missing/oversized input; no secrets
  in client bundles; security header scan passes.

### Phase 3 — Core bug fixes (1.5 days)
Fix every item in the bug ledger with a regression test:
- B2 auth guard + no infinite spinner.
- B3/B8/outfit: `upsert` by `(user_id,date)`, single save state, reload works,
  Save twice does not duplicate; streak uses full history and backward walk.
- B7 per-item cost-per-wear via `item_stats` view/RPC; show "—" when no wears.
- B9 local date parser everywhere.
- B10 server-side slot/category/ownership validation; reject mismatches.
- B11 tiered warmth fallback: exact band → adjacent bands → any; outer optional
  when cold but unavailable; never null if top+bottom+shoes exist.
- B12 build without env.
- B13 remove dead query.
- B14 delete storage object with item.
- B15 seed local dates + current-day semantics.
- B16 truthful explanation templates.
- B17 idempotent user trigger.
- B18 README rewrite.
- B19 error/loading states and Supabase error handling.
- Acceptance: each bug has a failing-then-passing test; E2E saves twice,
  reloads, and shows one outfit; stats match a seeded fixture exactly.

### Phase 4 — Screen implementation (2 days)
Map the existing product onto the design screens.

| Route | Design screen | Content |
|---|---|---|
| `/login` | splash/login (new, same language) | Magic link, bottle-green splash, brass CTA, error/loading |
| `/` | **Today** | Date + weather, hero avatar, outfit reason, wear/another, ask bar, piece-by-piece, week, streak |
| `/closet` | **Closet** | Search, filter tabs + counts, 2-col grid, item sheet, wash toggle, build-around, delete |
| `/outfit` | Look detail / redirect | Saved look view, share later |
| `/looks` | **Looks** (personal first) | Saved/favorite looks feed; social deferred |
| `/you` | **You** | Profile, stats, size/silhouette, city/send time, sign out, privacy note |
| add flow | Camera/sheet | Camera capture where supported, file fallback, confirm sheet |
| chat | Stylist overlay | Current look, messages, suggested prompts, real endpoint |
| all | shell | Phone frame ≥520px, full-screen mobile, bottom tabs, center + |

- Implement real states: empty closet, <3 items, loading, AI offline, save error,
  network error, signed out.
- Wire "Wear this" to upsert + mark worn; "Another" to regenerate; item labels
  highlight the matching piece.
- Accessibility pass: labels, focus order, 44px targets, contrast, reduced motion.
- Acceptance: every screen renders in the design system at 390px and desktop;
  no overflow; keyboard reachable; no console errors; empty/loading/error states.

### Phase 5 — Design-parity features (2–3 days, recommended)
These are in the prototype but not in the current app. Approve scope before build.

1. **Avatar + garment flats** — port the faceless mannequin and SVG garment
   drawings from `js/01-avatar.js` / `js/00-data.js` to typed React. Add
   `garment_type` + `color_hex`; infer defaults for existing items. Today uses
   the avatar; closet cards use flat art (photo optional).
2. **Chat stylist** — full-screen sheet; server endpoint calls the existing
   stylist model with strict JSON, validates IDs, falls back to deterministic
   replies; suggested prompts ("warmer", "dressier", "swap shoes").
3. **Camera scan** — capture/upload an outfit photo; Gemini extracts multiple
   items; confirm sheet; nothing saved without confirmation; photos processed in
   memory and discarded (or stored privately only if the user opts in).
4. **Fit profile** — size + silhouette preference; engine scoring uses it; You
   screen edits it.
5. **Laundry / build-around** — dirty toggle; "build a look around this".
6. **Saved looks** — favorite/save and a personal Looks feed.
7. **P2 only if approved:** friends, shared look pages, reactions,
   Telegram/Discord delivery, cron, PWA.

### Phase 6 — Hardening, QA, docs, deploy (1–2 days)
- Unit: engine boundaries, colors, formality, repeat penalty, dates, stats,
  validators.
- Integration: auth required, zod rejection, upsert idempotency, storage delete,
  AI fallback on timeout/invalid JSON.
- SQL: RLS matrix for items/outfits/outfit_items/storage.
- E2E (Playwright): sign in, empty states, add item, generate, save, save again,
  reload, delete, stats, 390px and desktop, dark/light.
- `npm audit`, dependency updates, secret scan, header scan.
- README: setup, env, Supabase migration order, bucket policies, screenshots,
  design source, security notes; remove Google OAuth claims.
- Deploy to Vercel; verify build, auth redirect URLs, storage, one full demo run.
- Acceptance: definition of done below.

---

## 5. API contract (target)

| Route | Auth | Validation | Notes |
|---|---|---|---|
| `GET /auth/callback` | public | `code`, local `next` | exchange PKCE, redirect |
| `POST /api/auth/signout` | user | — | clear session |
| `POST /api/items` | user | zod item schema | server sets user_id; storage path |
| `PATCH/DELETE /api/items/[id]` | user | zod partial | ownership; delete object |
| `POST /api/outfits` | user | zod outfit schema | upsert by `(user_id,date)` |
| `PATCH /api/outfits/[id]` | user | worn/favorite | ownership |
| `POST /api/stylist` | user | occasion/temp/note | rules + AI + validation; rate limit |
| `POST /api/vision` | user | file MIME/size | stateless; rate limit |
| `POST /api/weather` | optional | city | timeout; cache-friendly |
| `GET /api/stats` | user | — | streak/pieces/cost-per-wear |
| `POST /api/chat` (P1) | user | message | validated IDs; fallback |
| `POST /api/extract` (P1) | user | image | multi-item confirmation |
| `GET /api/health` | public | — | no secrets |

Every mutation: `Origin` check, zod, auth, ownership, generic error, server log.

---

## 6. Security checklist

- [ ] RLS enabled and tested on every table.
- [ ] Storage bucket private; policies scoped to `auth.uid()`; signed URLs.
- [ ] Service-role key server-only; never imported into client.
- [ ] Middleware protects all app routes; callback/login public only.
- [ ] Auth callback uses `exchangeCodeForSession`; `next` is local-only.
- [ ] All mutations server-side; no client-supplied `user_id`.
- [ ] zod on every body; max lengths; enum clamps; file MIME/size.
- [ ] Rate limits + daily quotas on AI/vision; timeouts preserved.
- [ ] Security headers + CSP; no `X-Powered-By`.
- [ ] Cookies SameSite; Origin check; no CSRF-prone GET mutations.
- [ ] No secrets in git or client bundles; `.env.example` complete.
- [ ] Dependency audit; pinned lockfile; CI.
- [ ] Generic API errors; detailed server logs only.
- [ ] Delete cascades + storage cleanup.
- [ ] Privacy: no body commentary; no selfie retention without opt-in.

---

## 7. Testing matrix

| Layer | Tool | Cases |
|---|---|---|
| Unit | Vitest | engine warmth/color/formality/repeat, dates, stats, validators |
| API | Vitest + mocked Supabase/fetch | auth, zod, upsert, AI timeout/invalid JSON, rate limit |
| SQL | Supabase test project | RLS cross-user matrix, unique daily outfit, storage policies |
| E2E | Playwright | login, empty, add, generate, save twice, reload, delete, stats, mobile/desktop, dark/light |
| Visual | screenshots | 390px + desktop, light/dark, all screens |
| Security | manual + CI | headers, secrets, audit, redirects, upload abuse |

CI: `lint → typecheck → unit → build (dummy env)`. E2E optional when test
Supabase secrets are present.

---

## 8. Decisions needed before implementation

1. **Photos vs SVG art.** The design draws garments/mannequin in SVG and says
   "photos stay on your phone". Current app stores photos.
   *Recommendation:* hybrid — private optional photo + SVG art for Today/Closet;
   design fidelity and privacy both win.
   *Alternative:* strict design — no photo storage, metadata + SVG only.
2. **Social / delivery scope.** The prototype has Looks (friends), sharing,
   reactions, Telegram/Discord.
   *Recommendation:* ship Looks as a personal saved-look feed now; defer social
   and delivery to P2 after security is solid.
3. **Scope.** P0 (fix + reskin + secure) vs P0 + P1 (avatar, chat, scan, fit
   profile) vs full parity.
   *Recommendation:* P0 + P1; P2 separately.
4. **Shell.** Adopt the prototype's phone frame on desktop (max 430px) with
   full-screen mobile, or keep a responsive web layout using the same tokens.
   *Recommendation:* adopt the phone frame — it is the design's signature.
5. **Auth.** Keep Supabase magic link (secure) and add a fit-profile onboarding,
   or copy the prototype's demo username flow.
   *Recommendation:* keep magic link; add onboarding.
6. **AI providers.** Keep Featherless + Gemini (existing code) or move to NVIDIA
   as the other ZIP's spec suggests.
   *Recommendation:* keep existing providers; add zod/rate limits/fallbacks.

---

## 9. Estimates

| Scope | Estimate |
|---|---|
| P0: Phases 0–3 + reskin of existing screens + QA/deploy | 4.5–5.5 focused days |
| P0 + P1 design parity (avatar, chat, scan, fit profile) | 7–9 focused days |
| Full prototype parity incl. social + delivery | 11–14 focused days |

Assumes one engineer/agent, no new external services, and a working Supabase
project. Social/delivery is the largest unknown and should be separate.

---

## 10. Definition of done

- [ ] One palette only; no old tokens or missing utility classes.
- [ ] `npm ci`, `lint`, `typecheck`, `test`, `build` pass from a fresh clone.
- [ ] Auth guard works; magic link callback works; sign-out works.
- [ ] RLS verified cross-user; private storage verified; no secrets client-side.
- [ ] One outfit per day; Save twice is idempotent; reload restores it.
- [ ] Streak, pieces, cost-per-wear match fixture math.
- [ ] Every screen works at 390px and desktop, light/dark, keyboard, reduced motion.
- [ ] Empty/loading/error/offline states everywhere; no silent failures.
- [ ] E2E demo: sign in → closet → add → generate → wear → reload → stats.
- [ ] README and DESIGN.md accurate; screenshots included; deploy verified.
- [ ] No orphan storage objects; no duplicate rows; no dead queries.
