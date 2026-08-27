// Chunky zine-style SVGs. Sharp corners, thick black strokes, no gradients.
// Every mark is designed to look screen-printed, not AI-generated.

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {/* Hanger silhouette — hot pink fill, black border, hard offset shadow. */}
      <path
        d="M16 4a2 2 0 1 1-1.6 3.2L4 14v12a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V14L17.6 7.2A2 2 0 1 1 16 4Z"
        fill="#FF2E88"
        stroke="#000"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Cyan sparkle on the hook — extra zine energy. */}
      <path d="M22 5l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#00D9E0" stroke="#000" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function MilliAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      {/* Lemon-yellow face circle with black outline. */}
      <circle cx="20" cy="20" r="18" fill="#FFE600" stroke="#000" strokeWidth="2.5" />
      {/* Hot-pink visor — Milli's signature. */}
      <rect x="5" y="12" width="30" height="6" fill="#FF2E88" stroke="#000" strokeWidth="2" />
      {/* Eyes — cyan dots with black pupils. */}
      <circle cx="14" cy="22" r="2.5" fill="#00D9E0" stroke="#000" strokeWidth="1.5" />
      <circle cx="26" cy="22" r="2.5" fill="#00D9E0" stroke="#000" strokeWidth="1.5" />
      {/* Smirk. */}
      <path d="M14 28 Q20 32 26 28" stroke="#000" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function EmptyWardrobe({ size = 140 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" fill="none" aria-hidden="true">
      {/* Hanger glyph in a chunky border — looks like a sticker. */}
      <rect x="14" y="14" width="112" height="112" fill="#FFFBE6" stroke="#000" strokeWidth="4" />
      <rect x="14" y="14" width="112" height="14" fill="#FF2E88" stroke="#000" strokeWidth="4" />
      <line x1="34" y1="58" x2="106" y2="58" stroke="#000" strokeWidth="3" />
      <path
        d="M70 58a6 6 0 1 0-4.8 9.6L46 78v22a4 4 0 0 0 4 4h40a4 4 0 0 0 4-4V78L74.8 67.6A6 6 0 1 0 70 58Z"
        fill="#00D9E0"
        stroke="#000"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M104 92l2 5 5 1-4 3 1 5-4-2-4 2 1-5-4-3 5-1z" fill="#FFE600" stroke="#000" strokeWidth="2" />
    </svg>
  )
}

export function EmptySparkles({ size = 100 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path d="M50 8l7 22 22 7-22 7-7 22-7-22-22-7 22-7z" fill="#FF2E88" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
      <path d="M82 56l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#00D9E0" stroke="#000" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M16 66l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#FFE600" stroke="#000" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}

const COLOR_HEX: Record<string, string> = {
  black: '#0A0A0A', white: '#FFFBE6', grey: '#9CA3AF', gray: '#9CA3AF',
  navy: '#1E3A8A', blue: '#2563EB', beige: '#D6C5A8', brown: '#7C5B3F',
  red: '#DC2626', green: '#16A34A', yellow: '#FFE600', orange: '#EA580C',
  pink: '#FF2E88', purple: '#7C3AED', teal: '#00D9E0', denim: '#1E3A8A',
  cream: '#FFFBE6', tan: '#C2A07A', olive: '#65735A', maroon: '#7F1D1D',
  khaki: '#A3956A', silver: '#A3A3A3', gold: '#CA8A04',
}
export function colorHex(name: string): string {
  const key = name.toLowerCase().trim().split(/\s+/)[0] || ''
  return COLOR_HEX[key] ?? '#9CA3AF'
}