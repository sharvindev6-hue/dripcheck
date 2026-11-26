# DripCheck — Learning Log

A per-phase journal of what I built, what broke, and what I learned. I'll keep appending to this as the project grows.

> **Recovery note (2026-11-24):** this log predates the P0 + P1 recovery. The current
> architecture is in `README.md` and the design contract is in `DESIGN.md`. Three claims below
> are now superseded: the app uses one design-token CSS layer rather than a Tailwind palette;
> stats include per-item lifetime cost-per-wear, not only a single total; the outfit engine
> has a Vitest suite plus a focused verification script; and one-piece uploads now run a local
> BiRefNet-lite cutout onto the cream background. Auth has always been magic-link only.

## Phase 0 — Skeleton (pre-hackathon scaffold)
- Picked **Next.js 14 App Router + TypeScript** because RSC + route handlers live in the same repo, which meant no separate backend service for the hackathon.
- Set up **Tailwind** with a custom palette and `next/font` from the start so every later screen inherits a consistent look instead of ad-hoc hex codes.
- Wrote `Item`, `Outfit`, `User` TS interfaces first so the rest of the app builds against a contract, not vibes.
- **Supabase magic-link auth** instead of OAuth — the audience is students, "enter your email, click the link" beats dragging them through Google consent.

## Phase 1 — Auth + closet
- Discovered **RLS** is the only safe way to share one Supabase project across users; my SQL schema's `auth.uid() = user_id` policies became the security backbone of the whole app.
- Magic-link `signInWithOtp` is one call — no password reset flow, no email-verification page. The whole `useEffect` is six lines.
- First bug worth remembering: `next/image` happily accepted `https://...supabase.co` URLs at first build, then refused them at runtime. The fix was `remotePatterns` with the wildcard `**.supabase.co` — subdomains too, not just `supabase.co`.

## Phase 2 — Item management
- `URL.createObjectURL` for live previews, then `URL.revokeObjectURL` on unmount. **Forgot the revoke** on my first pass and the browser DevTools memory tab climbed every time I uploaded an image.
- `Array<UUID>` for `outfits.item_ids` is denormalized but worth it — saves a join on the most-read query of the app.

## Phase 3 — Outfit engine (the heart)
- I tried writing the rules engine as a giant nested loop over every `(top × bottom × shoes × outerwear)` combo and **it crashed on cold days with no outerwear** because the inner loop was empty. Fix: when there are no jackets, the outer pool becomes `[undefined]` so the loop still runs once.
- Color matching turned out to be more nuanced than I'd expected. Pure hue theory would reject black + olive (correct), but a hard "everything must match" rule rejects all-black outfits. **Solution: neutrals pair with anything.** The seven canonical neutrals are listed once at the top of the engine.
- Formality: I'm using a `0 / 1 / 2` ladder and demanding a delta of ≤ 1 between any two pieces. That single rule eliminated almost all "dress shoes with gym shorts" outputs without me having to write a special case.

## Phase 4 — Weather + explanations
- OpenWeatherMap free tier = 60 calls/min/key. With `sessionStorage` caching for 30 min, a session of 50 outfit regenerations still only hits the API once. **The cache is the feature.**
- I tried LLM-written explanations first, but the latency and randomness killed the UX. **Template strings** read better, never fail, and let me control the voice. Save the LLM for the headline feature.

## Phase 5 — Milli, the AI stylist
- The biggest lesson: **AI as a layer, not a dependency.** The stylist route does the AI call in a `try` and falls through to the rules engine on any failure — wrong JSON, rate limit, network blip, missing key, all of them. The user never sees an error toast for "AI is offline." Same UI, "Quick pick" chip instead of "Milli picked this."
- A strict system prompt isn't enough. I also send `responseMimeType: 'application/json'`, strip ```json fences defensively, and **retry once with an explicit correction** if the first reply fails validation. Two layers of safety net.
- Validation has to be **server-side** — never trust ids from an LLM. I check every returned id against the set of items the user actually owns, and if `top_id` is a hallucination the whole response is dropped.

## Phase 6 — Vision auto-tagging
- Gemini's `inline_data` part wants a base64 string, not a URL. Most of the time I spend in API integration is spent **finding the field that wants the boring format.**
- `responseMimeType: 'application/json'` plus a hard schema in the prompt is good but not enough. **I clamp every enum value** on the way out — if Gemini says `category: "shirt"` (not in my enum), I default to `top`. The user can correct it, but they never get a 500.
- The vision route is **stateless and never writes to Supabase**. The user always sees the suggestions, edits if needed, and clicks Save. AI never has DB write power.

## Phase 7 — Visual overhaul
- The first visual pass used Tailwind + CSS variables. The recovery replaced that with one token CSS layer in `src/styles`; the lesson still held: name the palette once, then use the names everywhere.
- `next/font` with CSS variables (`--font-display`, `--font-body`) means I can swap a font in **one place** and every heading, price, and label updates. Worth the 30-second setup.
- I tried to be cute with inline SVG sparkles and almost shipped a blurry mess. Lesson: a tiny icon needs the same care as a big one. **Aligned gradients, simple geometry, and one focal color** beats five overlapping shapes every time.

## Phase 8 — Stats + finishing
- Cost-per-wear is now per item: `price / times_worn`, with `—` when a piece has never been worn. The early build used one lifetime total; that was honest enough for a demo, but not useful when you want to know which purchase is actually earning its keep.
- The dashboard tries to answer the question "should I open the app today?" with three numbers: streak, pieces, cost-per-wear. If any one of them is interesting, the user is curious. If none are, they bounce — and that's also fine.

## Things I got wrong (and would do differently)

1. I started the visual layer too late. Editorial UI on top of working code is a one-week job; editorial UI on top of half-finished code is a re-write. **Get the data flowing first, then make it beautiful.**
2. I added two custom CSS classes (`.shimmer`, `.fade-up`) before Tailwind had any reason to do them. If I'd reached for `transition-all duration-200` first I'd have shipped two days earlier.
3. I spent an hour writing a "smart" color-matcher that returned *every* outfit, including the all-purple one. The dumb hue-wheel table is better — it forces the user to add variety to their closet instead of silently approving bad outfits.

## Phase 9 — Final polish (2026-11-25)
- Ran the app in a real browser at 390×844 and 1280×900 instead of trusting the build output.
- Found the primary **Wear this** button slipping under the tab bar on a standard phone. Tightened the outfit stage so the action is visible without scrolling.
- The cutout model had regressed to a 502 because the 2D mask tensor was passed to `RawImage`. Fixed the shape and verified the cream preview and original-photo toggle in the add flow.
- Audited every main screen for horizontal overflow and console errors; all clear. The only overflow left is the intentionally scrollable closet category strip and the mannequin's decorative arm inside its clipped stage.
- Rewrote the README around the real product, added real screenshots, and corrected the old "no background removal" note.

## What I want to learn next

- Server Components for the dashboard so the first paint shows real data without a client-side waterfall.
- Vitest + React Testing Library for the outfit engine — it's the only piece of business logic in the app and the only piece that has real bugs waiting to happen.
- Stripe or LemonSqueezy for a "Premium Milli" tier. The cost-per-wear metric is the right product hook — students care about value.
