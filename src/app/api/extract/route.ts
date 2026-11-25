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
  clampOutfitTags,
  OUTFIT_PROMPT,
  parseJsonLoose,
  readUpload,
} from '@/lib/vision'
import { getServerEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

  const upload = readUpload(form)
  if ('error' in upload) {
    return NextResponse.json({ items: [], error: upload.error }, { status: upload.status })
  }

  const apiKey = getServerEnv().GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ items: [], error: 'no_key' }, { status: 503 })
  }

  const bytes = Buffer.from(await upload.file.arrayBuffer())
  const result = await callGeminiJson(
    apiKey,
    upload.mime,
    bytes.toString('base64'),
    OUTFIT_PROMPT
  )

  if (!result.ok) {
    logServerError('extract:gemini', result.error)
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
