import { Link } from 'react-router-dom'

export default function GameCard({ game, completed }) {
  return (
    <Link
      to={game.path}
      className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-primary)]/50"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-elevated)] text-2xl">
        {game.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold">{game.name}</p>
        <p className="truncate text-sm text-[var(--color-text-secondary)]">{game.description}</p>
      </div>
      {completed ? (
        <span className="shrink-0 rounded-full bg-[var(--color-success)]/12 px-3 py-1.5 text-xs font-bold text-[var(--color-success)]">
          ✅ Done
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-[var(--color-primary)]/15 px-3 py-1.5 text-xs font-bold text-[var(--color-primary)]">
          🎮 Play Now
        </span>
      )}
    </Link>
  )
}
