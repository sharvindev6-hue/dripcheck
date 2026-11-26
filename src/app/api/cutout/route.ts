import { NextResponse, type NextRequest } from 'next/server'
import { getAuth, logServerError, tooMany, unauthorized } from '@/lib/api'
import { rateLimitPair } from '@/lib/rate-limit'
import { readUpload } from '@/lib/vision'
import { CUTOUT_MODEL_ID, createCreamCutout } from '@/lib/cutout'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// The model loads on the first request; later requests are much faster.
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const auth = await getAuth()
  if (!auth) return unauthorized()

  const limit = rateLimitPair(auth.user.id, 'cutout', 20, 300)
  if (!limit.ok) return tooMany(limit)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'bad_form' }, { status: 400 })
  }

  const upload = readUpload(form)
  if ('error' in upload) {
    return NextResponse.json({ error: upload.error }, { status: upload.status })
  }

  try {
    const input = Buffer.from(await upload.file.arrayBuffer())
    const result = await createCreamCutout(input)

    // A blank mask means the model found nothing to keep. Do not save a sheet
    // of cream and call it a cutout; let the add screen keep the original.
    if (result.coverage < 0.001) {
      return NextResponse.json(
        { error: 'cutout_empty', coverage: result.coverage },
        { status: 422 }
      )
    }

    return new NextResponse(new Uint8Array(result.png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(result.png.byteLength),
        'Cache-Control': 'no-store',
        'X-Cutout-Model': CUTOUT_MODEL_ID,
        'X-Cutout-Quality': result.quality,
        'X-Cutout-Coverage': (result.coverage * 100).toFixed(1),
        'X-Cutout-Border-Coverage': (result.borderCoverage * 100).toFixed(1),
      },
    })
  } catch (error) {
    logServerError('cutout', error)
    return NextResponse.json({ error: 'cutout_failed' }, { status: 502 })
  }
}
