'use client'

import { useEffect, useRef, useState } from 'react'
import { Item } from '@/types'

// Chunky monoline close + edit glyphs.
function XGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  )
}
function PencilGlyph({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
      <path d="M14 4l6 6L8 22H2v-6z" /><path d="M14 4l6 6" />
    </svg>
  )
}
function SparkGlyph({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 1l1.5 3.5L11 6 7.5 7.5 6 11l-1.5-3.5L1 6l3.5-1.5z" />
    </svg>
  )
}

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (file: File, tags?: Partial<Item>) => Promise<void>
  suggestedTags?: Partial<Item> | null
  isAnalyzing?: boolean
  onAnalyze?: (file: File) => Promise<Partial<Item> | null>
  aiFilledFields?: Set<string>
}

export default function UploadModal({
  isOpen,
  onClose,
  onUpload,
  suggestedTags,
  isAnalyzing,
  onAnalyze,
  aiFilledFields,
}: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [category, setCategory] = useState<Item['category']>('top')
  const [primaryColor, setPrimaryColor] = useState('')
  const [secondaryColor, setSecondaryColor] = useState('')
  const [formality, setFormality] = useState<Item['formality']>('casual')
  const [warmth, setWarmth] = useState<Item['warmth']>('mild')
  const [price, setPrice] = useState('')

  const analyzedFor = useRef<File | null>(null)

  useEffect(() => {
    if (!suggestedTags) return
    if (suggestedTags.name)            setName(suggestedTags.name)
    if (suggestedTags.category)        setCategory(suggestedTags.category)
    if (suggestedTags.primary_color)   setPrimaryColor(suggestedTags.primary_color)
    if (suggestedTags.secondary_color) setSecondaryColor(suggestedTags.secondary_color)
    if (suggestedTags.formality)       setFormality(suggestedTags.formality)
    if (suggestedTags.warmth)          setWarmth(suggestedTags.warmth)
  }, [suggestedTags])

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  // Auto-fire analyze once per picked file. Caller passes onAnalyze; failures
  // fall through to manual entry.
  useEffect(() => {
    if (!selectedFile || !onAnalyze) return
    if (analyzedFor.current === selectedFile) return
    analyzedFor.current = selectedFile
    setAnalysisError(null)
    onAnalyze(selectedFile)
      .then((tags) => { if (!tags) setAnalysisError('AI OFFLINE — TAG IT MANUALLY') })
      .catch(() => setAnalysisError('AI OFFLINE — TAG IT MANUALLY'))
  }, [selectedFile, onAnalyze])

  if (!isOpen) return null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      analyzedFor.current = null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) return
    setUploading(true)
    const itemData: Partial<Item> = {
      name: name || 'Clothing Item',
      category,
      primary_color: primaryColor || 'black',
      secondary_color: secondaryColor || undefined,
      formality,
      warmth,
      price: price ? parseFloat(price) : undefined,
    }
    try {
      await onUpload(selectedFile, itemData)
      setSelectedFile(null)
      setPreviewUrl(null)
      setName(''); setCategory('top'); setPrimaryColor(''); setSecondaryColor('')
      setFormality('casual'); setWarmth('mild'); setPrice('')
      analyzedFor.current = null
      setAnalysisError(null)
      onClose()
    } catch {
      setAnalysisError('Upload failed — try again.')
    } finally {
      setUploading(false)
    }
  }

  const aiHint = (field: keyof Item) =>
    aiFilledFields?.has(field) ? (
      <span className="ml-2 inline-flex items-center gap-1 bg-lime border-2 border-ink px-2 py-0.5 text-[10px] font-mono font-extrabold uppercase tracking-wider text-ink">
        <SparkGlyph size={10} /> AI ✓
      </span>
    ) : null

  // Shared form-input class. Sharp corners, ink border, no rounded.
  const inputClass = "w-full px-3 py-2 border-[3px] border-ink bg-cream font-mono text-ink focus:bg-yellow outline-none"
  const labelClass = "mb-1 flex items-center text-xs font-mono font-extrabold uppercase tracking-wider text-ink"

  return (
    <div className="fixed inset-0 bg-ink/70 flex items-center justify-center z-50 p-4">
      <div className="bg-cream border-[3px] border-ink shadow-chunkLg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b-[3px] border-ink">
            <h2 className="font-mono text-2xl font-extrabold uppercase tracking-tight text-ink">＋ ADD ITEM</h2>
            <button
              onClick={onClose}
              className="bg-pink border-[3px] border-ink p-2 btn-press"
              aria-label="Close"
            >
              <XGlyph size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="border-[3px] border-dashed border-ink bg-yellow/40 p-6 text-center">
              {previewUrl ? (
                <div className="relative aspect-square max-w-xs mx-auto border-[3px] border-ink bg-cream">
                  {/* blob: URLs are rejected by next/image — use plain <img> for the live preview */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); setPreviewUrl(null); analyzedFor.current = null }}
                    className="absolute -top-3 -right-3 bg-pink border-[3px] border-ink p-1.5 btn-press"
                    aria-label="Remove image"
                  >
                    <XGlyph size={14} />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                  <div className="w-20 h-20 mx-auto bg-cyan border-[3px] border-ink flex items-center justify-center mb-3">
                    <PencilGlyph size={32} />
                  </div>
                  <p className="font-mono text-sm font-extrabold uppercase tracking-wider">CLICK TO UPLOAD PHOTO</p>
                  <p className="font-mono text-xs uppercase opacity-60 mt-1">PNG · JPG · UP TO 5MB</p>
                </label>
              )}
            </div>

            {isAnalyzing && (
              <div className="bg-cyan border-[3px] border-ink p-3 text-center">
                <p className="font-mono text-sm font-extrabold uppercase tracking-wider">✨ MILLI IS READING IT…</p>
              </div>
            )}

            {aiFilledFields && aiFilledFields.size > 0 && !isAnalyzing && (
              <div className="bg-lime border-[3px] border-ink p-3">
                <p className="font-mono text-sm font-extrabold uppercase tracking-wider">✓ AI FILLED THESE — CHECK & EDIT</p>
              </div>
            )}

            {analysisError && (
              <div className="bg-pink border-[3px] border-ink p-3">
                <p className="font-mono text-sm font-extrabold uppercase tracking-wider">{analysisError}</p>
              </div>
            )}

            <div>
              <label className={labelClass}>
                <span>ITEM NAME *</span>{aiHint('name')}
              </label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="NAVY COTTON T-SHIRT" className={inputClass} required />
            </div>

            <div>
              <label className={labelClass}><span>CATEGORY *</span>{aiHint('category')}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as Item['category'])} className={inputClass}>
                <option value="top">TOP</option>
                <option value="bottom">BOTTOM</option>
                <option value="shoes">SHOES</option>
                <option value="outerwear">OUTERWEAR</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}><span>PRIMARY COLOR *</span>{aiHint('primary_color')}</label>
                <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="NAVY, BLACK…" className={inputClass} required />
              </div>
              <div>
                <label className={labelClass}><span>SECONDARY</span>{aiHint('secondary_color')}</label>
                <input type="text" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} placeholder="OPTIONAL" className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}><span>FORMALITY *</span>{aiHint('formality')}</label>
                <select value={formality} onChange={(e) => setFormality(e.target.value as Item['formality'])} className={inputClass}>
                  <option value="casual">CASUAL</option>
                  <option value="smart_casual">SMART CASUAL</option>
                  <option value="formal">FORMAL</option>
                </select>
              </div>
              <div>
                <label className={labelClass}><span>WARMTH *</span>{aiHint('warmth')}</label>
                <select value={warmth} onChange={(e) => setWarmth(e.target.value as Item['warmth'])} className={inputClass}>
                  <option value="hot">HOT (&gt;24°C)</option>
                  <option value="mild">MILD (12-24°C)</option>
                  <option value="cold">COLD (&lt;12°C)</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}><span>PRICE ($)</span></label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="OPTIONAL" className={inputClass} min="0" step="0.01" />
            </div>

            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="w-full py-3 bg-pink border-[3px] border-ink shadow-chunk font-mono font-extrabold uppercase tracking-wider text-ink btn-press disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'UPLOADING…' : '＋ ADD TO CLOSET'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}