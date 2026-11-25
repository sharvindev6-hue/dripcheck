import { renderFlat } from '@/lib/avatar'
import { toDrawable, type DrawableSource } from '@/lib/garment'

interface ItemArtProps {
  item: DrawableSource
  className?: string
  /** Render just the SVG (for tiny chip rows), without the art panel wrapper. */
  bare?: boolean
}

/** Garment flat used by the closet grid, piece-by-piece list, and look cards. */
export default function ItemArt({ item, className = 'art', bare = false }: ItemArtProps) {
  const drawable = toDrawable(item)
  const html = renderFlat(drawable.type, drawable.color)

  if (bare) {
    // `display: contents` lets the SVG participate in the chip's grid without
    // introducing an extra box or inheriting the chip's size rules.
    // Only fixed SVG paths + a sanitised hex colour are interpolated.
    return <span className="bareflat" dangerouslySetInnerHTML={{ __html: html }} />
  }

  return (
    <div
      className={className}
      // Only fixed SVG paths + a sanitised hex colour are interpolated.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
