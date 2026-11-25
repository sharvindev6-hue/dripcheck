# DripCheck — Design Contract

The visual system is **Bottle Green + Brass**. It came from the approved phone-design prototype
(`dripcheck-app (1).zip`). This document is the short version; the CSS files are the source of
truth.

## Source files

| File | Owns |
|---|---|
| `src/styles/tokens.css` | Colour tokens, type variables, motion curve, shell measurements |
| `src/styles/shell.css` | Reset, phone frame, screen containers, shared headings |
| `src/styles/screens.css` | Today, Closet, Looks, You, chat, tab bar, sheets, camera |
| `src/app/app.css` | Login, Add, empty/loading states, small app-only layouts |
| `src/app/globals.css` | Tailwind preflight, visibility rules for sheets/chat, a11y helper |

Do not introduce a colour, font or shadow that is not defined here.

## Colour tokens

### Light

| Token | Value | Use |
|---|---|---|
| `--bg` | `#EFE8D8` | Warm bone page |
| `--s1` | `#F7F2E6` | Raised surface / inputs |
| `--s2` | `#DFD6C2` | Secondary surface / tracks |
| `--ph` | `#E4DCCC` | Stage top |
| `--ph2` | `#D6CDBB` | Stage bottom |
| `--ink` | `#10241C` | Primary text |
| `--mu` | `#5B5F52` | Muted text |
| `--rule` | `rgba(16,36,28,.16)` | Hairlines |
| `--ac` | `#C9A24A` | Brass accent / CTA |
| `--hi` | `#E2C46A` | Brass on green |
| `--onac` | `#10241C` | Text on brass |
| `--bk` | `#0F3D2E` | Bottle green shell |
| `--ok` | `#2E7D4F` | Success |

### Dark

`--bg #0C1511`, `--s1 #14211B`, `--s2 #1F2F27`, `--ink #EFE8D8`, `--mu #A2A793`,
`--rule rgba(239,232,216,.16)`, `--ac #E2C46A`, `--hi #E2C46A`, `--onac #10241C`,
`--ok #5CC080`. The stage stays warm (`#17150F` ink) in both themes.

## Typography

- **Display:** Archivo variable, weight 800, `font-stretch: 68–72%`, uppercase, tight leading
  (`.86–.92`). Used for screen titles, section headings, look names, big numbers.
- **Body:** Instrument Sans variable, 400–700, 13–17px, tabular numerals.
- Both are self-hosted in `src/fonts` and loaded with `next/font/local`. Do not add a third family.
- Only the display face gets the condensed width axis. Body text stays normal width.

## Shape, depth, motion

- Radii: inputs 10–14px, cards/art 14–16px, sheets 20px, pills 999px, phone 54px.
- Borders are 1px `--rule`; strong emphasis is `inset 0 0 0 1.5px var(--ink)`.
- No glows, no heavy drop shadows. Only the phone frame lift and the sheet/scrim treatment.
- Motion curve `cubic-bezier(.22,1,.36,1)`, 0.2–0.8s. Respect
  `prefers-reduced-motion` (the CSS disables the splash and shortens transitions).
- No gradient except the stage/art placeholder wash, the login/mark surface, and the phone frame.

## Shell

- Mobile: full viewport inside the safe area, bottom tab bar.
- Desktop (`min-width: 520px`): centred 430px phone frame with the status bar. There is no desktop
  re-layout; the phone design is the product design.
- Tab bar: Today, Closet, centre `+` (Add), Looks, You. The brass indicator moves by column
  (0 → 1 → 3 → 4), not by array index.
- Screens use `.scr` + `.scroll`; every screen owns its own scroll container.

## Components

Existing primitives: `.btn` (`pri`, `sec`), `.tabs2`, `.g2`, `.tile`, `.grp`, `.rw`, `.sg`,
`.sw2`, `.ck`, `.sheet`, `.scrim`, `.toast`, `.chat`, `.bub`, `.stage`, `.pb`, `.wr`, `.stk`,
`.post`, `.pimg`, `.prof`, `.stats`, `.priv`.

App-only additions (same tokens): `.empty`, `.ltrow`, `.thumb`, `.bareflat`, `.week-preview`,
`.login*`, `.add-*`, `.field`, `.catgrid`, `.you-save`, `.cityinput`.

### Photographs vs garment flats

- The design draws a faceless mannequin and garment flats as SVG. Those are the primary visuals and
  always render, even with no photo, no AI key or a failed upload.
- A user photo is optional. It is stored in the private bucket and shown in the Closet grid and item
  sheets through short-lived signed URLs.
- The mannequin is built from `garment_type` + `fit` + `color_hex` (or inferred defaults). Unknown
  values fall back to a neutral flat rather than a blank tile.
- Do not claim background removal. This build does not run a matting model.

## Screen map

| Route | Screen |
|---|---|
| `/login` | Brand splash / magic-link form |
| `/` | Today: date + weather, look title, mannequin, wear, piece-by-piece, week, streak |
| `/closet` | Search, filters, grid, item sheet (wash, cost-per-wear, build around, remove) |
| `/add` | One piece or whole outfit, AI confirm, save |
| `/looks` | Personal saved-look archive |
| `/you` | Profile, stats, size, silhouette, city, sign out |
| `/auth/callback` | PKCE exchange (no UI) |

## Rules

1. No colours outside the tokens. No pink/cyan/lime/cream from the old build.
2. No emoji in chrome. Icons are monoline SVG from `src/components/icons.tsx`.
3. No extra fonts.
4. Touch targets ≥ 44px; `:focus-visible` ring in ink/brass; sheets close on Escape.
5. No fake social proof, no invented activity, no placeholder screenshots.
6. Every screen needs real loading, empty and error states.
7. Photos are private; never render a public bucket URL for a new upload.
8. Keep the phone frame. Do not add a desktop-only layout.

## Reference widths

Design at **390 × 844** first. Verify 360px (small Android) and the centred 430px phone frame at
desktop widths. Body copy should never fall below 13px; primary text is 15–17px.
