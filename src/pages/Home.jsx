import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo'
import GameCard from '../components/GameCard'
import PlayWithFriendsModal from '../components/PlayWithFriendsModal'
import { games } from '../data/games'
import { getTodayResult } from '../lib/storage'
import { todayStr } from '../lib/supabase'
import { useSport } from '../context/SportContext'
import { useGroup } from '../context/GroupContext'
import { SPORT_META } from '../lib/sports'
import { displayCode } from '../lib/groups'

export default function Home() {
  const { sport } = useSport()
  const { activeGroup } = useGroup()
  const [completed, setCompleted] = useState({})
  const [showFriendsModal, setShowFriendsModal] = useState(false)
  const meta = SPORT_META[sport]

  useEffect(() => {
    const today = todayStr()
    const map = {}
    for (const g of games) {
      map[g.key] = Boolean(getTodayResult(`${sport}-${g.key}`, today))
    }
    setCompleted(map)
  }, [sport])

  return (
    <div>
      <Seo
        title={meta.gamesTitle}
        description={`Free daily ${meta.label} games: Chirp Guess, Stat Line, Career Builder, The Progression, More vs Less, The Lineup, and Chirp Grid.`}
      />

      <div className="mb-6 text-center sm:mb-8">
        <div className="mb-2 flex items-center justify-center gap-1.5 text-2xl font-black tracking-tight sm:text-3xl">
          <span className="text-[var(--color-primary)]">Chirp</span>
          <img src="/bird-logo.png" alt="" className="h-8 w-8 sm:h-9 sm:w-9" />
          <span className="text-[var(--color-text)]">Sports</span>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] sm:text-base">Daily Sports Games. Free.</p>
        <p className="mt-1 text-xs font-bold text-[var(--color-primary)] sm:text-sm">{meta.gamesTitle}</p>

        {activeGroup ? (
          <Link
            to="/groups"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 px-4 py-2 text-xs font-bold text-[var(--color-primary)] sm:text-sm"
          >
            🏆 Playing with {activeGroup.name} ({displayCode(activeGroup.code)}) — View Leaderboard
          </Link>
        ) : (
          <div className="mt-4 flex justify-center gap-2">
            <a
              href="#games"
              className="rounded-full border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2 text-xs font-bold text-[var(--color-text-secondary)] sm:text-sm"
            >
              Play Solo
            </a>
            <button
              onClick={() => setShowFriendsModal(true)}
              className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-xs font-bold text-white sm:text-sm"
            >
              Play with Friends 👥
            </button>
          </div>
        )}
      </div>

      <div id="games" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {games.map((g) => (
          <GameCard key={g.key} game={g} sportLabel={meta.label} completed={completed[g.key]} />
        ))}
      </div>

      {showFriendsModal && <PlayWithFriendsModal onClose={() => setShowFriendsModal(false)} />}
    </div>
  )
}
