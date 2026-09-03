import { Link } from 'react-router-dom'
import SportSelector from './SportSelector'

export default function Header() {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <span className="w-16 sm:w-20" aria-hidden="true" />
        <Link to="/" className="flex items-center gap-1.5 font-extrabold tracking-tight">
          <span className="text-lg text-[var(--color-primary)]">Chirp</span>
          <img src="/bird-logo.png" alt="" className="h-6 w-6" />
          <span className="text-lg text-[var(--color-text)]">Sports</span>
        </Link>
        <Link
          to="/groups"
          className="w-16 shrink-0 text-right text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] sm:w-20 sm:text-sm"
        >
          👥 Groups
        </Link>
      </div>
      <SportSelector />
    </header>
  )
}
