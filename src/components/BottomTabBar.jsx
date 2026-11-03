import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS, GAMEPLAY_PATHS } from '../data/navItems'

/** Mobile-only floating nav (sm:+ gets the merged row in TopNav instead). */
export default function BottomTabBar() {
  const { pathname } = useLocation()
  if (GAMEPLAY_PATHS.has(pathname)) return null

  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-5xl items-center justify-around rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-2 py-2 backdrop-blur-xl shadow-[var(--shadow-elevation-3)] sm:hidden"
      aria-label="Primary"
    >
      {NAV_ITEMS.map((item) => {
        const active = item.match(pathname)
        return (
          <Link
            key={item.id}
            to={item.to}
            className={`flex flex-col items-center gap-0.5 rounded-full px-3 py-1 text-[10px] font-bold transition-colors ${
              active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
            }`}
          >
            <span className="text-base leading-none">{item.emoji}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
