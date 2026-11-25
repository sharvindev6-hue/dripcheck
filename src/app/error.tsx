'use client'

import SystemScreen, { systemButtonStyle } from '@/components/SystemScreen'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Log once for the browser console / monitoring, but never render internals.
  console.error('[dripcheck] route error', error)

  return (
    <SystemScreen
      eyebrow="Something broke"
      title="That did not load."
      body="A piece of the app failed to render. Your closet is safe — try again."
      action={
        <button type="button" onClick={reset} style={systemButtonStyle}>
          Try again
        </button>
      }
    />
  )
}
