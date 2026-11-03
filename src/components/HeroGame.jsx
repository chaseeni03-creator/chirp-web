import { Link } from 'react-router-dom'
import { games } from '../data/games'
import { useSport } from '../context/SportContext'
import { SPORT_META } from '../lib/sports'
import useCompletedGames from '../hooks/useCompletedGames'

/** Same game all day for everyone (not random-per-load) — a stable pick keeps a visitor's first and second page load consistent instead of flickering between games on refresh. Shared across sports (the catalog itself doesn't vary by sport, only each game's description text does), so an NFL and MLB visitor see "today is Stat Line day" on the same day, just with sport-specific copy. */
function todaysFeaturedGame() {
  const daysSinceEpoch = Math.floor(Date.now() / 86400000)
  return games[daysSinceEpoch % games.length]
}

/** Front-and-center pick of the day, above the full games grid — the grid stays untouched below this for anyone who wants to browse instead. */
export default function HeroGame() {
  const { sport } = useSport()
  const meta = SPORT_META[sport]
  const completed = useCompletedGames(sport)
  const game = todaysFeaturedGame()
  const done = completed[game.key]

  return (
    <div className="relative mb-6 sm:mb-8">
      <div
        className="absolute -inset-10 -z-10 blur-3xl"
        style={{ backgroundImage: 'var(--gradient-hero-glow)' }}
        aria-hidden="true"
      />
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-elevated)] p-6 text-center shadow-[var(--shadow-elevation-3)] sm:p-10">
        <p className="text-xs font-bold tracking-widest text-[var(--color-primary)]">
          {meta.emoji} TODAY'S FEATURED {meta.label} GAME
        </p>
        <p className="mt-3 text-4xl sm:text-5xl">{game.emoji}</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{game.name}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-text-secondary)] sm:text-base">
          {game.description(meta.label)}
        </p>
        {done ? (
          <div className="mt-5 flex flex-col items-center gap-2">
            <span className="rounded-full bg-[var(--color-success)]/12 px-4 py-1.5 text-xs font-bold text-[var(--color-success)]">
              ✅ Done for today
            </span>
            <Link to="/games" className="text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
              See more games →
            </Link>
          </div>
        ) : (
          <Link
            to={game.path}
            className="mt-5 inline-block rounded-full bg-[var(--color-primary)] px-10 py-3.5 text-base font-black text-white shadow-[var(--shadow-glow-primary)] transition-transform hover:scale-105 sm:text-lg"
          >
            Play Now
          </Link>
        )}
      </div>
    </div>
  )
}
