import LoginForm from './LoginForm'
import { isDemoLoginEnabled } from '@/lib/demo'

// Environment is read on the server at request time so a deployment can add
// Supabase keys without rebuilding a stale setup page.
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return <LoginForm demoEnabled={isDemoLoginEnabled()} />
}
