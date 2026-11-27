import 'server-only'
import { getServerEnv } from './env'

/**
 * The demo shortcut is a development convenience, never a production login.
 * It requires BOTH a non-production build and an explicit env opt-in, so a
 * preview deployment that inherits `NODE_ENV=development` still stays closed.
 */
export function isDemoLoginEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return getServerEnv().ENABLE_DEMO_LOGIN === 'true'
}
