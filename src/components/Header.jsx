import { Link } from 'react-router-dom'
import SportSelector from './SportSelector'

export default function Header() {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-center px-4">
        <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="text-xl">🐦</span>
          <span className="text-lg">
            <span className="text-[var(--color-primary)]">Chirp</span> Sports
          </span>
        </Link>
      </div>
      <SportSelector />
    </header>
  )
}
