'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CameraIcon, CloseIcon } from '@/components/icons'
import { useToast } from '@/components/Toast'
import { createClient } from '@/lib/supabase'
import { colorHex } from '@/lib/garment'
import type { Item } from '@/types'

type Tag = {
  name: string
  category: Item['category']
  primary_color: string
  secondary_color: string | null
  formality: Item['formality']
  warmth: Item['warmth']
}

const EMPTY_TAG: Tag = {
  name: '',
  category: 'top',
  primary_color: '',
  secondary_color: null,
  formality: 'casual',
  warmth: 'mild',
}

const CATEGORIES: Item['category'][] = ['top', 'bottom', 'shoes', 'outerwear']
const FORMALITIES: Item['formality'][] = ['casual', 'smart_casual', 'formal']
const WARMTHS: Item['warmth'][] = ['hot', 'mild', 'cold']

const MAX_BYTES = 4 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
}

function uploadMime(photo: File): string {
  if (photo.type === 'image/jpg') return 'image/jpeg'
  if (ALLOWED.includes(photo.type)) return photo.type
  const extension = photo.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXTENSION[extension] ?? 'image/jpeg'
}

function label(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

export default function AddPage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [mode, setMode] = useState<'one' | 'outfit'>('one')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [tag, setTag] = useState<Tag>(EMPTY_TAG)
  const [price, setPrice] = useState('')
  const [scanned, setScanned] = useState<Tag[] | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const setFileSafe = (next: File) => {
    const extension = next.name.split('.').pop()?.toLowerCase() ?? ''
    if (next.type && !ALLOWED.includes(next.type)) {
      setError('Use a JPG, PNG, WebP or HEIC image.')
      return
    }
    if (!next.type && !EXTENSIONS.includes(extension)) {
      setError('Use a JPG, PNG, WebP or HEIC image.')
      return
    }
    if (next.size > MAX_BYTES) {
      setError('That photo is over 4MB. Try a smaller one.')
      return
    }

    if (preview) URL.revokeObjectURL(preview)
    setFile(next)
    setPreview(URL.createObjectURL(next))
    setError(null)
    setNotice(null)
    setScanned(null)

    if (mode === 'one') {
      void analyzeOne(next)
    } else {
      void analyzeOutfit(next)
    }
  }

  const analyzeOne = async (photo: File) => {
    setAnalyzing(true)
    try {
      const form = new FormData()
      form.append('file', photo)
      const response = await fetch('/api/vision', { method: 'POST', body: form })
      const data = await response.json().catch(() => null)
      if (response.ok && data?.suggestedTags) {
        setTag(data.suggestedTags as Tag)
        setNotice('AI filled these in. Check every field before saving.')
      } else {
        setNotice(
          data?.error === 'no_key'
            ? 'AI tagging is off on this deployment. Fill the tags yourself.'
            : 'AI could not read that photo. Fill the tags yourself.'
        )
      }
    } catch {
      setNotice('AI tagging is offline. Fill the tags yourself.')
    } finally {
      setAnalyzing(false)
    }
  }

  const analyzeOutfit = async (photo: File) => {
    setAnalyzing(true)
    try {
      const form = new FormData()
      form.append('file', photo)
      const response = await fetch('/api/extract', { method: 'POST', body: form })
      const data = await response.json().catch(() => null)
      if (response.ok && Array.isArray(data?.items) && data.items.length > 0) {
        setScanned(data.items as Tag[])
        setNotice('Check the names, then add the pieces together.')
      } else {
        setError(
          data?.error === 'no_key'
            ? 'Outfit scanning is off on this deployment. Switch to One piece.'
            : 'Could not find garments in that photo. Try a clearer shot or add pieces one at a time.'
        )
      }
    } catch {
      setError('Outfit scanning is offline. Switch to One piece.')
    } finally {
      setAnalyzing(false)
    }
  }

  const uploadPhoto = async (photo: File): Promise<string> => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('not authenticated')

    const extension = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const safeExtension = EXTENSIONS.includes(extension) ? extension : 'jpg'
    const path = `${user.id}/${crypto.randomUUID()}.${safeExtension}`

    const { error: uploadError } = await supabase.storage
      .from('wardrobe-items')
      .upload(path, photo, { contentType: uploadMime(photo), upsert: false })

    if (uploadError) throw uploadError
    return path
  }

  const saveOne = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving || !tag.name.trim()) return
    setSaving(true)
    setError(null)

    try {
      let imagePath: string | null = null
      if (file) {
        try {
          imagePath = await uploadPhoto(file)
        } catch (uploadError) {
          console.error('[dripcheck:add] photo upload failed', uploadError)
          setNotice('The photo could not upload, so this piece will use the drawn flat instead.')
          showToast('Photo upload failed; the piece will use the drawn flat.', 'error')
        }
      }

      const numericPrice = Number(price)
      const safePrice =
        price.trim() && Number.isFinite(numericPrice) && numericPrice >= 0 ? numericPrice : null

      const response = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tag.name.trim(),
          category: tag.category,
          primary_color: tag.primary_color.trim() || 'black',
          secondary_color: tag.secondary_color,
          formality: tag.formality,
          warmth: tag.warmth,
          price: safePrice,
          image_path: imagePath,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.item) {
        // The row never landed, so do not leave its private object orphaned.
        if (imagePath) {
          try {
            const supabase = createClient()
            await supabase.storage.from('wardrobe-items').remove([imagePath])
          } catch {
            // Best effort; the bucket policy may already have removed access.
          }
        }
        throw new Error(data?.error ?? 'save failed')
      }

      showToast('Added to your closet.')
      router.push('/closet')
    } catch (saveError) {
      console.error('[dripcheck:add]', saveError)
      setError('Could not save that piece. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const saveOutfit = async () => {
    if (!scanned || saving) return
    setSaving(true)
    setError(null)

    try {
      const results = await Promise.all(
        scanned.map(async item => {
          const response = await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: item.name.trim() || 'Clothing item',
              category: item.category,
              primary_color: item.primary_color || 'black',
              secondary_color: item.secondary_color,
              formality: item.formality,
              warmth: item.warmth,
              price: null,
              image_path: null,
            }),
          })
          return response.ok
        })
      )

      const added = results.filter(Boolean).length
      if (added === 0) throw new Error('nothing saved')

      showToast(
        added === scanned.length
          ? `Added ${added} pieces to your closet.`
          : `Added ${added} of ${scanned.length}; the rest failed.`
      )
      router.push('/closet')
    } catch (saveError) {
      console.error('[dripcheck:add-outfit]', saveError)
      setError('Could not add those pieces. Try one at a time.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="scr on">
      <div className="scroll add-scroll">
        <div className="lt add-head">
          <Link href="/closet" className="add-close" aria-label="Close add screen">
            <CloseIcon size={22} />
          </Link>
          <h1 className="ttl">
            <mark className="hl">Add</mark>
          </h1>
          <p>
            {mode === 'one'
              ? 'One piece at a time. AI can tag it, you always confirm.'
              : 'One photo of the whole outfit. I split it into pieces, you confirm.'}
          </p>
        </div>

        <div className="tabs2 add-tabs">
          <button
            type="button"
            className={mode === 'one' ? 'on' : undefined}
            onClick={() => {
              setMode('one')
              setScanned(null)
              setError(null)
              setNotice(null)
            }}
          >
            One piece
          </button>
          <button
            type="button"
            className={mode === 'outfit' ? 'on' : undefined}
            onClick={() => {
              setMode('outfit')
              setScanned(null)
              setError(null)
              setNotice(null)
            }}
          >
            Whole outfit
          </button>
        </div>

        <label className="add-drop">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="add-file"
            onChange={event => {
              const next = event.target.files?.[0]
              if (next) setFileSafe(next)
              event.target.value = ''
            }}
          />
          {preview ? (
            // Object URLs cannot go through next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Selected clothing" className="add-preview" />
          ) : (
            <span className="add-drop-empty">
              <CameraIcon size={34} />
              <b>Take or choose a photo</b>
              <small>JPG, PNG, WebP or HEIC · up to 4MB</small>
            </span>
          )}
        </label>

        {preview ? (
          <button type="button" className="add-replace" onClick={() => fileInput.current?.click()}>
            Choose another photo
          </button>
        ) : null}

        {analyzing ? <p className="add-status">Reading the photo…</p> : null}
        {notice ? <p className="add-status">{notice}</p> : null}
        {error ? <p className="add-status err" role="alert">{error}</p> : null}

        {mode === 'one' ? (
          <form className="add-form" onSubmit={saveOne}>
            <label className="field">
              <span>Name</span>
              <input
                value={tag.name}
                onChange={event => setTag(previous => ({ ...previous, name: event.target.value }))}
                placeholder="Grey oversized hoodie"
                maxLength={80}
                required
              />
            </label>

            <div className="field">
              <span>Category</span>
              <div className="catgrid">
                {CATEGORIES.map(category => (
                  <button
                    key={category}
                    type="button"
                    className={tag.category === category ? 'on' : undefined}
                    onClick={() => setTag(previous => ({ ...previous, category }))}
                  >
                    {label(category)}
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span>Primary colour</span>
              <input
                value={tag.primary_color}
                onChange={event =>
                  setTag(previous => ({ ...previous, primary_color: event.target.value }))
                }
                placeholder="grey"
                maxLength={40}
              />
            </label>

            <label className="field">
              <span>Price (optional)</span>
              <input
                value={price}
                onChange={event => setPrice(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
              />
            </label>

            <div className="field">
              <span>Formality</span>
              <div className="sg wide">
                {FORMALITIES.map(formality => (
                  <button
                    key={formality}
                    type="button"
                    className={tag.formality === formality ? 'on' : undefined}
                    onClick={() => setTag(previous => ({ ...previous, formality }))}
                  >
                    {label(formality)}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span>Warmth</span>
              <div className="sg wide">
                {WARMTHS.map(warmth => (
                  <button
                    key={warmth}
                    type="button"
                    className={tag.warmth === warmth ? 'on' : undefined}
                    onClick={() => setTag(previous => ({ ...previous, warmth }))}
                  >
                    {label(warmth)}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn pri add-submit"
              disabled={saving || !tag.name.trim()}
            >
              {saving ? 'Saving…' : file ? 'Add to closet' : 'Add without a photo'}
            </button>
          </form>
        ) : scanned ? (
          <div className="add-scan">
            <h2 className="add-scan-title">{scanned.length} pieces found</h2>
            <div className="grp">
              {scanned.map((item, index) => (
                <div className="rw" key={index}>
                  <span
                    className="dot"
                    style={{ background: colorHex(item.primary_color) }}
                    aria-hidden="true"
                  />
                  <input
                    value={item.name}
                    onChange={event =>
                      setScanned(previous =>
                        previous
                          ? previous.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, name: event.target.value } : row
                            )
                          : previous
                      )
                    }
                    aria-label={`Piece ${index + 1} name`}
                    className="scan-name"
                  />
                  <select
                    value={item.category}
                    onChange={event =>
                      setScanned(previous =>
                        previous
                          ? previous.map((row, rowIndex) =>
                              rowIndex === index
                                ? { ...row, category: event.target.value as Item['category'] }
                                : row
                            )
                          : previous
                      )
                    }
                    aria-label={`Piece ${index + 1} category`}
                    className="scan-cat"
                  >
                    {CATEGORIES.map(category => (
                      <option key={category} value={category}>
                        {label(category)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn pri add-submit"
              disabled={saving}
              onClick={() => void saveOutfit()}
            >
              {saving ? 'Adding…' : `Add ${scanned.length} to closet`}
            </button>
          </div>
        ) : (
          <div className="add-empty-state">
            <h2>One photo, every layer.</h2>
            <p>
              Shoot the full outfit. Nothing is saved until you confirm the pieces. Scanned items
              use the drawn garment flats, not the photo.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
