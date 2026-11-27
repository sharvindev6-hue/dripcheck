import 'server-only'
import { getServerEnv } from './env'

const AI_TIMEOUT_MS = 20_000
const FEATHERLESS_URL = 'https://api.featherless.ai/v1/chat/completions'
const NVIDIA_NIM_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const DEFAULT_NVIDIA_MODEL = 'nvidia/nemotron-3.5-bolt-e4b'

export type TextMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface TextProvider {
  url: string
  key: string
  model: string
  label: 'nvidia' | 'featherless'
}

export interface TextOptions {
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
}

/** NVIDIA NIM is preferred when present; Featherless remains supported. */
export function getTextProvider(): TextProvider | null {
  const env = getServerEnv()
  if (env.NVIDIA_NIM_API_KEY) {
    return {
      url: NVIDIA_NIM_URL,
      key: env.NVIDIA_NIM_API_KEY,
      model: env.NVIDIA_NIM_MODEL || DEFAULT_NVIDIA_MODEL,
      label: 'nvidia',
    }
  }
  if (env.FEATHERLESS_API_KEY) {
    return {
      url: FEATHERLESS_URL,
      key: env.FEATHERLESS_API_KEY,
      model: env.FEATHERLESS_MODEL || 'featherless-ai/Qwen2.5-7B-Instruct',
      label: 'featherless',
    }
  }
  return null
}

/** OpenAI-compatible chat completion for server-side text features. */
export async function callTextModel(
  messages: TextMessage[],
  options: TextOptions = {}
): Promise<string> {
  const provider = getTextProvider()
  if (!provider) throw new Error('no_text_provider')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? AI_TIMEOUT_MS)
  try {
    const response = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.key}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 500,
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`${provider.label}_${response.status}`)
    const data = await response.json()
    return String(data?.choices?.[0]?.message?.content ?? '')
  } finally {
    clearTimeout(timer)
  }
}
