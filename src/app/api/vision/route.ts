// Server-side Gemini Vision auto-tagger. Client posts the image as multipart
// `file`; we forward a base64 inline_data part to Gemini with a strict JSON
// contract. The route NEVER writes to Supabase — the user always confirms
// before the row is inserted.

import { NextRequest, NextResponse } from 'next/server'
import { Item } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const GEMINI_MODEL = 'gemini-1.5-flash-latest'
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// 5 MB keeps the base64 payload under ~6.7 MB after encoding, which Gemini
// accepts comfortably and Next can stream without blowing the body limit.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// Gemini returns Vision responses in seconds on free tier. 15s is enough
// headroom and still fails fast enough that the user is not waiting on a
// wedged socket.
const GEMINI_TIMEOUT_MS = 15_000

// Only accept camera/HEIC-friendly image types. Anything else (e.g. text/html
// smuggled in via the multipart field) is rejected before we spend any tokens.
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

const CATEGORIES:    Item['category'][]   = ['top', 'bottom', 'shoes', 'outerwear']
const FORMALITIES:   Item['formality'][]  = ['casual', 'smart_casual', 'formal']
const WARMTHS:       Item['warmth'][]     = ['hot', 'mild', 'cold']
const COLORS = new Set([
  'black','white','grey','gray','navy','blue','beige','brown','red','green',
  'yellow','orange','pink','purple','teal','denim','cream','tan','olive',
  'maroon','khaki','silver','gold',
])

interface SuggestedTags {
  name: string
  category: Item['category']
  primary_color: string
  secondary_color: string | null
  formality: Item['formality']
  warmth: Item['warmth']
}

const STRICT_PROMPT = `Analyze this clothing item. Return ONLY raw JSON (no markdown, no prose):
{"name":"short product-style name, max 5 words","category":"top|bottom|shoes|outerwear","primary_color":"single simple color word like navy/black/beige/red","secondary_color":"single simple color word or empty string","pattern":"solid|striped|printed|logo","formality":"casual|smart_casual|formal","warmth":"hot|mild|cold"}`

function clampCategory(v: unknown): Item['category'] {
  const s = String(v ?? '').toLowerCase() as Item['category']
  return CATEGORIES.includes(s) ? s : 'top'
}
function clampFormality(v: unknown): Item['formality'] {
  const s = String(v ?? '').toLowerCase() as Item['formality']
  return FORMALITIES.includes(s) ? s : 'casual'
}
function clampWarmth(v: unknown): Item['warmth'] {
  const s = String(v ?? '').toLowerCase() as Item['warmth']
  return WARMTHS.includes(s) ? s : 'mild'
}
function clampColor(v: unknown): string {
  const s = String(v ?? '').toLowerCase().trim().split(/\s+/)[0] || ''
  return COLORS.has(s) ? s : 'black'
}
function clampName(v: unknown): string {
  const s = String(v ?? '').trim()
  if (!s) return 'Clothing Item'
  return s.length > 60 ? s.slice(0, 60) : s
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
}

function parseTags(raw: string): SuggestedTags {
  const cleaned = stripFences(raw)
  const obj = (() => {
    try { return JSON.parse(cleaned) } catch {
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) { try { return JSON.parse(m[0]) } catch { return {} } }
      return {}
    }
  })() as Record<string, unknown>

  const sec = String(obj.secondary_color ?? '').trim()
  return {
    name:            clampName(obj.name),
    category:        clampCategory(obj.category),
    primary_color:   clampColor(obj.primary_color),
    secondary_color: sec ? clampColor(sec) : null,
    formality:       clampFormality(obj.formality),
    warmth:          clampWarmth(obj.warmth),
  }
}

export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ suggestedTags: null, error: 'bad_form' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ suggestedTags: null, error: 'no_file' }, { status: 400 })
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ suggestedTags: null, error: 'bad_mime' }, { status: 415 })
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ suggestedTags: null, error: 'too_big' }, { status: 413 })
  }
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ suggestedTags: null, error: 'no_key' }, { status: 503 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const base64 = bytes.toString('base64')

  // AbortController kills the socket if Gemini hangs. We never want the user
  // staring at a spinner while their image is buffered in someone else's queue.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
  try {
    const r = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: STRICT_PROMPT },
            { inline_data: { mime_type: file.type, data: base64 } },
          ],
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
      signal: controller.signal,
    })
    if (!r.ok) {
      return NextResponse.json({ suggestedTags: null, error: `gemini_${r.status}` }, { status: 502 })
    }
    const data = await r.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!text) {
      // Gemini sometimes returns a candidate with no content (safety block or
      // truncated stream). Surface that as a distinct code so the client can
      // tell the user "AI couldn't read that one" instead of silently retrying.
      const finishReason = data?.candidates?.[0]?.finishReason
      const code = finishReason && finishReason !== 'STOP' ? `gemini_finish_${String(finishReason).toLowerCase()}` : 'empty_response'
      return NextResponse.json({ suggestedTags: null, error: code }, { status: 502 })
    }
    const tags = parseTags(text)
    return NextResponse.json({ suggestedTags: tags })
  } catch (err) {
    const code = err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'network'
    return NextResponse.json({ suggestedTags: null, error: code }, { status: code === 'timeout' ? 504 : 502 })
  } finally {
    clearTimeout(timer)
  }
}
