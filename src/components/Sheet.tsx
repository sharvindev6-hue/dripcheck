'use client'

import { useEffect } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  /** Extra class on the sheet panel (rare). */
  className?: string
}

/**
 * Bottom sheet from the design system. Lives inside the phone frame, so it is
 * absolutely positioned rather than a document-level portal.
 */
export default function Sheet({ open, onClose, title, children, className }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <div
        className={open ? 'scrim on' : 'scrim'}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`${open ? 'sheet on' : 'sheet'}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
      >
        <div className="grab" aria-hidden="true" />
        {title ? <h2>{title}</h2> : null}
        {children}
      </div>
    </>
  )
}
