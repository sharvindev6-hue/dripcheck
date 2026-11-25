import { renderAvatar, type AvatarInput } from '@/lib/avatar'
import type { GarmentSlot } from '@/lib/garment'

interface MannequinProps {
  items: AvatarInput[]
  /** Dims every layer except this one. */
  highlight?: GarmentSlot | null
  className?: string
}

export default function Mannequin({ items, highlight, className = 'fg' }: MannequinProps) {
  return (
    <div
      className={className}
      data-hl={highlight ?? undefined}
      // The renderer only interpolates sanitised hex colours and fixed paths.
      dangerouslySetInnerHTML={{ __html: renderAvatar(items) }}
    />
  )
}
