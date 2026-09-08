import { Link } from 'react-router-dom'
import SportSelector from './SportSelector'

export default function Header() {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto grid h-14 max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-4">
        <span aria-hidden="true" />
        <Link to="/" className="flex items-center justify-self-center gap-1.5 font-extrabold tracking-tight">
          <span className="text-lg text-[var(--color-primary)]">Chirp</span>
          <img src="/bird-logo.png" alt="" className="h-6 w-6" />
          <span className="text-lg text-[var(--color-text)]">Sports</span>
        </Link>
        <div className="flex items-center justify-self-end gap-3 text-xs font-bold sm:gap-4 sm:text-sm">
          <Link to="/leaderboard" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
            🏆 Leaderboard
          </Link>
          <Link to="/groups" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
            👥 Groups
          </Link>
        </div>
      </div>
      <SportSelector />
    </header>
  )
}
