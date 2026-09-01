import { useEffect, useState } from 'react'
import Seo from '../components/Seo'
import GameCard from '../components/GameCard'
import { games } from '../data/games'
import { getTodayResult } from '../lib/storage'
import { todayStr } from '../lib/supabase'

export default function Home() {
  const [completed, setCompleted] = useState({})

  useEffect(() => {
    const today = todayStr()
    const map = {}
    for (const g of games) {
      map[g.key] = Boolean(getTodayResult(g.key, today))
    }
    setCompleted(map)
  }, [])

  return (
    <div>
      <Seo description="Free daily NFL games: Chirp Guess, Stat Line, Career Builder, The Progression, More vs Less, The Lineup, and Chirp Grid." />

      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-2 text-3xl font-black tracking-tight">
          <span>🐦</span>
          <span>
            <span className="text-[var(--color-primary)]">Chirp</span> Sports
          </span>
        </div>
        <p className="text-[var(--color-text-secondary)]">Daily Sports Games. Free.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {games.map((g) => (
          <GameCard key={g.key} game={g} completed={completed[g.key]} />
        ))}
      </div>
    </div>
  )
}
