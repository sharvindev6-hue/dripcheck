// Mannequin + garment-flat renderer.
//
// Ported from the approved Bottle Green + Brass prototype. The renderer is
// deterministic and dependency-free: it returns an SVG string that the React
// components inject. Every colour is sanitised to a hex value first, so a
// malicious wardrobe field can never inject markup.

import type { DrawableGarment, GarmentFit, GarmentSlot, GarmentType } from './garment'
import { safeHex } from './garment'

type Pt = [number, number]

const FIT: Record<GarmentFit, number> = {
  tight: 0,
  slim: 0,
  regular: 1,
  relaxed: 2,
  baggy: 3,
}

const CLAY = '#CFC6B4'

function normalizeHex(hex: string): string {
  let h = safeHex(hex)
  if (h.length === 4) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
  }
  if (h.length === 9) h = h.slice(0, 7)
  return h
}

function shade(hex: string, amount: number): string {
  const n = parseInt(normalizeHex(hex).slice(1), 16)
  let r = n >> 16
  let g = (n >> 8) & 255
  let b = n & 255
  const k = amount < 0 ? 0 : 255
  const t = Math.abs(amount)
  r = Math.round(r + (k - r) * t)
  g = Math.round(g + (k - g) * t)
  b = Math.round(b + (k - b) * t)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

const f1 = (n: number) => n.toFixed(1)

function rp(points: Pt[], radius: number): string {
  const n = points.length
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = points[(i + n - 1) % n]
    const b = points[i]
    const c = points[(i + 1) % n]
    const u: Pt = [b[0] + (a[0] - b[0]) * radius, b[1] + (a[1] - b[1]) * radius]
    const v: Pt = [b[0] + (c[0] - b[0]) * radius, b[1] + (c[1] - b[1]) * radius]
    d += `${i ? 'L' : 'M'}${f1(u[0])} ${f1(u[1])}Q${f1(b[0])} ${f1(b[1])} ${f1(v[0])} ${f1(v[1])}`
  }
  return `${d}Z`
}

function PL(points: Pt[], color: string, outline?: number): string {
  const d = rp(points, 0.13)
  const c = normalizeHex(color)
  const stroked =
    outline === 0
      ? ''
      : ` stroke="${shade(c, -0.4)}" stroke-width=".8" stroke-linejoin="round"`
  const sheen = outline === 0 ? '' : `<path d="${d}" fill="url(#gav)"/>`
  return `<path d="${d}" fill="${c}"${stroked}/>${sheen}`
}

const MI = (points: Pt[]): Pt[] => points.map(q => [200 - q[0], q[1]])

const BO = (points: Pt[], color: string, outline?: number) =>
  PL(points, color, outline) + PL(MI(points), color, outline)

const cl = (d: string) =>
  `<path d="${d}" fill="${CLAY}"/><path d="${d}" fill="url(#gav)"/>`

interface Sleeve {
  p: Pt[]
  o1: Pt
  i1: Pt
  ts: number
}

function slv(f: number, lg: boolean, ex = 0): Sleeve {
  const ts = 20 + f * 2 + ex
  const t0 = 6 + f * 1.4
  const t1 = (lg ? 4.6 : 5.6) + f * (lg ? 1.4 : 1.6)
  const L = lg ? 122 : 40 + f * 4
  const s: Pt = [100 - ts, 62]
  const o0: Pt = [100 - ts - 2 * t0, 69]
  const o1: Pt = [o0[0] - L * 0.04, 69 + L]
  const i1: Pt = [o1[0] + 2 * t1, 69 + L]
  const i0: Pt = [100 - ts, 100]
  return { p: [s, o0, o1, i1, i0], o1, i1, ts }
}

export interface AvatarInput extends DrawableGarment {
  slot: GarmentSlot
}

export function renderAvatar(garments: AvatarInput[]): string {
  const g: Partial<Record<GarmentSlot, AvatarInput>> = {}
  for (const item of garments) g[item.slot] = item

  const top = g.top
  const outer = g.outer
  const bottom = g.bottom
  const shoes = g.shoes

  let sS = ''
  let sB = ''
  let sT = ''
  let sO = ''

  let o = ''
  o += '<ellipse cx="100" cy="366" rx="64" ry="6" fill="#17150F" fill-opacity=".16"/>'
  o += cl('M93 40C93 52 92 58 84 65L116 65C108 58 107 52 107 40Z')
  o += cl(
    'M100 7C111 7 116.5 17 116.5 28C116.5 41 109 48.5 100 48.5C91 48.5 83.5 41 83.5 28C83.5 17 89 7 100 7Z'
  )

  const src = outer
    ? { f: FIT[outer.fit], lg: true, ex: 3 }
    : top
      ? { f: FIT[top.fit], lg: top.type !== 'tee', ex: 0 }
      : null

  if (src) {
    const a = slv(src.f, src.lg, src.ex)
    const mx = (a.o1[0] + a.i1[0]) / 2
    const my = a.o1[1]
    ;[0, 1].forEach(m => {
      const x = m ? 200 - mx : mx
      if (!src.lg) o += cl(`M${x - 5} ${my}H${x + 5}L${x + 3} 188H${x - 4}Z`)
      o += cl(`M${f1(x)} ${f1((src.lg ? my : 188) - 1)}a5.5 7.5 0 1 0 .01 0Z`)
    })
  }

  if (shoes) {
    const hw0 = 8 + (bottom ? FIT[bottom.fit] : 1) * 2.6
    const lo = /loafer/i.test(shoes.name)
    const c = shoes.color
    ;[-1, 1].forEach(sd => {
      const x = 100 + sd * (6 + hw0)
      const d =
        `M${x - 10} 334L${x + 10} 334Q${x + 14} 346 ${x + 13} 356` +
        `Q${x + 13} 363 ${x + 7} 363L${x - 7} 363Q${x - 13} 363 ${x - 13} 356` +
        `Q${x - 14} 346 ${x - 10} 334Z`
      sS += `<path d="${d}" fill="${normalizeHex(c)}" stroke="${shade(c, -0.4)}" stroke-width=".8"/>`
      sS += `<path d="${d}" fill="url(#gav)"/>`
      sS +=
        `<path d="M${x - 13.2} 357L${x + 13.2} 357Q${x + 13.4} 364 ${x + 7} 364` +
        `L${x - 7} 364Q${x - 13.4} 364 ${x - 13.2} 357Z" fill="${lo ? shade(c, -0.55) : '#F3F1EB'}"/>`
      if (!lo) {
        sS += `<path d="M${x - 5} 341H${x + 5}M${x - 5} 346H${x + 5}" fill="none" stroke="${shade(
          c,
          -0.35
        )}" stroke-width="1.1" stroke-linecap="round"/>`
      }
    })
  }

  if (bottom) {
    const f = FIT[bottom.fit]
    const ww = 20
    const hh = 24 + f * 1.4
    const w = 8 + f * 2.6
    const c = bottom.color
    sB += PL(
      [
        [100 - ww, 146],
        [100 + ww, 146],
        [100 + hh, 176],
        [106 + 2 * w, 346],
        [106, 346],
        [100, 190],
        [94, 346],
        [94 - 2 * w, 346],
        [100 - hh, 176],
      ],
      c
    )
    sB += PL(
      [
        [100 - ww, 146],
        [100 + ww, 146],
        [100 + ww + 0.5, 153],
        [100 - ww - 0.5, 153],
      ],
      shade(c, -0.16),
      0
    )
    sB += `<path d="M100 153V190" fill="none" stroke="${shade(c, -0.3)}" stroke-width="1"/>`
    ;[-1, 1].forEach(sd => {
      const kx = 100 + sd * (hh * 0.55 + w * 0.5 + 4)
      sB += `<path d="M${f1(kx - 7)} 262q7 4 14 0M${f1(kx - 6)} 270q6 3 12 0" fill="none" stroke="#000" stroke-opacity=".16" stroke-width="1.1" stroke-linecap="round"/>`
    })
  }

  if (top) {
    const f = FIT[top.fit]
    const c = top.color
    const k = top.type
    const lg = k !== 'tee'
    const a = slv(f, lg, 0)
    const ts = a.ts
    const hw = ts + 3 + f * 3.5
    const hm = (lg ? 190 : 180) + f * 4

    if (k === 'hoodie') {
      sT += `<path d="M86 61Q85 52 100 51Q115 52 114 61Z" fill="${shade(c, -0.22)}"/>`
    }
    sT += BO(a.p, shade(c, -0.05))
    if (lg) {
      sT += BO(
        [
          [a.o1[0], a.o1[1] - 5],
          [a.i1[0], a.i1[1] - 5],
          [a.i1[0], a.i1[1]],
          [a.o1[0], a.o1[1]],
        ],
        shade(c, -0.16),
        0
      )
    }
    sT += PL(
      [
        [91, 58],
        [100 - ts, 62],
        [100 - hw, hm],
        [100 + hw, hm],
        [100 + ts, 62],
        [109, 58],
        [100, 70],
      ],
      c
    )
    sT += `<path d="M91 58Q100 70 109 58" fill="none" stroke="${shade(c, -0.3)}" stroke-width="${
      k === 'sweater' ? 4 : 3
    }" stroke-linecap="round"/>`
    if (lg) {
      sT += PL(
        [
          [100 - hw, hm - 6],
          [100 + hw, hm - 6],
          [100 + hw, hm],
          [100 - hw, hm],
        ],
        shade(c, -0.15),
        0
      )
    }
    if (k === 'hoodie') {
      sT += PL(
        [
          [100 - hw * 0.6, hm - 34],
          [100 + hw * 0.6, hm - 34],
          [100 + hw * 0.7, hm - 10],
          [100 - hw * 0.7, hm - 10],
        ],
        shade(c, -0.1)
      )
      sT += `<path d="M96 70V92M104 70V92" fill="none" stroke="${shade(
        c,
        0.5
      )}" stroke-width="1.3" stroke-linecap="round"/>`
    }
    sT += `<path d="M${f1(100 - hw + 5)} ${hm - 30}q${f1(hw * 0.5)} 7 ${f1(
      hw * 0.95
    )} 1M${f1(100 + hw - 5)} ${hm - 46}q${f1(-hw * 0.5)} 6 ${f1(
      -hw * 0.9
    )} 1" fill="none" stroke="#000" stroke-opacity=".14" stroke-width="1.2" stroke-linecap="round"/>`
  }

  if (outer) {
    const f = FIT[outer.fit]
    const c = outer.color
    const a = slv(f, true, 3)
    const ts = a.ts
    const hw = ts + 3 + f * 3
    const hm = 200 + f * 4

    sO += BO(a.p, c)
    sO += BO(
      [
        [a.o1[0], a.o1[1] - 5],
        [a.i1[0], a.i1[1] - 5],
        [a.i1[0], a.i1[1]],
        [a.o1[0], a.o1[1]],
      ],
      shade(c, -0.16),
      0
    )
    sO += BO(
      [
        [97, 58],
        [100 - ts, 62],
        [100 - hw, hm],
        [97, hm],
      ],
      c
    )
    sO += BO(
      [
        [90, 56],
        [98, 61],
        [95, 80],
        [86, 65],
      ],
      shade(c, 0.1)
    )
    sO += `<path d="M97 60V${hm}M103 60V${hm}" fill="none" stroke="${shade(
      c,
      -0.35
    )}" stroke-width="1.2"/>`
  }

  o +=
    `<g data-c="shoes">${sS}</g><g data-c="bottom">${sB}</g>` +
    `<g data-c="top">${sT}</g><g data-c="outer">${sO}</g>`

  return (
    '<svg viewBox="0 0 200 372" class="avs" role="img" aria-label="Mannequin wearing this outfit">' +
    o +
    '</svg>'
  )
}

// Garment flats -----------------------------------------------------------------

const F: Record<GarmentType, [string, string]> = {
  tee: [
    '<path d="M35 11 15 19 3 35 14 44 25 37V90H75V37L86 44 97 35 85 19 65 11C61 19 39 19 35 11Z"/>',
    '<path d="M35 11C39 21 61 21 65 11"/><path class="s" d="M35 11C32 22 28 30 25 37M65 11C68 22 72 30 75 37M25 85H75"/>',
  ],
  hoodie: [
    '<path d="M33 16C27 2 73 2 67 16C62 23 38 23 33 16Z"/><path d="M36 14 14 22 5 40 7 84H21L24 52V92H76V52L79 84H93L95 40 86 22 64 14C60 20 40 20 36 14Z"/><path class="k" d="M38 15C43 21 57 21 62 15C58 9 42 9 38 15Z"/>',
    '<path d="M45 21V37M55 21V37M34 67H66L70 84H30ZM7 78H21M79 78H93"/><path class="s" d="M36 14 24 52M64 14 76 52M24 88H76"/>',
  ],
  sweater: [
    '<path d="M36 14 14 22 5 40 7 84H21L24 52V92H76V52L79 84H93L95 40 86 22 64 14C60 22 40 22 36 14Z"/>',
    '<path d="M38 15C42 24 58 24 62 15M24 87H76M24 82H76M7 78H21M79 78H93"/><path class="s" d="M36 14 24 52M64 14 76 52"/>',
  ],
  pants: [
    '<path d="M26 4H74L77 28 73 98H54L50 34 46 98H27L23 28Z"/>',
    '<path d="M26 11H74M50 11V30C50 34 45 34 43 30M33 3V12M50 3V11M67 3V12"/><path class="s am" d="M27 12C30 24 36 29 40 28M73 12C70 24 64 29 60 28M28 92H46M54 92H72"/>',
  ],
  wide: [
    '<path d="M24 6H76L84 34 94 94H56L50 46 44 94H6L16 34Z"/>',
    '<path d="M24 13H76M50 13V46M38 14 35 44M62 14 65 44"/><path class="s" d="M12 88H44M56 88H88"/>',
  ],
  shoe: [
    '<path d="M6 62C6 54 10 48 18 46L30 44C38 48 46 50 54 47L59 41C67 41 75 46 83 52C92 56 96 62 96 70V77H6Z"/><path class="w" d="M6 69H96V77Q96 80 93 80H9Q6 80 6 77Z"/>',
    '<path d="M28 44 34 33Q42 30 49 36L55 46M36 47 42 41M44 49 50 43M6 62C6 53 9 47 14 45"/><path class="s" d="M70 51C80 55 87 59 89 66"/>',
  ],
  jacket: [
    '<path d="M36 11 14 19 4 38 6 88H20L24 50V93H76V50L80 88H94L96 38 86 19 64 11 50 24Z"/>',
    '<path d="M36 11 43 27 50 24 57 27 64 11M50 24V93M30 58H44V68H30ZM56 58H70V68H56Z"/><path class="s" d="M24 88H76M6 82H20M80 82H94"/>',
  ],
}

const VB: Partial<Record<GarmentType, string>> = {
  pants: '16 0 68 100',
  wide: '2 0 96 100',
  shoe: '0 30 100 58',
}

export function renderFlat(type: GarmentType, color: string): string {
  const [outline, detail] = F[type]
  const viewBox = VB[type] ?? '0 0 100 100'
  return (
    `<svg class="fl" viewBox="${viewBox}" style="--c:${normalizeHex(color)}" aria-hidden="true">` +
    `<g class="o">${outline}</g>` +
    `<g class="v">${outline.replace(/class="[kw]"/g, '')}</g>` +
    `<g class="d">${detail}</g>` +
    '</svg>'
  )
}
