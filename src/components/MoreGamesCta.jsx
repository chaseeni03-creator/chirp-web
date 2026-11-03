import { Link } from 'react-router-dom'

/** Closing CTA for a one-per-day game's finished screen — gives the result
 * stack (ShareResult/GroupScoreBanner/DailyLeaderboardBanner) a clear next
 * step instead of just ending. More vs Less is the one game people replay
 * in a single sitting (its own "Play Again" button), everything else is
 * done for the day, so this points to the full game catalog instead. */
export default function MoreGamesCta() {
  return (
    <Link
      to="/games"
      className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 text-sm font-bold text-[var(--color-text-secondary)] shadow-[var(--shadow-elevation-1)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-[var(--color-text)]"
    >
      🎮 Look at other games
    </Link>
  )
}
