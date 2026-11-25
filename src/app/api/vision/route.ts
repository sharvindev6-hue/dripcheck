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
  clampTag,
  parseJsonLoose,
  readUpload,
  SINGLE_ITEM_PROMPT,
} from '@/lib/vision'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

  const apiKey = getServerEnv().GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ suggestedTags: null, error: 'no_key' }, { status: 503 })
  }

  const bytes = Buffer.from(await upload.file.arrayBuffer())
  const result = await callGeminiJson(
    apiKey,
    upload.mime,
    bytes.toString('base64'),
    SINGLE_ITEM_PROMPT
  )

  if (!result.ok) {
    logServerError('vision:gemini', result.error)
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
