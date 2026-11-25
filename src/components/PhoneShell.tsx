'use client'

import { usePathname } from 'next/navigation'
import SvgDefs from './SvgDefs'
import TabBar from './TabBar'

// Screens that own the full phone surface and should not show the tab bar.
const CHROMELESS = ['/login', '/auth', '/add', '/onboarding']

export default function PhoneShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/'
  const hideChrome = CHROMELESS.some(
    path => pathname === path || pathname.startsWith(`${path}/`)
  )

  return (
    <div className="phone">
      <div className="sb" aria-hidden="true">
        <span>9:41</span>
        <i />
      </div>
      <SvgDefs />
      {children}
      {hideChrome ? null : <TabBar />}
    </div>
  )
}
