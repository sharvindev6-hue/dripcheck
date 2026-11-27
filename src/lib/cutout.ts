// Server-only local cutout pipeline. BiRefNet-lite (MIT) runs through
// Transformers.js/ONNX Runtime, then the alpha matte is composited onto the
// app's cream background. The model downloads once on first use and is cached
// by the Hugging Face cache; the pipeline itself is cached per process.

import 'server-only'
import { AutoModel, AutoProcessor, RawImage } from '@huggingface/transformers'
import sharp from 'sharp'

export const CUTOUT_MODEL_ID = 'studioludens/birefnet-lite-512'
export const CUTOUT_CREAM = '#EFE8D8'

export interface CutoutResult {
  png: Buffer
  coverage: number
  borderCoverage: number
  quality: 'ok' | 'review'
}

interface MaskTensor {
  [index: number]: MaskTensor
  dims: number[]
  data: Float32Array | Uint8Array
  sigmoid: () => MaskTensor
  mul: (value: number) => MaskTensor
  to: (dtype: string) => MaskTensor
  unsqueeze: (dimension: number) => MaskTensor
}

interface CutoutModelOutput {
  output_image?: MaskTensor
  logits?: MaskTensor
}

interface CutoutPipeline {
  model: Awaited<ReturnType<typeof AutoModel.from_pretrained>>
  processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>
}

const globalForCutout = globalThis as unknown as {
  __dripcheckCutoutPipeline?: Promise<CutoutPipeline>
}

function loadPipeline(): Promise<CutoutPipeline> {
  if (!globalForCutout.__dripcheckCutoutPipeline) {
    globalForCutout.__dripcheckCutoutPipeline = (async () => {
      const [model, processor] = await Promise.all([
        AutoModel.from_pretrained(CUTOUT_MODEL_ID, { dtype: 'fp32' }),
        AutoProcessor.from_pretrained(CUTOUT_MODEL_ID),
      ])
      return { model, processor }
    })().catch(error => {
      // Let the next request retry a failed download/load.
      globalForCutout.__dripcheckCutoutPipeline = undefined
      throw error
    })
  }
  return globalForCutout.__dripcheckCutoutPipeline
}

/**
 * Normalizes orientation and format first, so EXIF-rotated phone photos and
 * formats sharp can decode all reach the model the same way.
 */
export async function createCreamCutout(input: Buffer): Promise<CutoutResult> {
  const normalized = await sharp(input).rotate().png().toBuffer()
  const image = await RawImage.fromBlob(
    new Blob([new Uint8Array(normalized)], { type: 'image/png' })
  )
  const { model, processor } = await loadPipeline()
  const { pixel_values } = await processor(image)
  const run = model as unknown as (inputs: {
    input_image: unknown
  }) => Promise<CutoutModelOutput>
  const output = await run({ input_image: pixel_values })
  const raw = output.output_image ?? output.logits
  if (!raw) throw new Error('cutout_model_returned_no_mask')

  // Collapse batch/channel dimensions until the tensor is a single [H, W]
  // plane. Different checkpoints return [H, W], [1, H, W] or [1, 1, H, W].
  let plane = raw
  while (plane.dims.length > 2) {
    const first = plane[0]
    if (!first) throw new Error('cutout_model_returned_empty_mask')
    plane = first
  }
  if (plane.data.length === 0) throw new Error('cutout_model_returned_empty_mask')

  // Some checkpoints emit probabilities and others emit logits. Applying
  // sigmoid twice would crush a valid probability mask, so detect the range
  // first instead of assuming.
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < plane.data.length; i += 1) {
    const value = plane.data[i]
    if (value < min) min = value
    if (value > max) max = value
  }
  const probabilities = min >= -0.001 && max <= 1.001 ? plane : plane.sigmoid()

  const mask = await RawImage.fromTensor(
    probabilities.mul(255).to('uint8').unsqueeze(0) as unknown as Parameters<
      typeof RawImage.fromTensor
    >[0]
  ).resize(image.width, image.height)
  const alpha = mask.data as Uint8Array

  let alphaSum = 0
  let borderForeground = 0
  let borderCount = 0
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      const index = y * mask.width + x
      const value = alpha[index] ?? 0
      alphaSum += value
      if (x === 0 || y === 0 || x === mask.width - 1 || y === mask.height - 1) {
        borderCount += 1
        if (value > 128) borderForeground += 1
      }
    }
  }

  const coverage = alphaSum / (alpha.length * 255)
  const borderCoverage = borderCount > 0 ? borderForeground / borderCount : 0

  // A blank mask, an all-foreground mask, or a subject bleeding off every edge
  // usually means the model could not separate the subject from its backdrop.
  const quality =
    coverage < 0.02 || coverage > 0.97 || borderCoverage > 0.65 ? 'review' : 'ok'

  const { data: source, info } = await sharp(normalized)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const cream = {
    r: Number.parseInt(CUTOUT_CREAM.slice(1, 3), 16),
    g: Number.parseInt(CUTOUT_CREAM.slice(3, 5), 16),
    b: Number.parseInt(CUTOUT_CREAM.slice(5, 7), 16),
  }
  const out = Buffer.alloc(info.width * info.height * 3)
  for (let i = 0; i < info.width * info.height; i += 1) {
    const sourceAlpha = source[i * 4 + 3] / 255
    const a = ((alpha[i] ?? 0) / 255) * sourceAlpha
    out[i * 3] = Math.round(source[i * 4] * a + cream.r * (1 - a))
    out[i * 3 + 1] = Math.round(source[i * 4 + 1] * a + cream.g * (1 - a))
    out[i * 3 + 2] = Math.round(source[i * 4 + 2] * a + cream.b * (1 - a))
  }

  const png = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 3 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer()

  return { png, coverage, borderCoverage, quality }
}
