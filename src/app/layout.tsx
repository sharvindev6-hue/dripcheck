import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import PhoneShell from '@/components/PhoneShell'
import { ToastProvider } from '@/components/Toast'
import './globals.css'
import '@/styles/tokens.css'
import '@/styles/shell.css'
import '@/styles/screens.css'
import './app.css'

const archivo = localFont({
  src: '../fonts/archivo-var.woff2',
  variable: '--font-display',
  weight: '500 900',
  style: 'normal',
  display: 'swap',
  preload: true,
  fallback: ['Arial Narrow', 'system-ui', 'sans-serif'],
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
})

const instrumentSans = localFont({
  src: '../fonts/instrument-sans-var.woff2',
  variable: '--font-body',
  weight: '400 700',
  style: 'normal',
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'sans-serif'],
})

export const metadata: Metadata = {
  title: {
    default: 'DripCheck',
    template: '%s · DripCheck',
  },
  description: 'A digital closet that styles you a new outfit every morning.',
  applicationName: 'DripCheck',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DripCheck',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EFE8D8' },
    { media: '(prefers-color-scheme: dark)', color: '#0C1511' },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${instrumentSans.variable}`}>
      <body>
        <PhoneShell>
          <ToastProvider>{children}</ToastProvider>
        </PhoneShell>
      </body>
    </html>
  )
}
