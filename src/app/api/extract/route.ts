import { NextRequest, NextResponse } from 'next/server'
import {
  badRequest,
  getAuth,
  logServerError,
  serverError,
  tooMany,
  unauthorized,
} from '@/lib/api'
import { rateLimitPair } from '@/lib/rate-limit'
import {
  callGeminiJson,
  callNvidiaVisionJson,
  clampOutfitTags,
  NVIDIA_DEFAULT_VISION_MODEL,
  OUTFIT_PROMPT,
  parseJsonLoose,
  readUpload,
} from '@/lib/vision'
import { getServerEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'
// NVIDIA (20s) plus a Gemini retry (15s) must fit inside one invocation.
export const maxDuration = 45

export async function POST(req: NextRequest) {
  const auth = await getAuth()
  if (!auth) return unauthorized()

  const limit = rateLimitPair(auth.user.id, 'extract', 12, 120)
  if (!limit.ok) return tooMany(limit)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return badRequest('bad_form')
  }

  const upload = await readUpload(form)
  if ('error' in upload) {
    return NextResponse.json({ items: [], error: upload.error }, { status: upload.status })
  }

  const env = getServerEnv()
  const nvidiaKey = env.NVIDIA_NIM_API_KEY
  const geminiKey = env.GEMINI_API_KEY
  if (!nvidiaKey && !geminiKey) {
    return NextResponse.json({ items: [], error: 'no_key' }, { status: 503 })
  }

  const base64 = upload.buffer.toString('base64')

  let result: Awaited<ReturnType<typeof callGeminiJson>>
  if (nvidiaKey) {
    result = await callNvidiaVisionJson(
      nvidiaKey,
      env.NVIDIA_NIM_VISION_MODEL || NVIDIA_DEFAULT_VISION_MODEL,
      upload.mime,
      base64,
      OUTFIT_PROMPT
    )
    if (!result.ok && geminiKey) {
      logServerError('extract:nvidia', result.error)
      result = await callGeminiJson(geminiKey, upload.mime, base64, OUTFIT_PROMPT)
    }
  } else if (geminiKey) {
    result = await callGeminiJson(geminiKey, upload.mime, base64, OUTFIT_PROMPT)
  } else {
    return NextResponse.json({ items: [], error: 'no_key' }, { status: 503 })
  }

  if (!result.ok) {
    logServerError('extract:ai', result.error)
    return NextResponse.json({ items: [], error: result.error }, { status: result.status })
  }

  try {
    const items = clampOutfitTags(parseJsonLoose(result.text))
    if (items.length === 0) {
      return NextResponse.json({ items: [], error: 'nothing_found' }, { status: 422 })
    }
    return NextResponse.json({ items })
  } catch (error) {
    logServerError('extract:parse', error)
    return serverError('bad_ai_response')
  }
}
