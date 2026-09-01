import { Link } from 'react-router-dom'

export default function GameCard({ game, sportLabel, completed }) {
  return (
    <Link
      to={game.path}
      className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:border-[var(--color-primary)]/50 sm:gap-4 sm:p-4"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-elevated)] text-xl sm:h-12 sm:w-12 sm:text-2xl">
        {game.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold sm:text-base">{game.name}</p>
        <p className="truncate text-xs text-[var(--color-text-secondary)] sm:text-sm">{game.description(sportLabel)}</p>
      </div>
      {completed ? (
        <span className="shrink-0 rounded-full bg-[var(--color-success)]/12 px-2 py-1 text-[10px] font-bold text-[var(--color-success)] sm:px-3 sm:py-1.5 sm:text-xs">
          ✅ Done
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-[var(--color-primary)]/15 px-2 py-1 text-[10px] font-bold text-[var(--color-primary)] sm:px-3 sm:py-1.5 sm:text-xs">
          🎮 Play Now
        </span>
      )}
    </Link>
  )
}
