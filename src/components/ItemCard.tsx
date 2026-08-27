'use client'

import { Item } from '@/types'
import Image from 'next/image'
import { colorHex } from './icons'

// Chunky monoline trash + edit glyphs — same zine language as the nav.
function TrashGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6 18 21H6L5 6" />
    </svg>
  )
}
function EditGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
      <path d="M14 4l6 6L8 22H2v-6z" /><path d="M14 4l6 6" />
    </svg>
  )
}

interface ItemCardProps {
  item: Item
  onDelete?: (id: string) => void
  onEdit?: (item: Item) => void
}

export default function ItemCard({ item, onDelete, onEdit }: ItemCardProps) {
  const swatch = colorHex(item.primary_color)
  return (
    <article className="sticker group relative bg-cream border-[3px] border-ink">
      <div className="relative aspect-square overflow-hidden border-b-[3px] border-ink bg-pink/20">
        <Image
          src={item.image_url}
          alt={item.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        {/* Category tag — rotated -2deg, like a sticker slapped on. */}
        <span className="absolute top-3 left-3 bg-yellow border-2 border-ink px-2 py-0.5 text-[10px] font-mono font-extrabold uppercase tracking-wider text-ink -rotate-2">
          {item.category}
        </span>
        {(onDelete || onEdit) && (
          <div className="absolute top-3 right-3 flex translate-x-2 gap-1.5 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 focus-within:translate-x-0 focus-within:opacity-100">
            {onEdit && (
              <button
                onClick={() => onEdit(item)}
                aria-label="Edit item"
                className="bg-cyan border-2 border-ink p-1.5 btn-press"
              >
                <EditGlyph size={14} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(item.id)}
                aria-label="Delete item"
                className="bg-pink border-2 border-ink p-1.5 btn-press"
              >
                <TrashGlyph size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="truncate font-mono text-base font-extrabold uppercase leading-tight text-ink">{item.name}</h3>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block h-4 w-4 flex-shrink-0 border-2 border-ink"
              style={{ backgroundColor: swatch }}
              aria-hidden="true"
            />
            <span className="truncate text-xs font-mono uppercase text-ink">{item.primary_color}</span>
          </div>
          <span className="bg-cyan border-2 border-ink px-2 py-0.5 text-[10px] font-mono font-extrabold uppercase tracking-wider text-ink">
            {item.formality.replace('_', ' ')}
          </span>
        </div>
        {item.price != null && (
          <p className="mt-2 font-mono text-sm font-bold text-pink">${item.price.toFixed(2)}</p>
        )}
      </div>
    </article>
  )
}