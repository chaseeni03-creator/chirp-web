import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useGroup } from '../context/GroupContext'
import { fetchMyStreak } from '../lib/badges'
import { NAV_ITEMS, GAMEPLAY_PATHS } from '../data/navItems'

export default function TopNav() {
  const { pathname } = useLocation()
  const { googleSession } = useGroup()
  const [streak, setStreak] = useState(null)
  const showNavRow = !GAMEPLAY_PATHS.has(pathname)

  useEffect(() => {
    let cancelled = false
    fetchMyStreak(googleSession?.user?.id ?? null)
      .then((s) => !cancelled && setStreak(s))
      .catch(() => !cancelled && setStreak(null))
    return () => {
      cancelled = true
    }
  }, [googleSession])

  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-1.5 font-extrabold tracking-tight">
          <span className="text-lg text-[var(--color-primary)]">Chirp</span>
          <img src="/bird-logo.png" alt="" className="h-6 w-6" />
          <span className="text-lg text-[var(--color-text)]">Sports</span>
        </Link>

        {showNavRow && (
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active = item.match(pathname)
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${
                    active ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <span>{item.emoji}</span>
                  {item.label}
                </Link>
              )
            })}
          </nav>
        )}

        {streak && streak.current_streak > 0 && (
          <Link
            to="/badges"
            className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-1 text-sm font-bold"
          >
            🔥 {streak.current_streak}
          </Link>
        )}
      </div>
    </header>
  )
}
