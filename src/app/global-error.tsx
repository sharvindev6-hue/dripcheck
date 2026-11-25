'use client'

import SystemScreen, { systemButtonStyle } from '@/components/SystemScreen'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error('[dripcheck] global error', error)

  return (
    <html lang="en">
      <body>
        <SystemScreen
          eyebrow="DripCheck"
          title="The app could not start."
          body="Reload to try again. If it keeps happening, the deployment may be missing its environment variables."
          action={
            <button type="button" onClick={reset} style={systemButtonStyle}>
              Reload
            </button>
          }
        />
      </body>
    </html>
  )
}
