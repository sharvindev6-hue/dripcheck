// Monoline SVG icons from the approved design system. Every icon is a chunky,
// single-weight stroke — no emoji in chrome, no mixed icon families.

import type { CSSProperties } from 'react'

interface IconProps {
  size?: number
  className?: string
  style?: CSSProperties
  strokeWidth?: number
}

function svgProps({ size, className, style, strokeWidth }: IconProps) {
  return {
    viewBox: '0 0 24 24',
    className: className ?? 'i',
    'aria-hidden': true as const,
    style: size ? { ...style, width: size, height: size } : style,
    ...(strokeWidth ? { strokeWidth } : {}),
  }
}

export function TodayIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 8a2.5 2.5 0 1 0-2.5-2.5M12 8v2.2L21 16a1 1 0 0 1-.6 1.8H3.6A1 1 0 0 1 3 16l9-5.8" />
    </svg>
  )
}

export function ClosetIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function HeartIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
    </svg>
  )
}

export function YouIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 6v12M6 12h12" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  )
}

export function SendIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function WeatherIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M7 14a4 4 0 1 1 .8-7.9A5 5 0 0 1 17.5 7 3.5 3.5 0 0 1 17 14zM9 17v3M13 17v3M17 17v3" />
    </svg>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function ChevronIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M14 4l6 6L8 22H2v-6z" />
      <path d="M14 4l6 6" />
    </svg>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6 18 21H6L5 6" />
    </svg>
  )
}

export function CameraIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="14" r="3.5" />
    </svg>
  )
}

export function HangerIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 8V6.5a2 2 0 1 1 2-2" />
      <path d="M12 8 3.2 14.6A1.6 1.6 0 0 0 4.2 17.4h15.6a1.6 1.6 0 0 0 1-2.8L12 8z" />
    </svg>
  )
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  )
}

/* -------------------------------------------------------------------------
 * Temporary compatibility exports for the pre-redesign screens. These are
 * removed once every screen uses the design-system primitives.
 * ---------------------------------------------------------------------- */

export function BrandMark({ size = 32 }: { size?: number }) {
  return <HangerIcon size={size} />
}

export function MilliAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="var(--ac)" stroke="var(--bk)" strokeWidth="2" />
      <text
        x="20"
        y="26"
        textAnchor="middle"
        fontFamily="var(--font-display), sans-serif"
        fontSize="16"
        fontWeight="800"
        fill="var(--bk)"
      >
        M
      </text>
    </svg>
  )
}

export function EmptySparkles({ size }: { size?: number } = {}) {
  void size
  return null
}

export function EmptyWardrobe({ size }: { size?: number } = {}) {
  void size
  return null
}
