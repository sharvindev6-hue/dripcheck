// Single-item Gemini auto-tagger. Stateless: it never writes to the database.
// The user confirms every field before /api/items saves it.

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
import { getServerEnv } from '@/lib/env'
import {
  callGeminiJson,
  callNvidiaVisionJson,
  clampTag,
  NVIDIA_DEFAULT_VISION_MODEL,
  parseJsonLoose,
  readUpload,
  SINGLE_ITEM_PROMPT,
} from '@/lib/vision'

export const dynamic = 'force-dynamic'
// NVIDIA (20s) plus a Gemini retry (15s) must fit inside one invocation.
export const maxDuration = 45

export async function POST(req: NextRequest) {
  const auth = await getAuth()
  if (!auth) return unauthorized()

  const limit = rateLimitPair(auth.user.id, 'vision', 20, 150)
  if (!limit.ok) return tooMany(limit)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return badRequest('bad_form')
  }

  const upload = readUpload(form)
  if ('error' in upload) {
    return NextResponse.json({ suggestedTags: null, error: upload.error }, { status: upload.status })
  }

  const env = getServerEnv()
  const nvidiaKey = env.NVIDIA_NIM_API_KEY
  const geminiKey = env.GEMINI_API_KEY
  if (!nvidiaKey && !geminiKey) {
    return NextResponse.json({ suggestedTags: null, error: 'no_key' }, { status: 503 })
  }

  const base64 = Buffer.from(await upload.file.arrayBuffer()).toString('base64')

  let result: Awaited<ReturnType<typeof callGeminiJson>>
  if (nvidiaKey) {
    result = await callNvidiaVisionJson(
      nvidiaKey,
      env.NVIDIA_NIM_VISION_MODEL || NVIDIA_DEFAULT_VISION_MODEL,
      upload.mime,
      base64,
      SINGLE_ITEM_PROMPT
    )
    if (!result.ok && geminiKey) {
      logServerError('vision:nvidia', result.error)
      result = await callGeminiJson(geminiKey, upload.mime, base64, SINGLE_ITEM_PROMPT)
    }
  } else if (geminiKey) {
    result = await callGeminiJson(geminiKey, upload.mime, base64, SINGLE_ITEM_PROMPT)
  } else {
    return NextResponse.json({ suggestedTags: null, error: 'no_key' }, { status: 503 })
  }

  if (!result.ok) {
    logServerError('vision:ai', result.error)
    return NextResponse.json(
      { suggestedTags: null, error: result.error },
      { status: result.status }
    )
  }

  try {
    const parsed = parseJsonLoose(result.text)
    if (!parsed || typeof parsed !== 'object' || !('name' in parsed)) {
      return NextResponse.json({ suggestedTags: null, error: 'empty_response' }, { status: 502 })
    }
    return NextResponse.json({ suggestedTags: clampTag(parsed) })
  } catch (error) {
    logServerError('vision:parse', error)
    return serverError('bad_ai_response')
  }
}
