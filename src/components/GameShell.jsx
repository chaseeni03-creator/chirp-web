import { Link } from 'react-router-dom'

export default function GameShell({ emoji, title, children }) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          ←
        </Link>
        <h1 className="text-xl font-extrabold">
          {emoji} {title}
        </h1>
      </div>
      {children}
    </div>
  )
}

export function Loading() {
  return <p className="text-center text-[var(--color-text-secondary)]">Loading today's puzzle…</p>
}

export function ErrorMsg({ message }) {
  return (
    <p className="text-center text-[var(--color-text-secondary)]">
      {message || "No puzzle scheduled for today — check back soon."}
    </p>
  )
}
