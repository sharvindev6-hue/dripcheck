// Environment validation.
//
// Two rules drive this file:
//   1. A fresh clone must build with NO env vars. Validation is therefore lazy:
//      it runs the first time a client is actually constructed at runtime, not
//      at module load during prerender.
//   2. NEXT_PUBLIC_* vars must be referenced literally so Next.js can inline
//      them into the browser bundle. Never switch to dynamic indexing here.

import { z } from 'zod'

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .trim()
    .url('must be a valid URL such as https://xyz.supabase.co'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .trim()
    .min(20, 'looks too short to be a Supabase anon key'),
})

export type PublicEnv = z.infer<typeof publicSchema>

export class EnvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnvError'
  }
}

function readPublicEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

let publicCache: PublicEnv | null = null

/** Validated public Supabase config. Throws a readable EnvError when missing. */
export function getPublicEnv(): PublicEnv {
  if (publicCache) return publicCache

  const parsed = publicSchema.safeParse(readPublicEnv())
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map(issue => `${issue.path.join('.')} ${issue.message}`)
      .join('; ')
    throw new EnvError(
      `Supabase is not configured. Copy .env.example to .env.local and fill in the values. (${detail})`
    )
  }

  publicCache = parsed.data
  return publicCache
}

/** Safe check for UI that wants to show a setup notice instead of throwing. */
export function hasPublicEnv(): boolean {
  return publicSchema.safeParse(readPublicEnv()).success
}

const optionalString = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional()
)

const serverSchema = z.object({
  NVIDIA_NIM_API_KEY: optionalString,
  NVIDIA_NIM_MODEL: optionalString,
  NVIDIA_NIM_VISION_MODEL: optionalString,
  FEATHERLESS_API_KEY: optionalString,
  FEATHERLESS_MODEL: optionalString,
  GEMINI_API_KEY: optionalString,
  OPENWEATHER_API_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  DEMO_USER_EMAIL: optionalString,
  // Explicit opt-in for the one-click demo login. Being in development is not
  // enough on its own: a preview deployment can run with NODE_ENV=development.
  ENABLE_DEMO_LOGIN: optionalString,
})

export type ServerEnv = z.infer<typeof serverSchema>

let serverCache: ServerEnv | null = null

/**
 * Optional server-only keys. Missing keys are a supported state: the app
 * degrades to the rules engine / manual weather instead of going dark.
 */
export function getServerEnv(): ServerEnv {
  if (serverCache) return serverCache

  serverCache = serverSchema.parse({
    NVIDIA_NIM_API_KEY: process.env.NVIDIA_NIM_API_KEY,
    NVIDIA_NIM_MODEL: process.env.NVIDIA_NIM_MODEL,
    NVIDIA_NIM_VISION_MODEL: process.env.NVIDIA_NIM_VISION_MODEL,
    FEATHERLESS_API_KEY: process.env.FEATHERLESS_API_KEY,
    FEATHERLESS_MODEL: process.env.FEATHERLESS_MODEL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DEMO_USER_EMAIL: process.env.DEMO_USER_EMAIL,
    ENABLE_DEMO_LOGIN: process.env.ENABLE_DEMO_LOGIN,
  })
  return serverCache
}
