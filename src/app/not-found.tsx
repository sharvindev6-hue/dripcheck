import Link from 'next/link'
import SystemScreen, { systemButtonStyle } from '@/components/SystemScreen'

export default function NotFound() {
  return (
    <SystemScreen
      eyebrow="404"
      title="Nothing on this rail."
      body="That screen does not exist. Head back to today's look."
      action={
        <Link href="/" style={{ ...systemButtonStyle, textDecoration: 'none', lineHeight: '44px' }}>
          Back to Today
        </Link>
      }
    />
  )
}
