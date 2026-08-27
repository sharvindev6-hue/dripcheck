'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Item } from '@/types'
import Navbar from '@/components/Navbar'
import ItemCard from '@/components/ItemCard'
import UploadModal from '@/components/UploadModal'
import { useToast } from '@/components/Toast'
import { EmptyWardrobe } from '@/components/icons'

// Single browser client for the whole module (avoids re-creating it every render)
const supabase = createClient()

export default function ClosetPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [suggestedTags, setSuggestedTags] = useState<Partial<Item> | null>(null)
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set())
  const [analyzing, setAnalyzing] = useState(false)
  const { showToast } = useToast()

  const loadItems = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', user?.id ?? '')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading items:', error)
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) {
      showToast('Could not delete that item — try again.', 'error')
    } else {
      setItems(items.filter(item => item.id !== id))
      showToast('Item removed from your closet.')
    }
  }

  const handleUpload = async (file: File, tags?: Partial<Item>) => {
    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    const { error: uploadError, data } = await supabase.storage
      .from('wardrobe-items')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // Build the full public URL — next/image needs it, a bare storage path breaks <Image>
    const { data: { publicUrl } } = supabase.storage
      .from('wardrobe-items')
      .getPublicUrl(data.path)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error: insertError } = await supabase.from('items').insert({
      user_id: user.id,
      image_url: publicUrl,
      name: tags?.name || 'Clothing Item',
      category: tags?.category || 'top',
      primary_color: tags?.primary_color || 'black',
      secondary_color: tags?.secondary_color || null,
      formality: tags?.formality || 'casual',
      warmth: tags?.warmth || 'mild',
      price: tags?.price ?? null,
    })

    if (insertError) throw insertError

    await loadItems()
    showToast('Added to your closet ✨')
  }

  const handleAnalyze = async (file: File): Promise<Partial<Item> | null> => {
    setAnalyzing(true)
    setSuggestedTags(null)
    setAiFilledFields(new Set())
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await fetch('/api/vision', { method: 'POST', body: form })
      if (!r.ok) return null
      const data = await r.json()
      if (!data.suggestedTags) return null
      setSuggestedTags(data.suggestedTags)
      // Track which fields were filled by AI so the modal can badge them.
      const filled = new Set<string>()
      for (const [k, v] of Object.entries(data.suggestedTags)) {
        if (v !== null && v !== '' && v !== undefined) filled.add(k)
      }
      setAiFilledFields(filled)
      return data.suggestedTags
    } catch {
      return null
    } finally {
      setAnalyzing(false)
    }
  }

  const handleModalOpen = () => {
    // Fresh state per open so previous AI tags don't leak into a new item.
    setSuggestedTags(null)
    setAiFilledFields(new Set())
    setShowUploadModal(true)
  }

  const filteredItems = filterCategory === 'all'
    ? items
    : items.filter(item => item.category === filterCategory)

  const counts: Record<string, number> = { all: items.length }
  for (const item of items) {
    counts[item.category] = (counts[item.category] || 0) + 1
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-cream">
      <Navbar />

      <main className="flex-1 p-4 pb-28 md:p-10 md:pb-10">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-soft">↳ THE WARDROBE</p>
              <h1 className="mt-1 font-mono text-5xl font-extrabold uppercase leading-none tracking-tighter text-ink md:text-6xl">
                YOUR CLOSET
              </h1>
              <p className="mt-2 font-mono text-sm font-bold uppercase tracking-wider text-ink-soft">
                {items.length} {items.length === 1 ? 'PIECE' : 'PIECES'} IN THE ROTATION
              </p>
            </div>
            <button
              onClick={handleModalOpen}
              className="group inline-flex items-center gap-2 self-start bg-pink border-[3px] border-ink shadow-chunk px-5 py-3 font-mono font-extrabold uppercase tracking-wider text-ink btn-press"
            >
              <span aria-hidden="true">＋</span>
              <span>ADD ITEM</span>
            </button>
          </header>

          <div className="mb-8 flex flex-wrap gap-2 pb-1">
            {['all', 'top', 'bottom', 'shoes', 'outerwear'].map((cat, i) => {
              const active = filterCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`fade-up fade-up-d${Math.min(i + 1, 8)} inline-flex items-center gap-2 border-[3px] border-ink px-4 py-2 font-mono font-extrabold uppercase tracking-wider transition-all btn-press
                              ${active
                                ? 'bg-ink text-cream shadow-chunk'
                                : 'bg-cream text-ink hover:bg-yellow'}`}
                >
                  <span>{cat.replace('_', ' ')}</span>
                  <span className={`border-2 border-ink px-2 py-0.5 text-[10px] ${active ? 'bg-cream text-ink' : 'bg-cyan text-ink'}`}>
                    {counts[cat] || 0}
                  </span>
                </button>
              )
            })}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="shimmer aspect-square border-[3px] border-ink" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-cream border-[3px] border-ink shadow-chunkLg px-6 py-16 text-center">
              <div className="mx-auto mb-5 flex justify-center">
                <EmptyWardrobe size={140} />
              </div>
              <h3 className="font-mono text-3xl font-extrabold uppercase tracking-tighter text-ink">CLOSET IS EMPTY</h3>
              <p className="mx-auto mt-2 max-w-sm font-mono text-sm font-bold uppercase tracking-wider text-ink-soft">
                ADD A FEW PIECES & MILLI WILL START COOKING
              </p>
              <button
                onClick={handleModalOpen}
                className="mt-6 inline-flex items-center gap-2 bg-yellow border-[3px] border-ink shadow-chunk px-6 py-3 font-mono font-extrabold uppercase tracking-wider text-ink btn-press"
              >
                <span aria-hidden="true">＋</span> ADD YOUR FIRST ITEM
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {filteredItems.map((item, i) => (
                <div
                  key={item.id}
                  className={`fade-up fade-up-d${Math.min((i % 8) + 1, 8)}`}
                >
                  <ItemCard item={item} onDelete={handleDelete} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
        suggestedTags={suggestedTags}
        isAnalyzing={analyzing}
        onAnalyze={handleAnalyze}
        aiFilledFields={aiFilledFields}
      />
    </div>
  )
}
