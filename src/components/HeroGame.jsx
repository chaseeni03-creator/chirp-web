import { useNavigate } from 'react-router-dom'
import { useSport } from '../context/SportContext'

// Featured on rotation — always the NFL version regardless of the visitor's
// currently-selected sport tab, so the copy below is written for NFL
// specifically rather than reusing games.js's sport-label-templated text.
const FEATURED = [
  {
    key: 'stat-line',
    path: '/statline',
    name: 'Stat Line',
    emoji: '📊',
    description: 'Identify the NFL player from a single revealed season stat line.',
  },
  {
    key: 'chirp-guess',
    path: '/guess',
    name: 'Chirp Guess',
    emoji: '🎯',
    description: "Guess today's mystery NFL player in 8 tries or fewer.",
  },
  {
    key: 'more-or-less',
    path: '/moreorless',
    name: 'More vs Less',
    emoji: '⚔️',
    description: 'Endless NFL head-to-head stat showdowns. How long can you last?',
  },
]

/** Same game all day for everyone (not random-per-load) — a stable pick keeps a visitor's first and second page load consistent instead of flickering between games on refresh. */
function todaysFeaturedGame() {
  const daysSinceEpoch = Math.floor(Date.now() / 86400000)
  return FEATURED[daysSinceEpoch % FEATURED.length]
}

/** Front-and-center pick of the day, above the full games grid — the grid stays untouched below this for anyone who wants to browse instead. */
export default function HeroGame() {
  const navigate = useNavigate()
  const { setSport } = useSport()
  const game = todaysFeaturedGame()

  function handlePlay() {
    setSport('nfl')
    navigate(game.path)
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-elevated)] p-6 text-center sm:mb-8 sm:p-10">
      <p className="text-xs font-bold tracking-widest text-[var(--color-primary)]">🏈 TODAY'S FEATURED GAME</p>
      <p className="mt-3 text-4xl sm:text-5xl">{game.emoji}</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{game.name}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-text-secondary)] sm:text-base">
        {game.description}
      </p>
      <button
        onClick={handlePlay}
        className="mt-5 rounded-full bg-[var(--color-primary)] px-10 py-3.5 text-base font-black text-white shadow-lg shadow-[var(--color-primary)]/20 transition-transform hover:scale-105 sm:text-lg"
      >
        Play Now
      </button>
    </div>
  )
}
