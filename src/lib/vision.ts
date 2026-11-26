// Shared Gemini image-tagging helpers used by /api/vision (one piece) and
// /api/extract (a whole outfit). Every field is clamped before it reaches a
// response or the database.

import type { Item } from '@/types'

export const GEMINI_MODEL = 'gemini-1.5-flash-latest'
export const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

export const NVIDIA_NIM_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
export const NVIDIA_DEFAULT_VISION_MODEL = 'nvidia/nemotron-3.5-super-vl-120b-a12b'

// Keep below the common 4.5 MB serverless request ceiling.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024
export const GEMINI_TIMEOUT_MS = 15_000
// Keep the NVIDIA attempt short enough that the Gemini fallback still fits
// inside the route's maxDuration.
export const NVIDIA_TIMEOUT_MS = 20_000

export const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

const CATEGORIES: Item['category'][] = ['top', 'bottom', 'shoes', 'outerwear']
const FORMALITIES: Item['formality'][] = ['casual', 'smart_casual', 'formal']
const WARMTHS: Item['warmth'][] = ['hot', 'mild', 'cold']

const COLORS = new Set([
  'black',
  'white',
  'grey',
  'gray',
  'navy',
  'blue',
  'beige',
  'brown',
  'red',
  'green',
  'yellow',
  'orange',
  'pink',
  'purple',
  'teal',
  'denim',
  'cream',
  'tan',
  'olive',
  'maroon',
  'khaki',
  'silver',
  'gold',
])

export interface TaggedItem {
  name: string
  category: Item['category']
  primary_color: string
  secondary_color: string | null
  formality: Item['formality']
  warmth: Item['warmth']
}

export const SINGLE_ITEM_PROMPT = `Analyze this clothing item. Return ONLY raw JSON (no markdown, no prose):
{"name":"short product-style name, max 5 words","category":"top|bottom|shoes|outerwear","primary_color":"single simple color word like navy/black/beige/red","secondary_color":"single simple color word or empty string","formality":"casual|smart_casual|formal","warmth":"hot|mild|cold"}`

export const OUTFIT_PROMPT = `Analyze this photo of a complete outfit. Identify every visible garment as a separate piece.
Return ONLY raw JSON (no markdown, no prose):
{"items":[{"name":"short product-style name, max 5 words","category":"top|bottom|shoes|outerwear","primary_color":"single simple color word","secondary_color":"single simple color word or empty string","formality":"casual|smart_casual|formal","warmth":"hot|mild|cold"}]}
Rules: at most 6 items. Include every top, bottom, pair of shoes and outer layer you can see. Never invent a garment that is not visible.`

function clampCategory(value: unknown): Item['category'] {
  const next = String(value ?? '').toLowerCase() as Item['category']
  return CATEGORIES.includes(next) ? next : 'top'
}

function clampFormality(value: unknown): Item['formality'] {
  const next = String(value ?? '').toLowerCase() as Item['formality']
  return FORMALITIES.includes(next) ? next : 'casual'
}

function clampWarmth(value: unknown): Item['warmth'] {
  const next = String(value ?? '').toLowerCase() as Item['warmth']
  return WARMTHS.includes(next) ? next : 'mild'
}

function clampColor(value: unknown): string {
  const text = String(value ?? '')
    .toLowerCase()
    .trim()
  if (!text) return 'black'
  // Match any token so "off white" and "dark navy" do not collapse to black.
  const found = text.split(/[^a-z]+/).find(token => COLORS.has(token))
  return found ?? 'black'
}

function clampName(value: unknown): string {
  const next = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!next) return 'Clothing item'
  return next.length > 60 ? next.slice(0, 60) : next
}

function stripFences(value: string): string {
  return value.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
}

export function parseJsonLoose(raw: string): unknown {
  const cleaned = stripFences(raw)
  try {
    return JSON.parse(cleaned)
  } catch {
    const object = cleaned.match(/\{[\s\S]*\}/)
    if (object) {
      try {
        return JSON.parse(object[0])
      } catch {
        return null
      }
    }
    return null
  }
}

export function clampTag(value: unknown): TaggedItem {
  const obj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const secondary = String(obj.secondary_color ?? '').trim()
  return {
    name: clampName(obj.name),
    category: clampCategory(obj.category),
    primary_color: clampColor(obj.primary_color),
    secondary_color: secondary ? clampColor(secondary) : null,
    formality: clampFormality(obj.formality),
    warmth: clampWarmth(obj.warmth),
  }
}

export function clampOutfitTags(value: unknown): TaggedItem[] {
  const obj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const raw = Array.isArray(obj.items) ? obj.items : []
  return raw.slice(0, 6).map(clampTag)
}

export interface GeminiResult {
  ok: true
  text: string
}

export interface GeminiFailure {
  ok: false
  status: number
  error: string
}

export async function callGeminiJson(
  apiKey: string,
  mimeType: string,
  base64: string,
  prompt: string
): Promise<GeminiResult | GeminiFailure> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      return { ok: false, status: 502, error: `gemini_${response.status}` }
    }

    const data = await response.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!text) {
      const finish = data?.candidates?.[0]?.finishReason
      return {
        ok: false,
        status: 502,
        error: finish && finish !== 'STOP' ? `gemini_finish_${String(finish).toLowerCase()}` : 'empty_response',
      }
    }
    return { ok: true, text }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError'
    return { ok: false, status: timedOut ? 504 : 502, error: timedOut ? 'timeout' : 'network' }
  } finally {
    clearTimeout(timer)
  }
}

/** NVIDIA NIM is OpenAI-compatible and accepts the image as a data URL. */
export async function callNvidiaVisionJson(
  apiKey: string,
  model: string,
  mimeType: string,
  base64: string,
  prompt: string
): Promise<GeminiResult | GeminiFailure> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NVIDIA_TIMEOUT_MS)
  try {
    const response = await fetch(NVIDIA_NIM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 800,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      return { ok: false, status: 502, error: `nvidia_${response.status}` }
    }

    const data = await response.json()
    const text: unknown = data?.choices?.[0]?.message?.content
    if (typeof text !== 'string' || !text.trim()) {
      const finish = data?.choices?.[0]?.finish_reason
      return {
        ok: false,
        status: 502,
        error: finish && finish !== 'stop' ? `nvidia_finish_${String(finish).toLowerCase()}` : 'empty_response',
      }
    }
    return { ok: true, text }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError'
    return { ok: false, status: timedOut ? 504 : 502, error: timedOut ? 'timeout' : 'network' }
  } finally {
    clearTimeout(timer)
  }
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
}

/** Browsers sometimes leave File.type empty or use the non-standard image/jpg. */
function normaliseImageMime(file: File): string | null {
  const type = file.type.toLowerCase()
  if (type === 'image/jpg') return 'image/jpeg'
  if (ALLOWED_IMAGE_MIME.has(type)) return type
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXTENSION[extension] ?? null
}

export function readUpload(
  formData: FormData
): { file: File; mime: string } | { error: string; status: number } {
  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'no_file', status: 400 }
  const mime = normaliseImageMime(file)
  if (!mime) return { error: 'bad_mime', status: 415 }
  if (file.size > MAX_IMAGE_BYTES) return { error: 'too_big', status: 413 }
  return { file, mime }
}
