'use client'

import { createClient } from '@/lib/supabase'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BrandMark } from './icons'

// Hand-drawn-feel icon glyphs instead of lucide. Each is a chunky monoline SVG.
function HomeIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
      <path d="M3 11 12 3l9 8v10H3z" /><path d="M9 21v-6h6v6" />
    </svg>
  )
}
function ClosetIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" /><path d="M3 8h18" /><path d="M12 3v18" />
    </svg>
  )
}
function TodayIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" /><path d="M3 10h18" /><path d="M8 3v4M16 3v4" />
      <rect x="13" y="13" width="4" height="4" fill="currentColor" stroke="none" />
    </svg>
  )
}
const supabase = createClient()

export default function Navbar() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserEmail(user.email || null)
    }
    getUser()
  }, [])

  const navItems = [
    { href: '/',       label: 'HOME',   icon: HomeIcon },
    { href: '/closet', label: 'CLOSET', icon: ClosetIcon },
    { href: '/outfit', label: 'TODAY',  icon: TodayIcon },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t-[3px] border-ink bg-cream
                    md:relative md:border-t-0 md:border-r-[3px] md:border-ink md:bg-cream
                    md:w-64 md:h-screen md:flex md:flex-col md:justify-between md:py-8">
      <div className="flex justify-around items-center md:flex-col md:items-stretch md:justify-start md:gap-3 md:px-4">
        <Link href="/" className="hidden md:flex items-center gap-2 px-2 py-2 mb-6">
          <BrandMark size={32} />
          <span className="font-mono text-2xl font-extrabold tracking-tight text-ink uppercase">DripCheck</span>
        </Link>

        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col md:flex-row items-center md:px-4 md:py-3 transition-all btn-press border-2 border-ink
                          ${isActive
                            ? 'bg-pink text-ink shadow-chunk'
                            : 'bg-cream text-ink hover:bg-yellow'}`}
            >
              <Icon size={20} />
              <span className="text-[11px] md:text-sm md:ml-3 mt-1 md:mt-0 font-mono font-bold tracking-wider">{item.label}</span>
            </Link>
          )
        })}
      </div>

      <div className="hidden md:block md:px-4 md:mt-8">
        {userEmail && (
          <p className="text-[10px] text-ink-soft truncate px-2 mb-3 font-mono uppercase">{userEmail}</p>
        )}
      </div>
    </nav>
  )
}