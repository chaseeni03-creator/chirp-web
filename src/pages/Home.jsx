import { useEffect, useState } from 'react'
import Seo from '../components/Seo'
import GameCard from '../components/GameCard'
import { games } from '../data/games'
import { getTodayResult } from '../lib/storage'
import { todayStr } from '../lib/supabase'
import { useSport } from '../context/SportContext'
import { SPORT_META } from '../lib/sports'

export default function Home() {
  const { sport } = useSport()
  const [completed, setCompleted] = useState({})
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

      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-2 text-3xl font-black tracking-tight">
          <span>🐦</span>
          <span>
            <span className="text-[var(--color-primary)]">Chirp</span> Sports
          </span>
        </div>
        <p className="text-[var(--color-text-secondary)]">Daily Sports Games. Free.</p>
        <p className="mt-1 text-sm font-bold text-[var(--color-primary)]">{meta.gamesTitle}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {games.map((g) => (
          <GameCard key={g.key} game={g} sportLabel={meta.label} completed={completed[g.key]} />
        ))}
      </div>
    </div>
  )
}
