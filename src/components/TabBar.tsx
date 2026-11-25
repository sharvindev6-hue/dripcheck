'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { CSSProperties } from 'react'
import { ClosetIcon, HeartIcon, PlusIcon, TodayIcon, YouIcon } from './icons'

const TABS = [
  { href: '/', label: 'Today', Icon: TodayIcon },
  { href: '/closet', label: 'Closet', Icon: ClosetIcon },
  { href: '/looks', label: 'Looks', Icon: HeartIcon },
  { href: '/you', label: 'You', Icon: YouIcon },
]

// The centre "+" occupies grid column 3, so the indicator jumps 1 -> 3.
const INDICATOR_INDEX = [0, 1, 3, 4]

export default function TabBar() {
  const pathname = usePathname() ?? '/'
  const active = TABS.findIndex(tab =>
    tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
  )

  return (
    <nav className="tabs" aria-label="Main">
      <div
        className="ind"
        style={{ '--i': active >= 0 ? INDICATOR_INDEX[active] : 0 } as CSSProperties}
        aria-hidden="true"
      />
      <Link href="/" className={active === 0 ? 'on' : undefined} aria-current={active === 0 ? 'page' : undefined}>
        <TodayIcon />
        Today
      </Link>
      <Link
        href="/closet"
        className={active === 1 ? 'on' : undefined}
        aria-current={active === 1 ? 'page' : undefined}
      >
        <ClosetIcon />
        Closet
      </Link>
      <Link href="/add" className="plus" aria-label="Add clothes">
        <PlusIcon strokeWidth={2.2} />
      </Link>
      <Link
        href="/looks"
        className={active === 2 ? 'on' : undefined}
        aria-current={active === 2 ? 'page' : undefined}
      >
        <HeartIcon />
        Looks
      </Link>
      <Link
        href="/you"
        className={active === 3 ? 'on' : undefined}
        aria-current={active === 3 ? 'page' : undefined}
      >
        <YouIcon />
        You
      </Link>
    </nav>
  )
}
