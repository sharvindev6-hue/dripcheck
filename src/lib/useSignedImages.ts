'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from './supabase'
import type { Item } from '@/types'

/**
 * Private wardrobe photos are stored under `<user-id>/<file>` in a private
 * bucket. Signed URLs are short-lived, so they are resolved in one batch per
 * screen and refreshed whenever the item set changes.
 */
export function useSignedImages(items: Item[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})

  const key = useMemo(
    () => items.map(item => `${item.id}:${item.image_path ?? ''}`).join('|'),
    [items]
  )

  useEffect(() => {
    let cancelled = false
    // Includes legacy rows whose public URL was backfilled into image_path by
    // the migration: the bucket is private now, so those need signatures too.
    const targets = items.filter(item => Boolean(item.image_path))
    if (targets.length === 0) {
      setUrls({})
      return
    }

    const supabase = createClient()
    const byPath = new Map(targets.map(item => [item.image_path as string, item.id]))

    const signAll = async () => {
      const next: Record<string, string> = {}
      // Keep batches modest: a 1000-item closet should not be one giant
      // signature request.
      for (let i = 0; i < targets.length; i += 100) {
        const paths = targets.slice(i, i + 100).map(item => item.image_path as string)
        const { data } = await supabase.storage
          .from('wardrobe-items')
          .createSignedUrls(paths, 60 * 60)
        for (const row of data ?? []) {
          if (!row.signedUrl || !row.path) continue
          const id = byPath.get(row.path)
          if (id) next[id] = row.signedUrl
        }
      }
      if (!cancelled) setUrls(next)
    }

    void signAll().catch(() => {
      // A failed signature simply falls back to the garment flat.
    })

    return () => {
      cancelled = true
    }
    // `key` captures every id + path; using `items` would refetch on identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return urls
}

/**
 * Photo when one exists, otherwise nothing (caller renders the flat).
 * A path with no signature yet must not fall back to a legacy public URL:
 * the bucket is private, so that URL would render broken. Show the flat until
 * the signature arrives instead.
 */
export function imageFor(item: Item, urls: Record<string, string>): string | null {
  if (item.image_path) return urls[item.id] ?? null
  return item.image_url ?? null
}
